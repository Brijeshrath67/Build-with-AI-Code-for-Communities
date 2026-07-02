from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# A list of standard medicines in the formulary
STANDARD_MEDICINES = [
    "Paracetamol 500mg",
    "Amoxicillin 500mg",
    "Ibuprofen 400mg",
    "Ciprofloxacin 500mg",
    "Cetirizine 10mg",
    "Metformin 500mg",
    "Amlodipine 5mg",
    "Atenolol 50mg",
    "Losartan 50mg",
    "Enalapril 5mg",
    "Hydrochlorothiazide 25mg",
    "Aspirin 75mg",
    "Atorvastatin 10mg",
    "Omeprazole 20mg",
    "Pantoprazole 40mg",
    "Ranitidine 150mg",
    "Domperidone 10mg",
    "Ondansetron 4mg",
    "Albendazole 400mg",
    "Azithromycin 500mg",
    "Doxycycline 100mg",
    "Cefixime 200mg",
    "Co-trimoxazole 480mg",
    "Fluconazole 150mg",
    "Clotrimazole Cream",
    "Mupirocin Ointment",
    "Povidone Iodine Solution",
    "Salbutamol Inhaler",
    "Budesonide Inhaler",
    "Montelukast 10mg",
    "Prednisolone 5mg",
    "Hydrocortisone Cream",
    "Ferrous Sulphate Tablet",
    "Folic Acid 5mg",
    "Calcium Carbonate 500mg",
    "Vitamin D3 60000 IU",
    "Vitamin B Complex",
    "Zinc Sulphate 20mg",
    "Chloroquine 250mg",
    "Artesunate 50mg",
    "Primaquine 15mg",
    "Insulin Regular",
    "Glimepiride 2mg",
    "Gliclazide 80mg",
    "Levothyroxine 50mcg",
    "Saline Nasal Drops",
    "Chlorpheniramine 4mg",
    "Dextromethorphan Syrup",
    "Ambroxol Syrup",
    "Loperamide 2mg",
    "Lactulose Syrup",
    "Bisacodyl 5mg",
    "Diclofenac Gel",
    "Tramadol 50mg",
    "Magnesium Hydroxide Suspension",
]

# Hardcoded alias-to-standard mapping for fast lookups
ALIAS_MAPPING = {
    "pcm": "Paracetamol 500mg",
    "pcm 500mg": "Paracetamol 500mg",
    "crocin": "Paracetamol 500mg",
    "dolo": "Paracetamol 500mg",
    "dolo 650": "Paracetamol 500mg",
    "paracetamol tab": "Paracetamol 500mg",
    "amox": "Amoxicillin 500mg",
    "amox 500": "Amoxicillin 500mg",
    "mox 500": "Amoxicillin 500mg",
    "amoxicillin capsule": "Amoxicillin 500mg",
    "ibugesic": "Ibuprofen 400mg",
    "ibu": "Ibuprofen 400mg",
    "cipro": "Ciprofloxacin 500mg",
    "cetirizine tab": "Cetirizine 10mg",
    "okacet": "Cetirizine 10mg",
    "glycomet": "Metformin 500mg",
    "metformin tab": "Metformin 500mg"
}

def resolve_medicine_name(query: str) -> dict:
    """
    Resolves an alias or unstructured medicine name to a standard name.
    Uses direct lookup first, and falls back to TF-IDF Cosine Similarity.
    """
    query_clean = query.strip().lower()

    for standard in STANDARD_MEDICINES:
        if query_clean == standard.lower():
            return {
                "query": query,
                "standard_name": standard,
                "confidence": 1.0,
                "method": "exact_standard_match"
            }
    
    # 1. Direct alias lookup
    if query_clean in ALIAS_MAPPING:
        return {
            "query": query,
            "standard_name": ALIAS_MAPPING[query_clean],
            "confidence": 1.0,
            "method": "alias_lookup"
        }
        
    # 2. Substring matching
    for alias, standard in ALIAS_MAPPING.items():
        if alias in query_clean or query_clean in alias:
            return {
                "query": query,
                "standard_name": standard,
                "confidence": 0.85,
                "method": "substring_match"
            }
            
    # 3. TF-IDF + Cosine Similarity Fallback
    all_names = STANDARD_MEDICINES + list(ALIAS_MAPPING.keys())
    vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4))
    tfidf_matrix = vectorizer.fit_transform(all_names)
    
    query_vector = vectorizer.transform([query_clean])
    similarities = cosine_similarity(query_vector, tfidf_matrix).flatten()
    
    best_idx = np.argmax(similarities)
    best_score = similarities[best_idx]
    
    if best_score >= 0.25: # Match threshold
        matched_name = all_names[best_idx]
        # Map back to standard name if the match was an alias
        standard_name = ALIAS_MAPPING.get(matched_name, matched_name)
        
        return {
            "query": query,
            "standard_name": standard_name,
            "confidence": round(float(best_score), 2),
            "method": "tfidf_similarity"
        }
        
    return {
        "query": query,
        "standard_name": query, # Return query name if unmatched
        "confidence": 0.0,
        "method": "unmatched"
    }
