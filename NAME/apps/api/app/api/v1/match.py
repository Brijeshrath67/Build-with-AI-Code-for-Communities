from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import List, Optional
import requests
import math
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
    # Verify the requestor's PHC exists
    target_phc = db.query(PHC).filter(PHC.id == phc_id).first()
    if not target_phc:
        raise HTTPException(status_code=404, detail="Target PHC not found")
        
    # Step 1: Resolve the medicine name semantically (AI or SQL Alias mapping fallback)
    resolved_medicine = medicine
    try:
        # Try contacting AI service for semantic vector matching
        response = requests.get(
            f"{settings.AI_SERVICE_URL}/api/v1/ai/matcher/resolve",
            params={"query": medicine},
            timeout=2.0
        )
        if response.status_code == 200:
            resolved_medicine = response.json().get("standard_name", medicine)
    except Exception:
        # Local SQL mapping fallback
        mapping = db.query(MedicineMapping).filter(
            func.lower(MedicineMapping.alias_name) == func.lower(medicine)
        ).first()
        if mapping:
            resolved_medicine = mapping.standard_name

    # Step 2: Query other PHCs with stock of the resolved medicine, calculating distance via Haversine Formula
    # Haversine formula in SQL: 6371 * acos(cos(radians(lat_origin)) * cos(radians(lat_dest)) * cos(radians(lon_dest) - radians(lon_origin)) + sin(radians(lat_origin)) * sin(radians(lat_dest)))
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

    recommendations = []
    for row in results:
        # Distance calculation check to handle exact same points (0 km distance acos range error)
        dist = row["distance_km"]
        if math.isnan(dist):
            dist = 0.0
            
        recommendations.append(MatchItem(
            phc_id=row["phc_id"],
            phc_name=row["phc_name"],
            distance_km=round(dist, 2),
            available_surplus=row["available_surplus"],
            expiry_date=row["expiry_date"],
            similarity_score=1.0 # Exact matches on alias or resolved name
        ))

    return MatchResponse(
        medicine=resolved_medicine,
        required_quantity=required_quantity,
        recommendations=recommendations
    )
