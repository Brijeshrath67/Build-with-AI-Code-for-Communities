from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
import requests
from apps.api.app.core.database import get_db
from apps.api.app.core.config import settings
from apps.api.app.core.dependencies import get_current_active_user
from apps.api.app.models.models import Stock, PHC, Transfer, User, Forecast, Alert
from apps.api.app.schemas.schemas import NaturalQueryRequest, NaturalQueryResponse

router = APIRouter()


def _format_transfer_line(transfer: Transfer) -> str:
    status_bits = [transfer.status]
    if transfer.approved_at:
        status_bits.append(f"updated {transfer.approved_at.isoformat()}")
    if transfer.decline_reason:
        status_bits.append(f"reason: {transfer.decline_reason}")
    if transfer.message:
        status_bits.append(f"message: {transfer.message}")
    if transfer.requested_expiry_date:
        status_bits.append(f"requested expiry: {transfer.requested_expiry_date}")
    source_name = transfer.source_phc.name if transfer.source_phc else f"PHC {transfer.source_phc_id}"
    dest_name = transfer.destination_phc.name if transfer.destination_phc else f"PHC {transfer.destination_phc_id}"
    return (
        f"Transfer #{transfer.id} | {source_name} -> {dest_name} | "
        f"{transfer.quantity} units of {transfer.medicine} | " + " | ".join(status_bits)
    )


def _format_alert_line(alert: Alert) -> str:
    status = "active" if alert.resolved_at is None else f"resolved {alert.resolved_at.isoformat()}"
    return f"Alert #{alert.id} | PHC {alert.phc_id} | {alert.severity} | {status} | {alert.message}"


def _summarize_transfer_history(transfers: list[Transfer]) -> str:
    if not transfers:
        return "No transfer history found in the current app data."

    completed = [t for t in transfers if t.status == "completed"]
    rejected = [t for t in transfers if t.status == "rejected"]
    pending = [t for t in transfers if t.status == "pending"]

    lines = [
        f"Transfer history: {len(transfers)} records total",
        f"Completed: {len(completed)}",
        f"Rejected: {len(rejected)}",
        f"Pending: {len(pending)}",
    ]

    latest = transfers[0]
    lines.append(f"Latest transfer: {_format_transfer_line(latest)}")

    recent_items = transfers[:5]
    lines.append("Recent records:")
    lines.extend([f"- {_format_transfer_line(t)}" for t in recent_items])
    return "\n".join(lines)

