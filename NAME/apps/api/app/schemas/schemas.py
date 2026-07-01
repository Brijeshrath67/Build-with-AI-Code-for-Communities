from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import List, Optional

# --- Auth Schemas ---
class UserLogin(BaseModel):
    phone: str
    password: str

class UserCreate(BaseModel):
    name: str
    phone: str
    password: str
    role: str # 'ASHA Worker', 'PHC Staff', 'District Health Official', 'System Admin'
    phc_id: Optional[int] = None

class UserResponse(BaseModel):
    id: int
    name: str
    phone: str
    role: str
    phc_id: Optional[int]
    status: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    phone: Optional[str] = None
    role: Optional[str] = None

# --- PHC Schema ---
class PHCResponse(BaseModel):
    id: int
    name: str
    district: str
    latitude: float
    longitude: float
    type: str

    class Config:
        from_attributes = True

# --- Stock Schemas ---
class StockCreate(BaseModel):
    medicine: str
    quantity: int
    expiry_date: date

class StockUpdate(BaseModel):
    quantity: int
    expiry_date: date

class StockResponse(BaseModel):
    id: int
    phc_id: int
    medicine: str
    quantity: int
    expiry_date: date
    updated_at: datetime
    sync_status: str

    class Config:
        from_attributes = True

class OfflineStockUpdate(BaseModel):
    medicine: str
    quantity: int
    expiry_date: date
    updated_at: datetime

class OfflineBatchSync(BaseModel):
    phc_id: int
    updates: List[OfflineStockUpdate]

# --- Transfer Schemas ---
class TransferCreate(BaseModel):
    source_phc_id: int
    destination_phc_id: int
    medicine: str
    quantity: int

class TransferUpdate(BaseModel):
    status: str # 'approved', 'rejected', 'in_transit', 'completed'

class TransferResponse(BaseModel):
    id: int
    source_phc_id: int
    source_phc: PHCResponse
    destination_phc_id: int
    destination_phc: PHCResponse
    medicine: str
    quantity: int
    status: str
    created_at: datetime
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Forecast Schemas ---
class ForecastResponse(BaseModel):
    id: int
    phc_id: int
    medicine: str
    risk_score: str
    stockout_date: date
    predicted_at: datetime

    class Config:
        from_attributes = True

# --- Alert Schemas ---
class AlertResponse(BaseModel):
    id: int
    phc_id: int
    message: str
    severity: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Match Engine Schemas ---
class MatchItem(BaseModel):
    phc_id: int
    phc_name: str
    distance_km: float
    available_surplus: int
    expiry_date: date
    similarity_score: float

class MatchResponse(BaseModel):
    medicine: str
    required_quantity: int
    recommendations: List[MatchItem]

# --- Dashboard Schemas ---
class DashboardStockSummary(BaseModel):
    medicine: str
    total_quantity: int
    shortage_phcs_count: int
    surplus_phcs_count: int

class DistrictDashboardResponse(BaseModel):
    district_name: str
    total_phcs: int
    total_stockouts_predicted: int
    active_alerts_count: int
    pending_transfers_count: int
    stock_summaries: List[DashboardStockSummary]
    recent_transfers: List[TransferResponse]

# --- NLP Query Schemas ---
class NaturalQueryRequest(BaseModel):
    query: str
    phc_id: Optional[int] = None

class NaturalQueryResponse(BaseModel):
    answer: str
    grounding_data: Optional[dict] = None
