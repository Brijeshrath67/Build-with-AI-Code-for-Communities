from datetime import datetime, timedelta, timezone
import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from apps.api.app.core.database import get_db
from apps.api.app.core.dependencies import get_current_active_user
from apps.api.app.models.models import Alert, PHC, Stock, User
from apps.api.app.schemas.schemas import AlertResponse

router = APIRouter()


class BroadcastMessageCreate(BaseModel):
    title: str
    message: str
    severity: str = "medium"


def _is_notification_alert(alert: Alert) -> bool:
    return alert.message.startswith("[TRANSFER]") or alert.message.startswith("[DHO]")


def _broadcast_message(db: Session, sender: User, payload: BroadcastMessageCreate) -> int:
    phcs = db.query(PHC).all()
    count = 0
    for phc in phcs:
        db.add(
            Alert(
                phc_id=phc.id,
                message=f"[DHO] {sender.name}: {payload.title} - {payload.message}",
                severity=payload.severity,
                created_at=datetime.now(timezone.utc),
            )
        )
        count += 1
    db.commit()
    return count


@router.get("/active", response_model=List[AlertResponse])
def get_active_alerts(
    phc_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role in ["ASHA Worker", "PHC Staff"]:
        phc_id = current_user.phc_id

    query = db.query(Alert).filter(Alert.resolved_at == None)
    if phc_id:
        query = query.filter(Alert.phc_id == phc_id)
    alerts = query.all()

    stock_query = db.query(Stock).filter(Stock.quantity >= 0)
    if phc_id:
        stock_query = stock_query.filter(Stock.phc_id == phc_id)
    stocks = stock_query.all()

    now_date = datetime.now(timezone.utc).date()
    expiry_threshold = now_date + timedelta(days=30)

    dynamic_alerts = []
    alert_id_counter = 999000

    for s in stocks:
        phc_name = db.query(PHC.name).filter(PHC.id == s.phc_id).scalar() or "PHC"

        if s.expiry_date <= now_date:
            dynamic_alerts.append(
                Alert(
                    id=alert_id_counter,
                    phc_id=s.phc_id,
                    message=f"CRITICAL: {s.medicine} in {phc_name} has EXPIRED on {s.expiry_date} (Qty: {s.quantity} units). Please discard.",
                    severity="high",
                    created_at=datetime.now(timezone.utc),
                )
            )
            alert_id_counter += 1
        elif s.expiry_date <= expiry_threshold:
            dynamic_alerts.append(
                Alert(
                    id=alert_id_counter,
                    phc_id=s.phc_id,
                    message=f"WARNING: {s.medicine} in {phc_name} expires on {s.expiry_date} ({s.quantity} units remaining). Plan redistribution.",
                    severity="medium",
                    created_at=datetime.now(timezone.utc),
                )
            )
            alert_id_counter += 1

        if s.quantity <= 20 and s.quantity > 0:
            dynamic_alerts.append(
                Alert(
                    id=alert_id_counter,
                    phc_id=s.phc_id,
                    message=f"ALERT: Low stock of {s.medicine} in {phc_name}. Only {s.quantity} units left.",
                    severity="medium",
                    created_at=datetime.now(timezone.utc),
                )
            )
            alert_id_counter += 1
        elif s.quantity == 0:
            dynamic_alerts.append(
                Alert(
                    id=alert_id_counter,
                    phc_id=s.phc_id,
                    message=f"CRITICAL: {s.medicine} in {phc_name} is OUT OF STOCK.",
                    severity="high",
                    created_at=datetime.now(timezone.utc),
                )
            )
            alert_id_counter += 1

    low_stock_items = [s for s in stocks if s.quantity <= 50 and s.expiry_date > now_date]
    for s in low_stock_items[:5]:
        phc_obj = db.query(PHC).filter(PHC.id == s.phc_id).first()
        if not phc_obj:
            continue

        surplus = (
            db.query(Stock, PHC)
            .join(PHC, Stock.phc_id == PHC.id)
            .filter(
                Stock.medicine == s.medicine,
                Stock.phc_id != s.phc_id,
                Stock.quantity >= 50,
                Stock.expiry_date > now_date,
            )
            .order_by(Stock.quantity.desc())
            .first()
        )

        if surplus:
            src_stock, src_phc = surplus
            try:
                dist = 6371 * math.acos(
                    min(
                        1.0,
                        max(
                            -1.0,
                            math.cos(math.radians(phc_obj.latitude))
                            * math.cos(math.radians(src_phc.latitude))
                            * math.cos(math.radians(src_phc.longitude) - math.radians(phc_obj.longitude))
                            + math.sin(math.radians(phc_obj.latitude)) * math.sin(math.radians(src_phc.latitude)),
                        ),
                    )
                )
            except (ValueError, OverflowError):
                dist = 999.0

            dynamic_alerts.append(
                Alert(
                    id=alert_id_counter,
                    phc_id=s.phc_id,
                    message=f"TRANSFER RECOMMENDED: {phc_name} needs {s.medicine} (only {s.quantity} left). "
                    f"{src_phc.name} has {src_stock.quantity} surplus units ({dist:.1f}km away).",
                    severity="medium",
                    created_at=datetime.now(timezone.utc),
                )
            )
            alert_id_counter += 1

    return dynamic_alerts + alerts


@router.post("/read/{alert_id}", response_model=AlertResponse)
def mark_alert_as_read(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if alert_id >= 999000:
        return AlertResponse(
            id=alert_id,
            phc_id=current_user.phc_id or 1,
            message="Dynamic alert read",
            severity="low",
            created_at=datetime.now(timezone.utc),
            resolved_at=datetime.now(timezone.utc),
        )

    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if current_user.role in ["ASHA Worker", "PHC Staff"] and alert.phc_id != current_user.phc_id:
        raise HTTPException(status_code=403, detail="You do not have permission to mark this alert as read.")

    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return alert


@router.get("/history", response_model=List[AlertResponse])
def get_alert_history(
    phc_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role in ["ASHA Worker", "PHC Staff"]:
        phc_id = current_user.phc_id

    query = db.query(Alert).filter(Alert.resolved_at != None)
    if phc_id:
        query = query.filter(Alert.phc_id == phc_id)
    return query.order_by(Alert.resolved_at.desc()).all()


@router.get("/inbox", response_model=List[AlertResponse])
def get_notification_inbox(
    phc_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role in ["ASHA Worker", "PHC Staff"]:
        phc_id = current_user.phc_id

    query = db.query(Alert).filter(Alert.resolved_at == None)
    if phc_id:
        query = query.filter(Alert.phc_id == phc_id)
    query = query.filter(_is_notification_alert(Alert))
    return query.order_by(Alert.created_at.desc()).all()


@router.get("/inbox/history", response_model=List[AlertResponse])
def get_notification_history(
    phc_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role in ["ASHA Worker", "PHC Staff"]:
        phc_id = current_user.phc_id

    query = db.query(Alert).filter(Alert.resolved_at != None)
    if phc_id:
        query = query.filter(Alert.phc_id == phc_id)
    query = query.filter(_is_notification_alert(Alert))
    return query.order_by(Alert.resolved_at.desc()).all()


@router.post("/broadcast")
def broadcast_message(
    payload: BroadcastMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role not in ["District Health Official", "System Admin"]:
        raise HTTPException(status_code=403, detail="Only DHO or System Admin can send broadcast messages.")
    if not payload.title.strip() or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Title and message are required.")
    total = _broadcast_message(db, current_user, payload)
    return {"detail": f"Broadcast delivered to {total} PHCs."}