@router.post("", response_model=NaturalQueryResponse)
def handle_natural_language_query(
    request: NaturalQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    phc_id = current_user.phc_id if current_user.phc_id else request.phc_id
    
    # 1. Gather Grounding Context from DB
    context_parts = []
    query_lower = request.query.lower()
    wants_transfer_history = any(term in query_lower for term in [
        "transfer history",
        "transfers history",
        "history of transfer",
        "history of transfers",
        "tell me the history",
        "show history",
        "give me history",
        "transfer history of ours",
        "our transfer history",
        "transfer ledger",
        "ledger",
        "last successful transfer",
        "last completed transfer",
        "last transfer",
        "transfer history",
        "successful transfer",
    ])
    if "history" in query_lower and not any(term in query_lower for term in ["alert history", "notification history", "network history"]):
        wants_transfer_history = True if current_user.role == "PHC Staff" else wants_transfer_history
    mentions_transfer = "transfer" in query_lower or "transfers" in query_lower or "ledger" in query_lower
    want_alerts = any(term in query_lower for term in [
        "alert", "alerts", "notification", "notifications"
    ])
    want_network = any(term in query_lower for term in [
        "phc", "facility", "network", "doctor", "doctors"
    ])
    
    # User location info
    if phc_id:
        user_phc = db.query(PHC).filter(PHC.id == phc_id).first()
        if user_phc:
            context_parts.append(f"User is located at Primary Health Centre: {user_phc.name} in district: {user_phc.district}. Location coordinates: ({user_phc.latitude}, {user_phc.longitude}).")
            
            # Local stocks
            stocks = db.query(Stock).filter(Stock.phc_id == phc_id).all()
            stock_list = ", ".join([f"{s.medicine} ({s.quantity} units, expires {s.expiry_date})" for s in stocks])
            context_parts.append(f"Current stock at {user_phc.name}: {stock_list if stock_list else 'No stock recorded'}.")
            
            # Local forecasts
            forecasts = db.query(Forecast).filter(Forecast.phc_id == phc_id).all()
            forecast_list = ", ".join([f"{f.medicine} (risk: {f.risk_score}, stockout expected: {f.stockout_date})" for f in forecasts])
            context_parts.append(f"AI Stockout forecasts for {user_phc.name}: {forecast_list if forecast_list else 'No upcoming stockouts predicted'}.")
    else:
        context_parts.append("User is a district/admin official with oversight of all PHCs.")

    # District-wide counts and snapshots
    all_phcs_query = db.query(PHC)
    if phc_id:
        current_phc = db.query(PHC).filter(PHC.id == phc_id).first()
        if current_phc:
            all_phcs_query = all_phcs_query.filter(PHC.district == current_phc.district)
    all_phcs = all_phcs_query.order_by(PHC.id).all()
    phc_list = ", ".join([f"PHC #{p.id}: {p.name} in {p.district} at ({p.latitude}, {p.longitude})" for p in all_phcs[:25]])
    context_parts.append(f"Health centre network snapshot: {phc_list}.")

    if want_network or not phc_id:
        doctor_count = db.query(User).filter(User.role == "PHC Staff").count()
        context_parts.append(f"Network summary: {len(all_phcs)} PHCs visible in scope, {doctor_count} PHC staff accounts in total.")

    # Transfer history and active transfers
    transfer_query = db.query(Transfer).options(
        joinedload(Transfer.source_phc),
        joinedload(Transfer.destination_phc)
    )
    if phc_id:
        transfer_query = transfer_query.filter(
            (Transfer.source_phc_id == phc_id) | (Transfer.destination_phc_id == phc_id)
        )
    transfers = transfer_query.order_by(Transfer.created_at.desc()).limit(20).all()
    if wants_transfer_history:
        return NaturalQueryResponse(
            answer=_summarize_transfer_history(transfers),
            grounding_data={
                "transfer_history_requested": True,
                "records_used": len(transfers),
            }
        )
    if mentions_transfer or transfers:
        pending_transfers = [t for t in transfers if t.status == "pending"]
        finished_transfers = [t for t in transfers if t.status in ["completed", "rejected"]]
        context_parts.append(
            "Transfer ledger summary: "
            f"{len(transfers)} recent transfers; {len(pending_transfers)} pending; {len(finished_transfers)} completed/rejected."
        )
        if finished_transfers:
            context_parts.append(f"Latest completed/rejected transfer: {_format_transfer_line(finished_transfers[0])}.")
        if pending_transfers:
            context_parts.append(f"Latest pending transfer: {_format_transfer_line(pending_transfers[0])}.")
        if pending_transfers:
            context_parts.append("Pending transfers: " + " || ".join(_format_transfer_line(t) for t in pending_transfers[:8]))
        if finished_transfers:
            context_parts.append("Transfer history: " + " || ".join(_format_transfer_line(t) for t in finished_transfers[:8]))

    # Alerts and notification history
    alert_query = db.query(Alert)
    if phc_id:
        alert_query = alert_query.filter(Alert.phc_id == phc_id)
    active_alerts = alert_query.filter(Alert.resolved_at == None).order_by(Alert.created_at.desc()).limit(10).all()
    history_alerts = alert_query.filter(Alert.resolved_at != None).order_by(Alert.resolved_at.desc()).limit(10).all()
    if want_alerts or active_alerts or history_alerts:
        context_parts.append(
            f"Alerts summary: {len(active_alerts)} active alerts and {len(history_alerts)} recent resolved alerts in scope."
        )
        if active_alerts:
            context_parts.append("Active alerts: " + " || ".join(_format_alert_line(a) for a in active_alerts))
        if history_alerts:
            context_parts.append("Alert history: " + " || ".join(_format_alert_line(a) for a in history_alerts))
    
    db_context = "\n".join(context_parts)
    
    # 2. Attempt to contact the AI Service for LLM-grounded response
    try:
        response = requests.post(
            f"{settings.AI_SERVICE_URL}/api/v1/ai/nlp/query",
            json={
                "query": request.query,
                "context": db_context
            },
            timeout=3.0
        )
        if response.status_code == 200:
            return NaturalQueryResponse(
                answer=response.json().get("answer", "No answer received."),
                grounding_data={"context_used": db_context}
            )
    except Exception as e:
        print(f"AI Service NLP Query failed, executing local heuristic parser. Error: {e}")
        
    # 3. Local Heuristic Fallback Responder
    query_lower = request.query.lower()
    answer_text = "I'm sorry, I couldn't process your query. Could you please rephrase?"
    
    # Find matching medicine name from stock
    matched_med = None
    if "paracetamol" in query_lower or "pcm" in query_lower or "crocin" in query_lower:
        matched_med = "Paracetamol 500mg"
    elif "amoxicillin" in query_lower or "amox" in query_lower or "mox" in query_lower:
        matched_med = "Amoxicillin 500mg"
        
    if "stockout" in query_lower or "shortage" in query_lower or "out of stock" in query_lower:
        if phc_id:
            # Check for low stocks
            low_stocks = db.query(Stock).filter(Stock.phc_id == phc_id, Stock.quantity <= 20).all()
            if low_stocks:
                items = ", ".join([f"{s.medicine} ({s.quantity} units left)" for s in low_stocks])
                answer_text = f"Yes, there is a stockout risk at your health centre for: {items}."
            else:
                answer_text = "All medicine stock levels at your health centre are currently stable and above safety thresholds."
        else:
            # District level check
            all_stocks = db.query(Stock).filter(Stock.quantity <= 20).all()
            if all_stocks:
                items = ", ".join([f"{s.medicine} at PHC {s.phc_id} ({s.quantity} units left)" for s in all_stocks])
                answer_text = f"District-wide shortage alert: The following centres have low stocks: {items}."
            else:
                answer_text = "No critical shortages detected across the district."
                
    elif "surplus" in query_lower or "excess" in query_lower or "spare" in query_lower or "transfer" in query_lower:
        if matched_med:
            # Search other PHCs for excess stock
            surpluses = db.query(Stock).filter(Stock.medicine == matched_med, Stock.quantity >= 300).all()
            if surpluses:
                details = []
                for s in surpluses:
                    p = db.query(PHC).filter(PHC.id == s.phc_id).first()
                    details.append(f"{p.name} ({s.quantity} units, {s.expiry_date})")
                answer_text = f"The following centers have a surplus of {matched_med}: {', '.join(details)}."
            else:
                answer_text = f"No centers currently report a surplus of {matched_med}."
        else:
            answer_text = "To search for surpluses, please specify a medicine, e.g. 'Who has surplus Paracetamol?'"
            
    elif matched_med:
        # User is asking about a specific medicine's stock
        if phc_id:
            s_item = db.query(Stock).filter(Stock.phc_id == phc_id, Stock.medicine == matched_med).first()
            if s_item:
                answer_text = f"Your current stock of {matched_med} is {s_item.quantity} units, expiring on {s_item.expiry_date}."
            else:
                answer_text = f"You do not have any recorded stock of {matched_med}."
        else:
            all_qty = db.query(func.sum(Stock.quantity)).filter(Stock.medicine == matched_med).scalar() or 0
            answer_text = f"Total inventory of {matched_med} across the district is {all_qty} units."
            
    elif "hello" in query_lower or "hi" in query_lower or "help" in query_lower:
        answer_text = "Hello! I am your PHC Exchange Assistant. You can ask me questions like:\n- 'Do we have any paracetamol left?'\n- 'Who has surplus Amoxicillin?'\n- 'Which medicines are running low?'"

    return NaturalQueryResponse(
        answer=answer_text,
        grounding_data={"heuristic_used": True, "context": db_context}
    )
