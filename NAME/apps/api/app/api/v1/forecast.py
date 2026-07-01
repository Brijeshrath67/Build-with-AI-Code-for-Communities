from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import requests
from apps.api.app.core.database import get_db
from apps.api.app.core.config import settings
from apps.api.app.core.dependencies import get_current_active_user
from apps.api.app.models.models import Forecast, Stock, FeatureSnapshot, User
from apps.api.app.schemas.schemas import ForecastResponse
from datetime import datetime, timezone, timedelta

router = APIRouter()

@router.get("/{phc_id}", response_model=List[ForecastResponse])
def get_forecasts(
    phc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role in ["ASHA Worker", "PHC Staff"] and current_user.phc_id != phc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You only have access to view forecasts for your own PHC."
        )
        
    # Attempt to trigger/fetch forecasts from AI service first
    try:
        response = requests.get(f"{settings.AI_SERVICE_URL}/api/v1/ai/forecast/{phc_id}", timeout=2.0)
        if response.status_code == 200:
            # Sync forecasts returned by AI service to our database
            ai_forecasts = response.json()
            # Clear old forecasts for this PHC
            db.query(Forecast).filter(Forecast.phc_id == phc_id).delete()
            
            for item in ai_forecasts:
                f_date = datetime.strptime(item["stockout_date"], "%Y-%m-%d").date()
                db_forecast = Forecast(
                    phc_id=phc_id,
                    medicine=item["medicine"],
                    risk_score=item["risk_score"],
                    stockout_date=f_date
                )
                db.add(db_forecast)
            db.commit()
    except Exception as e:
        print(f"AI Service Forecasting connection failed, using local database fallback. Error: {e}")
        # Local fallback forecasting algorithm: Last-Write-Wins math logic
        # Retrieve stocks for this PHC
        stocks = db.query(Stock).filter(Stock.phc_id == phc_id).all()
        
        # Clear old forecasts for this PHC
        db.query(Forecast).filter(Forecast.phc_id == phc_id).delete()
        
        for stock_item in stocks:
            # Get consumption rate from feature snapshots
            snap = db.query(FeatureSnapshot).filter(
                FeatureSnapshot.phc_id == phc_id,
                FeatureSnapshot.medicine == stock_item.medicine
            ).order_by(FeatureSnapshot.captured_at.desc()).first()
            
            daily_rate = snap.consumption_rate if snap else 10.0 # Default consumption rate
            
            if daily_rate <= 0:
                daily_rate = 1.0
                
            days_left = stock_item.quantity / daily_rate
            stockout_date = datetime.now(timezone.utc).date() + timedelta(days=int(days_left))
            
            if days_left <= 7:
                risk = "HIGH"
            elif days_left <= 21:
                risk = "MEDIUM"
            else:
                risk = "LOW"
                
            db_forecast = Forecast(
                phc_id=phc_id,
                medicine=stock_item.medicine,
                risk_score=risk,
                stockout_date=stockout_date
            )
            db.add(db_forecast)
        db.commit()
        
    return db.query(Forecast).filter(Forecast.phc_id == phc_id).all()
