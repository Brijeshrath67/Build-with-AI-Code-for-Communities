from fastapi import APIRouter, Depends, HTTPException, Form, Response, status
from sqlalchemy.orm import Session
import requests
import re
from datetime import datetime, timezone, timedelta
from apps.api.app.core.database import get_db
from apps.api.app.core.config import settings
from apps.api.app.models.models import User, Stock, PHC
import xml.etree.ElementTree as ET

router = APIRouter()

def build_twiml_response(message: str) -> Response:
    # Build standard Twilio TwiML XML response
    response_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{message}</Message>
</Response>"""
    return Response(content=response_xml, media_type="application/xml")

@router.post("/webhook")
def twilio_whatsapp_webhook(
    From: str = Form(...),
    Body: str = Form(...),
    db: Session = Depends(get_db)
):
    # Normalize phone number (extract digits, match last 10 characters)
    digits = re.sub(r"\D", "", From)
    if len(digits) < 10:
        return build_twiml_response("Error: Invalid sender phone number format.")
        
    phone_last_10 = digits[-10:]
    
    # Identify sender
    user = db.query(User).filter(User.phone.like(f"%{phone_last_10}")).first()
    if not user:
        return build_twiml_response(f"Error: Phone number {phone_last_10} is not registered in the PHC Exchange system. Please contact your administrator.")
        
    if not user.phc_id:
        return build_twiml_response(f"Hello {user.name}, you are registered but not assigned to a specific PHC. Stock updates can only be received from PHC-assigned staff.")
        
    phc = db.query(PHC).filter(PHC.id == user.phc_id).first()
    phc_name = phc.name if phc else "your PHC"
    
    # Step 1: Parse the message (AI microservice or local regex fallback)
    medicine = None
    quantity = None
    expiry_date = None
    confidence = 1.0
    
    try:
        # Request parsing from AI service
        response = requests.post(
            f"{settings.AI_SERVICE_URL}/api/v1/ai/nlp/parse",
            json={"text": Body},
            timeout=2.0
        )
        if response.status_code == 200:
            parsed = response.json()
            medicine = parsed.get("medicine")
            quantity = parsed.get("quantity")
            exp_str = parsed.get("expiry_date")
            if exp_str:
                expiry_date = datetime.strptime(exp_str, "%Y-%m-%d").date()
    except Exception:
        pass
        
    # Local Regex Fallback parsing
    if not medicine or quantity is None:
        # Look for numbers (quantity)
        qty_match = re.search(r"\b(\d+)\b", Body)
        if qty_match:
            quantity = int(qty_match.group(1))
            
        # Look for medicine keywords
        body_lower = Body.lower()
        if "paracetamol" in body_lower or "pcm" in body_lower or "crocin" in body_lower:
            medicine = "Paracetamol 500mg"
        elif "amoxicillin" in body_lower or "amox" in body_lower or "mox" in body_lower:
            medicine = "Amoxicillin 500mg"
        else:
            medicine = "Unknown Medicine"
            
        # Look for expiry date or default to 6 months from now
        date_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", Body)
        if date_match:
            try:
                expiry_date = datetime.strptime(date_match.group(1), "%Y-%m-%d").date()
            except ValueError:
                pass
        
        if not expiry_date:
            # Default to 6 months from now
            expiry_date = (datetime.now(timezone.utc) + timedelta(days=180)).date()
            
    if medicine == "Unknown Medicine" or quantity is None:
        return build_twiml_response(
            f"Hello {user.name}. We couldn't parse your update. Please format like: 'Received 500 units of Paracetamol expiring 2026-12-31' or 'Update Paracetamol to 150'."
        )
        
    # Step 2: Apply Update to database
    db_stock = db.query(Stock).filter(
        Stock.phc_id == user.phc_id,
        Stock.medicine == medicine,
        Stock.expiry_date == expiry_date
    ).first()
    
    if db_stock:
        db_stock.quantity = quantity
        db_stock.updated_at = datetime.now(timezone.utc)
    else:
        db_stock = Stock(
            phc_id=user.phc_id,
            medicine=medicine,
            quantity=quantity,
            expiry_date=expiry_date,
            sync_status="synced"
        )
        db.add(db_stock)
        
    db.commit()
    
    # Return confirmation message
    reply_msg = f"Success! Stock updated for {phc_name}: {quantity} units of {medicine} (Expires: {expiry_date}). Thank you for reporting, {user.name}."
    return build_twiml_response(reply_msg)
