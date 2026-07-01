from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from apps.api.app.core.database import get_db
from apps.api.app.core.dependencies import get_current_active_user
from apps.api.app.models.models import Alert, Stock, PHC, User
from apps.api.app.schemas.schemas import AlertResponse
from datetime import datetime, timezone, timedelta

router = APIRouter()

@router.get("/active", response_model=List[AlertResponse])
def get_active_alerts(
    phc_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Security check: PHC-level users can only see their own alerts
    if current_user.role in ["ASHA Worker", "PHC Staff"]:
        phc_id = current_user.phc_id
        
    query = db.query(Alert).filter(Alert.resolved_at == None)
    if phc_id:
        query = query.filter(Alert.phc_id == phc_id)
        
    alerts = query.all()
    
    # Generate dynamic alerts in real time from live stock data if none exist (makes the demo rich!)
    if not alerts:
        # Check for stock with low quantity (< 30) or near-expiry (< 30 days)
        stock_query = db.query(Stock).options().filter(Stock.quantity >= 0)
        if phc_id:
            stock_query = stock_query.filter(Stock.phc_id == phc_id)
            
        stocks = stock_query.all()
        now_date = datetime.now(timezone.utc).date()
        expiry_threshold = now_date + timedelta(days=30)
        
        dynamic_alerts = []
        alert_id_counter = 999000
        
        for s in stocks:
            phc_name = db.query(PHC.name).filter(PHC.id == s.phc_id).scalar() or "PHC"
            
            # 1. Expiry alert
            if s.expiry_date <= now_date:
                dynamic_alerts.append(Alert(
                    id=alert_id_counter,
                    phc_id=s.phc_id,
                    message=f"CRITICAL: {s.medicine} in {phc_name} has EXPIRED on {s.expiry_date} (Qty: {s.quantity} units). Please discard.",
                    severity="high",
                    created_at=datetime.now(timezone.utc)
                ))
                alert_id_counter += 1
            elif s.expiry_date <= expiry_threshold:
                dynamic_alerts.append(Alert(
                    id=alert_id_counter,
                    phc_id=s.phc_id,
                    message=f"WARNING: {s.medicine} in {phc_name} expires on {s.expiry_date} ({s.quantity} units remaining). Plan redistribution.",
                    severity="medium",
                    created_at=datetime.now(timezone.utc)
                ))
                alert_id_counter += 1
                
            # 2. Low stock alert
            if s.quantity <= 20 and s.quantity > 0:
                dynamic_alerts.append(Alert(
                    id=alert_id_counter,
                    phc_id=s.phc_id,
                    message=f"ALERT: Low stock of {s.medicine} in {phc_name}. Only {s.quantity} units left.",
                    severity="medium",
                    created_at=datetime.now(timezone.utc)
                ))
                alert_id_counter += 1
            elif s.quantity == 0:
                dynamic_alerts.append(Alert(
                    id=alert_id_counter,
                    phc_id=s.phc_id,
                    message=f"CRITICAL: {s.medicine} in {phc_name} is OUT OF STOCK.",
                    severity="high",
                    created_at=datetime.now(timezone.utc)
                ))
                alert_id_counter += 1
                
        return dynamic_alerts + alerts
        
    return alerts
