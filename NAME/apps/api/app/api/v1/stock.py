from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from apps.api.app.core.database import get_db
from apps.api.app.core.dependencies import get_current_active_user, RoleChecker
from apps.api.app.models.models import Stock, User
from apps.api.app.schemas.schemas import StockResponse, StockCreate, OfflineBatchSync
from datetime import datetime, timezone

router = APIRouter()

# Allow ASHA Workers, PHC Staff, District Officials, and Admins to view stock
@router.get("", response_model=List[StockResponse])
def list_stocks(
    phc_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if phc_id is not None:
        if current_user.role in ["ASHA Worker", "PHC Staff"] and current_user.phc_id != phc_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You only have access to view your own PHC's stock."
            )
        return db.query(Stock).filter(Stock.phc_id == phc_id).all()

    if current_user.role in ["District Health Official", "System Admin"]:
        stocks = db.query(Stock).all()
        return [
            {
                "id": s.id,
                "phc_id": s.phc_id,
                "phc_name": s.phc.name if s.phc else None,
                "medicine": s.medicine,
                "quantity": s.quantity,
                "expiry_date": s.expiry_date,
                "updated_at": s.updated_at,
                "sync_status": s.sync_status,
            }
            for s in stocks
        ]

    if current_user.role in ["ASHA Worker", "PHC Staff"]:
        if not current_user.phc_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not assigned to a PHC."
            )
        return db.query(Stock).filter(Stock.phc_id == current_user.phc_id).all()

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions to view stock."
    )

@router.get("/{phc_id}", response_model=List[StockResponse])
def get_phc_stock(
    phc_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # If the user is an ASHA Worker or PHC Staff, restrict them to their own PHC
    if current_user.role in ["ASHA Worker", "PHC Staff"] and current_user.phc_id != phc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You only have access to view your own PHC's stock."
        )
    return db.query(Stock).filter(Stock.phc_id == phc_id).all()

# Allow ASHA Workers, PHC Staff, Admins to update stock
@router.post("/update", response_model=StockResponse)
def update_stock(
    stock_in: StockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ASHA Worker", "PHC Staff", "System Admin"]))
):
    if not current_user.phc_id and current_user.role != "System Admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a PHC."
        )
    
    phc_id = current_user.phc_id if current_user.phc_id else 1 # Default for admin
    
    # Check if stock item already exists for this medicine and expiry date
    db_stock = db.query(Stock).filter(
        Stock.phc_id == phc_id,
        Stock.medicine == stock_in.medicine,
        Stock.expiry_date == stock_in.expiry_date
    ).first()
    
    if db_stock:
        db_stock.quantity = stock_in.quantity
        db_stock.updated_at = datetime.now(timezone.utc)
    else:
        db_stock = Stock(
            phc_id=phc_id,
            medicine=stock_in.medicine,
            quantity=stock_in.quantity,
            expiry_date=stock_in.expiry_date,
            sync_status="synced"
        )
        db.add(db_stock)
        
    db.commit()
    db.refresh(db_stock)
    return db_stock

# Batch sync for offline queued updates
@router.post("/sync/offline-batch", response_model=List[StockResponse])
def sync_offline_batch(
    payload: OfflineBatchSync,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["ASHA Worker", "PHC Staff", "System Admin"]))
):
    if current_user.role in ["ASHA Worker", "PHC Staff"] and current_user.phc_id != payload.phc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only sync offline batches for your own PHC."
        )
        
    synced_records = []
    for update in payload.updates:
        # Check if record exists
        db_stock = db.query(Stock).filter(
            Stock.phc_id == payload.phc_id,
            Stock.medicine == update.medicine,
            Stock.expiry_date == update.expiry_date
        ).first()
        
        if db_stock:
            # Only update if the incoming update is newer than local DB state
            # Note: since both use timestamps, this is clean LWW (Last-Write-Wins)
            if db_stock.updated_at is None or update.updated_at.replace(tzinfo=timezone.utc) > db_stock.updated_at.replace(tzinfo=timezone.utc):
                db_stock.quantity = update.quantity
                db_stock.updated_at = update.updated_at
                db_stock.sync_status = "synced"
        else:
            db_stock = Stock(
                phc_id=payload.phc_id,
                medicine=update.medicine,
                quantity=update.quantity,
                expiry_date=update.expiry_date,
                updated_at=update.updated_at,
                sync_status="synced"
            )
            db.add(db_stock)
            
        db.commit()
        if db_stock:
            db.refresh(db_stock)
            synced_records.append(db_stock)
            
    return synced_records


# ── DELETE stock item (requires password confirmation) ──────────────────────
from pydantic import BaseModel
from apps.api.app.core.security import verify_password

class DeleteStockRequest(BaseModel):
    password: str  # caller must re-supply their own password

@router.delete("/{stock_id}", status_code=status.HTTP_200_OK)
def delete_stock(
    stock_id: int,
    body: DeleteStockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["PHC Staff", "System Admin"]))
):
    """
    Hard-delete a stock row.
    Caller must provide their own login password as an extra confirmation step.
    Only PHC Staff (for their own PHC) and System Admins may delete.
    """
    # Re-verify caller password
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Deletion cancelled."
        )

    db_stock = db.query(Stock).filter(Stock.id == stock_id).first()
    if not db_stock:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock record not found.")

    # PHC Staff can only delete from their own PHC
    if current_user.role == "PHC Staff" and db_stock.phc_id != current_user.phc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete stock from your own PHC."
        )

    medicine_name = db_stock.medicine
    db.delete(db_stock)
    db.commit()
    return {"detail": f"Stock record for '{medicine_name}' (ID {stock_id}) deleted successfully."}
