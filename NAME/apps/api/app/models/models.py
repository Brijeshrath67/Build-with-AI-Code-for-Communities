from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from apps.api.app.core.database import Base

class PHC(Base):
    __tablename__ = "phcs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    district = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    type = Column(String, nullable=False) # 'UPHC', 'CHC', 'PHC'

    users = relationship("User", back_populates="phc")
    stocks = relationship("Stock", back_populates="phc", cascade="all, delete-orphan")
    incoming_transfers = relationship("Transfer", foreign_keys="Transfer.destination_phc_id", back_populates="destination_phc")
    outgoing_transfers = relationship("Transfer", foreign_keys="Transfer.source_phc_id", back_populates="source_phc")
    forecasts = relationship("Forecast", back_populates="phc", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="phc", cascade="all, delete-orphan")
    feature_snapshots = relationship("FeatureSnapshot", back_populates="phc", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False) # 'ASHA Worker', 'PHC Staff', 'District Health Official', 'System Admin'
    phone = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    phc_id = Column(Integer, ForeignKey("phcs.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, default="active")

    phc = relationship("PHC", back_populates="users")
    approved_transfers = relationship("Transfer", back_populates="approver")

class Stock(Base):
    __tablename__ = "stock"

    id = Column(Integer, primary_key=True, index=True)
    phc_id = Column(Integer, ForeignKey("phcs.id", ondelete="CASCADE"), nullable=False)
    medicine = Column(String, nullable=False)
    quantity = Column(Integer, default=0, nullable=False)
    expiry_date = Column(Date, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    sync_status = Column(String, default="synced") # 'synced', 'pending_offline'

    phc = relationship("PHC", back_populates="stocks")

class FeatureSnapshot(Base):
    __tablename__ = "feature_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    phc_id = Column(Integer, ForeignKey("phcs.id", ondelete="CASCADE"), nullable=False)
    medicine = Column(String, nullable=False)
    consumption_rate = Column(Float, default=0.0, nullable=False)
    seasonal_index = Column(Float, default=1.0, nullable=False)
    disease_trend_signal = Column(Float, default=0.0, nullable=False)
    captured_at = Column(DateTime(timezone=True), default=func.now())

    phc = relationship("PHC", back_populates="feature_snapshots")

class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(Integer, primary_key=True, index=True)
    phc_id = Column(Integer, ForeignKey("phcs.id", ondelete="CASCADE"), nullable=False)
    medicine = Column(String, nullable=False)
    risk_score = Column(String, nullable=False) # 'LOW', 'MEDIUM', 'HIGH'
    stockout_date = Column(Date, nullable=False)
    predicted_at = Column(DateTime(timezone=True), default=func.now())
    feature_snapshot_id = Column(Integer, ForeignKey("feature_snapshots.id", ondelete="SET NULL"), nullable=True)

    phc = relationship("PHC", back_populates="forecasts")

class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, index=True)
    source_phc_id = Column(Integer, ForeignKey("phcs.id", ondelete="CASCADE"), nullable=False)
    destination_phc_id = Column(Integer, ForeignKey("phcs.id", ondelete="CASCADE"), nullable=False)
    medicine = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(String, default="pending", nullable=False) # 'pending', 'approved', 'rejected', 'in_transit', 'completed'
    created_at = Column(DateTime(timezone=True), default=func.now())
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    source_phc = relationship("PHC", foreign_keys=[source_phc_id], back_populates="outgoing_transfers")
    destination_phc = relationship("PHC", foreign_keys=[destination_phc_id], back_populates="incoming_transfers")
    approver = relationship("User", back_populates="approved_transfers")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    phc_id = Column(Integer, ForeignKey("phcs.id", ondelete="CASCADE"), nullable=False)
    message = Column(String, nullable=False)
    severity = Column(String, nullable=False) # 'low', 'medium', 'high'
    created_at = Column(DateTime(timezone=True), default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    phc = relationship("PHC", back_populates="alerts")

class MedicineMapping(Base):
    __tablename__ = "medicine_mappings"

    id = Column(Integer, primary_key=True, index=True)
    alias_name = Column(String, unique=True, nullable=False)
    standard_name = Column(String, nullable=False)
    embedding = Column(ARRAY(Float), nullable=True) # Vector representation fallback
