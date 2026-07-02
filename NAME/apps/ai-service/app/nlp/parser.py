import os
import re
import json
from datetime import datetime, timezone, timedelta

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
_use_groq = bool(GROQ_API_KEY)


def _groq_prompt(system: str, user: str, model: str = "llama-3.3-70b-versatile") -> str:
    if not _use_groq:
        raise RuntimeError("Groq not configured")
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.1,
    )
    return resp.choices[0].message.content.strip()


def parse_whatsapp_message(text: str) -> dict:
    """Parses unstructured stock report text into structured JSON."""
    if _use_groq:
        try:
            system = "You extract medicine stock data from WhatsApp messages. Respond ONLY with valid JSON no markdown: {\"medicine\": string, \"quantity\": int, \"expiry_date\": \"YYYY-MM-DD\" or null}. Use standard medicine names like 'Paracetamol 500mg'. If no date found use null."
            raw = _groq_prompt(system, text)
            raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            return json.loads(raw)
        except Exception:
            pass

    medicine = "Unknown Medicine"
    quantity = 0
    expiry_date = None
    body_lower = text.lower()

    qty_match = re.search(r"\b(\d+)\b", text)
    if qty_match:
        quantity = int(qty_match.group(1))
    if "paracetamol" in body_lower or "pcm" in body_lower or "crocin" in body_lower:
        medicine = "Paracetamol 500mg"
    elif "amoxicillin" in body_lower or "amox" in body_lower or "mox" in body_lower:
        medicine = "Amoxicillin 500mg"
    elif "ibuprofen" in body_lower or "ibu" in body_lower:
        medicine = "Ibuprofen 400mg"
    elif "cetirizine" in body_lower or "okacet" in body_lower:
        medicine = "Cetirizine 10mg"
    date_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
    if date_match:
        expiry_date = date_match.group(1)
    else:
        expiry_date = (datetime.now(timezone.utc) + timedelta(days=180)).date().strftime("%Y-%m-%d")
    return {"medicine": medicine, "quantity": quantity, "expiry_date": expiry_date}


def answer_grounded_query(query: str, context: str) -> str:
    """Answers a natural-language query using database context as grounding."""
    if _use_groq:
        try:
            system = "You are a PHC Exchange assistant. Answer naturally and helpfully using the provided context. The context includes live stock levels, transfer history, health centre information, and AI forecasts. If the user asks something not in the context, use your general knowledge to help them, but clearly note when you're not relying on live data."
            raw = _groq_prompt(system, f"Context:\n{context}\n\nQuestion: {query}")
            return raw
        except Exception:
            pass

    query_lower = query.lower()
    if "hello" in query_lower or "hi" in query_lower:
        return "Hello! I am your PHC Exchange Assistant. I help track local inventory and recommend lateral transfers. How can I assist you today?"
    matching_info = []
    lines = context.split("\n")
    for line in lines:
        keywords = [w for w in query_lower.split() if len(w) > 3]
        if any(kw in line.lower() for kw in keywords):
            matching_info.append(line)
    if matching_info:
        return f"Based on live network data:\n" + "\n".join([f"- {info}" for info in matching_info])
    return "I couldn't find a direct answer in the current database context. Could you specify which medicine or PHC?"
