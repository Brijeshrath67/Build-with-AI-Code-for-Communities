import os
import re
import json
from datetime import datetime, timezone, timedelta
import google.generativeai as genai

# Setup Gemini API key
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
    HAS_GEMINI = True
else:
    HAS_GEMINI = False

def parse_whatsapp_message(text: str) -> dict:
    """
    Parses unstructured WhatsApp stock report text into structured JSON:
    { "medicine": str, "quantity": int, "expiry_date": str (YYYY-MM-DD) }
    """
    if HAS_GEMINI:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = f"""
            You are a medical inventory parsing assistant.
            Extract the following details from this WhatsApp message:
            - Medicine name (with strength/mg if available, e.g. "Paracetamol 500mg")
            - Quantity (integer number of units/tablets)
            - Expiry date in YYYY-MM-DD format (if only year/month is provided, use the last day of that month. If no year is provided, assume the current year is 2026. If no expiry is found, leave it blank).
            
            WhatsApp message: "{text}"
            
            Return the output STRICTLY as a raw JSON object with the keys "medicine", "quantity", and "expiry_date". Do not include markdown code block formatting.
            """
            response = model.generate_content(prompt)
            # Remove any potential markdown formatting
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean_text)
            
            # Ensure keys exist
            return {
                "medicine": parsed.get("medicine", "Unknown Medicine"),
                "quantity": int(parsed.get("quantity", 0)),
                "expiry_date": parsed.get("expiry_date", None)
            }
        except Exception as e:
            print(f"Gemini WhatsApp parsing failed, falling back to regex. Error: {e}")

    # --- Rule-based Fallback Parser ---
    medicine = "Unknown Medicine"
    quantity = 0
    expiry_date = None
    
    body_lower = text.lower()
    
    # 1. Quantity extraction
    qty_match = re.search(r"\b(\d+)\b", text)
    if qty_match:
        quantity = int(qty_match.group(1))
        
    # 2. Medicine extraction
    if "paracetamol" in body_lower or "pcm" in body_lower or "crocin" in body_lower:
        medicine = "Paracetamol 500mg"
    elif "amoxicillin" in body_lower or "amox" in body_lower or "mox" in body_lower:
        medicine = "Amoxicillin 500mg"
    elif "ibuprofen" in body_lower or "ibu" in body_lower:
        medicine = "Ibuprofen 400mg"
    elif "cetirizine" in body_lower or "okacet" in body_lower:
        medicine = "Cetirizine 10mg"
        
    # 3. Expiry date extraction
    date_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
    if date_match:
        expiry_date = date_match.group(1)
    else:
        # Default to 6 months from now
        expiry_date = (datetime.now(timezone.utc) + timedelta(days=180)).date().strftime("%Y-%m-%d")
        
    return {
        "medicine": medicine,
        "quantity": quantity,
        "expiry_date": expiry_date
    }

def answer_grounded_query(query: str, context: str) -> str:
    """
    Answers a natural-language operational query using database context as grounding.
    """
    if HAS_GEMINI:
        try:
<<<<<<< Updated upstream
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = f"""
            You are a helpful AI logistics assistant for the Primary Health Centre (PHC) Supply Redistribution Network.
            Answer the user's question using ONLY the provided live database context.
            If the question cannot be answered using the context, state that you don't have enough data, but attempt to guide the user using what is available.
            Keep your answer concise, polite, and direct.
            
            Live Database Context:
            {context}
            
            User Question: "{query}"
            """
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Gemini grounded query failed, falling back to local reasoning. Error: {e}")
            
    # --- Local Reasoning Fallback ---
    # Parse query and match against context lines
    query_lower = query.lower()
    
    if "hello" in query_lower or "hi" in query_lower:
        return "Hello! I am your PHC Exchange Assistant. I help track local inventory and recommend lateral transfers. How can I assist you today?"
        
    # Search for matching lines in context
    matching_info = []
    lines = context.split("\n")
    for line in lines:
        # If line contains keywords from the query
        keywords = [w for w in query_lower.split() if len(w) > 3]
        if any(kw in line.lower() for kw in keywords):
            matching_info.append(line)
            
    if matching_info:
        return f"Based on live network data:\n" + "\n".join([f"- {info}" for info in matching_info])
        
    return "I couldn't find a direct answer in the current database context. Could you please specify which medicine or PHC you are asking about?"
=======
            system = (
                "You are a PHC Exchange assistant. Answer using ONLY the provided context. "
                "Be concise, direct, and factual. Do not add greetings, filler, or extra explanation. "
                "If the context does not contain the answer, say you cannot find it in the current app data."
            )
            raw = _groq_prompt(system, f"Context:\n{context}\n\nQuestion: {query}")
            return raw.strip()
        except Exception:
            pass

    query_lower = query.lower()
    lines = [line.strip() for line in context.split("\n") if line.strip()]
    keywords = [w for w in re.findall(r"[a-z0-9]+", query_lower) if len(w) > 2]

    def section_score(line: str) -> int:
        score = 0
        lower = line.lower()
        for kw in keywords:
            if kw in lower:
                score += 1
        return score

    scored = sorted(((section_score(line), idx, line) for idx, line in enumerate(lines)), reverse=True)
    best_matches = [line for score, _, line in scored if score > 0][:6]

    if any(term in query_lower for term in ["last successful transfer", "latest successful transfer", "last completed transfer"]):
        for line in lines:
            if line.lower().startswith("latest completed/rejected transfer:"):
                return line.removeprefix("Latest completed/rejected transfer: ").strip()
        for line in lines:
            if line.lower().startswith("transfer history:") or "completed" in line.lower():
                return line.replace("Transfer history: ", "").replace(" || ", "\n- ").strip()

    if any(term in query_lower for term in ["transfer history", "transfer ledger", "all transfers", "recent transfers", "history of transfer", "history of transfers", "tell me the history", "give me history", "our transfer history"]):
        for line in lines:
            if line.lower().startswith("transfer ledger summary:"):
                summary = [line]
                for item in lines:
                    if item.lower().startswith("transfer history:") or item.lower().startswith("pending transfers:"):
                        summary.append(item)
                return "\n".join(summary)
            if line.lower().startswith("transfer history:"):
                return line.replace("Transfer history: ", "").replace(" || ", "\n- ").strip()

    if any(term in query_lower for term in ["alert history", "notification history", "alerts"]):
        for line in lines:
            if line.lower().startswith("alerts summary:") or line.lower().startswith("active alerts:") or line.lower().startswith("alert history:"):
                return line

    if best_matches:
        return "\n".join(best_matches)

    if any(term in query_lower for term in ["hello", "hi", "help", "what can you do"]):
        return (
            "I can answer about stock, forecasts, alerts, transfer history, pending requests, PHCs, and doctor assignments. "
            "Ask a specific question and I’ll answer from the app data."
        )

    return "I cannot find that in the current app data."
>>>>>>> Stashed changes
