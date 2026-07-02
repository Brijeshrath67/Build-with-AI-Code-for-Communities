from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import List, Optional
import requests
import math
from datetime import datetime, timezone, date
from apps.api.app.core.database import get_db
from apps.api.app.core.config import settings
from apps.api.app.core.dependencies import get_current_active_user
from apps.api.app.models.models import PHC, Stock, MedicineMapping, User
from apps.api.app.schemas.schemas import MatchResponse, MatchItem

router = APIRouter()

@router.get("/{phc_id}", response_model=MatchResponse)
def match_redistribution_candidates(
    phc_id: int,
    medicine: str,
    required_quantity: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    target_phc = db.query(PHC).filter(PHC.id == phc_id).first()
    if not target_phc:
        raise HTTPException(status_code=404, detail="Target PHC not found")

    resolved_medicine = medicine
    try:
        response = requests.get(
            f"{settings.AI_SERVICE_URL}/api/v1/ai/matcher/resolve",
            params={"query": medicine},
            timeout=2.0
        )
        if response.status_code == 200:
            resolved_medicine = response.json().get("standard_name", medicine)
    except Exception:
        mapping = db.query(MedicineMapping).filter(
            func.lower(MedicineMapping.alias_name) == func.lower(medicine)
        ).first()
        if mapping:
            resolved_medicine = mapping.standard_name

    query_sql = text("""
        SELECT p.id as phc_id, p.name as phc_name, s.quantity as available_surplus, s.expiry_date,
               (6371 * acos(
                   LEAST(1.0, GREATEST(-1.0, 
                       cos(radians(:origin_lat)) * cos(radians(p.latitude)) * 
                       cos(radians(p.longitude) - radians(:origin_lon)) + 
                       sin(radians(:origin_lat)) * sin(radians(p.latitude))
                   ))
               )) as distance_km
        FROM phcs p
        JOIN stock s ON s.phc_id = p.id
        WHERE p.id != :origin_id
          AND s.medicine = :medicine
          AND s.quantity > 0
        ORDER BY distance_km ASC
    """)

    results = db.execute(query_sql, {
        "origin_id": phc_id,
        "origin_lat": target_phc.latitude,
        "origin_lon": target_phc.longitude,
        "medicine": resolved_medicine
    }).mappings().all()

    today = date.today()
    max_dist = 0.0
    max_surplus = 0
    for r in results:
        d = r["distance_km"]
        if not math.isnan(d) and d > max_dist:
            max_dist = d
        if r["available_surplus"] > max_surplus:
            max_surplus = r["available_surplus"]

    recommendations = []
    for row in results:
        dist = row["distance_km"]
        if math.isnan(dist):
            dist = 0.0
        if max_dist == 0:
            max_dist = 1.0

        days_to_expiry = (row["expiry_date"] - today).days
        if days_to_expiry <= 0:
            urgency_score = 1.0
        elif days_to_expiry >= 365:
            urgency_score = 0.0
        else:
            urgency_score = 1.0 - (days_to_expiry / 365.0)

        surplus_norm = row["available_surplus"] / max_surplus if max_surplus > 0 else 0
        dist_norm = 1.0 - (dist / max_dist)

        composite_score = round(
            dist_norm * 0.4 +
            urgency_score * 0.35 +
            surplus_norm * 0.25,
            3
        )

        recommendations.append(MatchItem(
            phc_id=row["phc_id"],
            phc_name=row["phc_name"],
            distance_km=round(dist, 2),
            available_surplus=row["available_surplus"],
            expiry_date=row["expiry_date"],
            similarity_score=composite_score
        ))

    recommendations.sort(key=lambda r: r.similarity_score, reverse=True)

    return MatchResponse(
        medicine=resolved_medicine,
        required_quantity=required_quantity,
        recommendations=recommendations
    )
