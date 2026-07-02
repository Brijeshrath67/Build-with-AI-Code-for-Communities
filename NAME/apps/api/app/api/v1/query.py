from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
import requests
from apps.api.app.core.database import get_db
from apps.api.app.core.config import settings
from apps.api.app.core.dependencies import get_current_active_user
from apps.api.app.models.models import Stock, PHC, Transfer, User, Forecast
from apps.api.app.schemas.schemas import NaturalQueryRequest, NaturalQueryResponse

router = APIRouter()

@router.post("", response_model=NaturalQueryResponse)
def handle_natural_language_query(
    request: NaturalQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    phc_id = current_user.phc_id if current_user.phc_id else request.phc_id
    
    # 1. Gather Grounding Context from DB
    context_parts = []
    
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
        
    # List of all PHCs and their locations
    all_phcs = db.query(PHC).all()
    phc_list = ", ".join([f"{p.name} in {p.district} at ({p.latitude}, {p.longitude})" for p in all_phcs])
    context_parts.append(f"Health Centre network: {phc_list}.")
    
    # Active transfers
    transfers = db.query(Transfer).filter(Transfer.status.in_(["pending", "in_transit"])).all()
    transfer_list = ", ".join([f"{t.quantity} units of {t.medicine} from PHC {t.source_phc_id} to PHC {t.destination_phc_id} (status: {t.status})" for t in transfers])
    context_parts.append(f"Active transfers in progress: {transfer_list if transfer_list else 'None'}.")

    # Recent completed transfers
    completed = db.query(Transfer).filter(Transfer.status == "completed").order_by(Transfer.approved_at.desc()).limit(10).all()
    if completed:
        completed_list = ", ".join([
            f"{t.quantity} units of {t.medicine} from PHC {t.source_phc_id} to PHC {t.destination_phc_id} (completed at {t.approved_at})"
            for t in completed
        ])
        context_parts.append(f"Recent completed transfers: {completed_list}.")
    else:
        context_parts.append("No completed transfers found.")
    
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
