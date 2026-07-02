import json
import os
import re
from datetime import datetime, timedelta, timezone

import google.generativeai as genai


api_key = os.environ.get("GEMINI_API_KEY")
HAS_GEMINI = bool(api_key)
if HAS_GEMINI:
    genai.configure(api_key=api_key)


def parse_whatsapp_message(text: str) -> dict:
    """
    Parses unstructured WhatsApp stock report text into structured JSON.
    """
    if HAS_GEMINI:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = f"""
            You are a medical inventory parsing assistant.
            Extract:
            - medicine name with strength if present
            - quantity as an integer
            - expiry date in YYYY-MM-DD format

            If only month/year is present, use the last day of that month.
            If no year is present, assume 2026.
            If no expiry is found, use null.

            Message: "{text}"

            Return only raw JSON with keys: medicine, quantity, expiry_date.
            """
            response = model.generate_content(prompt)
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean_text)
            return {
                "medicine": parsed.get("medicine", "Unknown Medicine"),
                "quantity": int(parsed.get("quantity", 0)),
                "expiry_date": parsed.get("expiry_date"),
            }
        except Exception as exc:
            print(f"Gemini WhatsApp parsing failed, falling back to regex. Error: {exc}")

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

    return {
        "medicine": medicine,
        "quantity": quantity,
        "expiry_date": expiry_date,
    }


def answer_grounded_query(query: str, context: str) -> str:
    """
    Answers app-specific operational questions using only supplied database context.
    """
    if HAS_GEMINI:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = f"""
            You are the PHC Exchange assistant.
            Answer only questions about this app's data: inventory, stock, PHCs,
            users, doctors, ASHA workers, alerts, messages, transfers, transfer
            history, approvals, rejections, forecasts, redistribution, and dashboard
            summaries.

            Use only the live database context below. Do not answer unrelated
            general questions. If the context does not contain the answer, say:
            "I cannot find that in the current app data."

            Keep the answer concise and factual. Do not add greetings unless the
            user is greeting you.

            Live Database Context:
            {context}

            User Question: "{query}"
            """
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as exc:
            print(f"Gemini grounded query failed, falling back to local reasoning. Error: {exc}")

    query_lower = query.lower()
    lines = [line.strip() for line in context.split("\n") if line.strip()]

    if any(term in query_lower for term in ["hello", "hi", "help", "what can you do"]):
        return (
            "I can answer about stock, forecasts, alerts, transfer history, pending requests, "
            "PHCs, users, and doctor assignments from the app data."
        )

    if any(term in query_lower for term in ["last successful transfer", "latest successful transfer", "last completed transfer"]):
        for line in lines:
            lower = line.lower()
            if lower.startswith("latest completed transfer:") or lower.startswith("latest successful transfer:"):
                return line.split(":", 1)[1].strip()
        for line in lines:
            if "approved" in line.lower() or "completed" in line.lower():
                return line.replace("Transfer history: ", "").replace(" || ", "\n- ").strip()

    if any(
        term in query_lower
        for term in [
            "transfer history",
            "transfer ledger",
            "all transfers",
            "recent transfers",
            "history of transfer",
            "history of transfers",
            "tell me the history",
            "give me history",
            "of ours",
        ]
    ):
        summary = [
            line
            for line in lines
            if line.lower().startswith(("transfer ledger summary:", "transfer history:", "pending transfers:"))
        ]
        if summary:
            return "\n".join(item.replace(" || ", "\n- ") for item in summary)

    if any(term in query_lower for term in ["pending approval", "pending transfer", "pending request"]):
        for line in lines:
            if line.lower().startswith("pending transfers:"):
                return line
        return "No pending transfers are listed in the current app data."

    if any(term in query_lower for term in ["alert", "notification", "message from dho"]):
        for line in lines:
            if line.lower().startswith(("alerts summary:", "active alerts:", "alert history:", "notification history:")):
                return line

    keywords = [word for word in re.findall(r"[a-z0-9]+", query_lower) if len(word) > 2]
    matches = []
    for line in lines:
        lower = line.lower()
        score = sum(1 for word in keywords if word in lower)
        if score:
            matches.append((score, line))

    if matches:
        matches.sort(reverse=True, key=lambda item: item[0])
        return "\n".join(line for _, line in matches[:6])

    return "I cannot find that in the current app data."
