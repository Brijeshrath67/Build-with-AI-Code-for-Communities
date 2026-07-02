import os
import hashlib
import random
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

STANDARD_MEDICINES = [
    "Paracetamol 500mg", "Amoxicillin 500mg", "Ibuprofen 400mg",
    "Ciprofloxacin 500mg", "Cetirizine 10mg", "Metformin 500mg"
]

ALIAS_MAPPING = {
    "pcm": "Paracetamol 500mg", "pcm 500mg": "Paracetamol 500mg",
    "crocin": "Paracetamol 500mg", "dolo": "Paracetamol 500mg",
    "dolo 650": "Paracetamol 500mg", "paracetamol tab": "Paracetamol 500mg",
    "amox": "Amoxicillin 500mg", "amox 500": "Amoxicillin 500mg",
    "mox 500": "Amoxicillin 500mg", "amoxicillin capsule": "Amoxicillin 500mg",
    "ibugesic": "Ibuprofen 400mg", "ibu": "Ibuprofen 400mg",
    "cipro": "Ciprofloxacin 500mg",
    "cetirizine tab": "Cetirizine 10mg", "okacet": "Cetirizine 10mg",
    "glycomet": "Metformin 500mg", "metformin tab": "Metformin 500mg"
}

# Simple embedding function (deterministic, no model needed)
def _simple_embed(text: str, dim: int = 384) -> list:
    h = hashlib.md5(text.encode()).hexdigest()
    r = random.Random(h)
    vec = [r.gauss(0, 1) for _ in range(dim)]
    norm = sum(x*x for x in vec) ** 0.5
    return [x/norm for x in vec]


def _pgvector_lookup(query: str) -> dict | None:
    """Try pgvector semantic similarity via the API DB."""
    try:
        from sqlalchemy import create_engine, text
        db_url = os.getenv("DATABASE_URL", "postgresql://phc_user:phc_password@localhost:5432/phc_exchange")
        engine = create_engine(db_url)
        query_vec = _simple_embed(query.lower().strip())
        vec_str = "[" + ",".join(f"{v:.6f}" for v in query_vec) + "]"
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT standard_name, 1 - (embedding <=> :vec::vector) AS similarity
                    FROM medicine_mappings
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> :vec::vector
                    LIMIT 1
                """),
                {"vec": vec_str}
            ).first()
            if result and result[1] > 0.6:
                return {"query": query, "standard_name": result[0], "confidence": round(float(result[1]), 2), "method": "pgvector_semantic"}
    except Exception as e:
        print(f"pgvector lookup failed: {e}")
    return None


def resolve_medicine_name(query: str) -> dict:
    query_clean = query.strip().lower()

    # 1. Direct alias lookup
    if query_clean in ALIAS_MAPPING:
        return {"query": query, "standard_name": ALIAS_MAPPING[query_clean], "confidence": 1.0, "method": "alias_lookup"}

    # 2. Try pgvector semantic lookup
    vec_result = _pgvector_lookup(query)
    if vec_result:
        return vec_result

    # 3. Substring matching
    for alias, standard in ALIAS_MAPPING.items():
        if alias in query_clean or query_clean in alias:
            return {"query": query, "standard_name": standard, "confidence": 0.85, "method": "substring_match"}

    # 4. TF-IDF + Cosine Similarity Fallback
    all_names = STANDARD_MEDICINES + list(ALIAS_MAPPING.keys())
    vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4))
    tfidf_matrix = vectorizer.fit_transform(all_names)
    query_vector = vectorizer.transform([query_clean])
    similarities = cosine_similarity(query_vector, tfidf_matrix).flatten()
    best_idx = np.argmax(similarities)
    best_score = similarities[best_idx]

    if best_score >= 0.25:
        matched = all_names[best_idx]
        standard = ALIAS_MAPPING.get(matched, matched)
        return {"query": query, "standard_name": standard, "confidence": round(float(best_score), 2), "method": "tfidf_similarity"}

    return {"query": query, "standard_name": query, "confidence": 0.0, "method": "unmatched"}
