from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from apps.api.app.core.database import get_db
from apps.api.app.core.dependencies import get_current_active_user, RoleChecker
from apps.api.app.models.models import Transfer, Stock, User, PHC
from apps.api.app.schemas.schemas import TransferResponse, TransferCreate, TransferUpdate
from datetime import datetime, timezone

router = APIRouter()

# Get transfer ledger
@router.get("/ledger", response_model=List[TransferResponse])
def get_transfer_ledger(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Retrieve transfers with relationships preloaded
    query = db.query(Transfer).options(
        joinedload(Transfer.source_phc),
        joinedload(Transfer.destination_phc)
    )
    
    # Non-officials are restricted to their own PHC's transfers
    if current_user.role in ["ASHA Worker", "PHC Staff"]:
        query = query.filter(
            (Transfer.source_phc_id == current_user.phc_id) | 
            (Transfer.destination_phc_id == current_user.phc_id)
        )
        
    return query.order_by(Transfer.created_at.desc()).all()

# Create a transfer recommendation/request
@router.post("/create", response_model=TransferResponse)
def create_transfer(
    transfer_in: TransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["PHC Staff", "System Admin", "District Health Official"]))
):
    # Verify PHCs exist
    source = db.query(PHC).filter(PHC.id == transfer_in.source_phc_id).first()
    dest = db.query(PHC).filter(PHC.id == transfer_in.destination_phc_id).first()
    if not source or not dest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source or Destination PHC not found"
        )
        
    # Check if source has enough stock of the medicine (excluding expired if possible, but matching standard medicine)
    # We query the total available stock for this medicine at the source
    source_stock_total = db.query(Stock).filter(
        Stock.phc_id == transfer_in.source_phc_id,
        Stock.medicine == transfer_in.medicine
    ).all()
    
    total_qty = sum(item.quantity for item in source_stock_total)
    if total_qty < transfer_in.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Source PHC only has {total_qty} units of {transfer_in.medicine}, but requested transfer of {transfer_in.quantity} units."
        )
        
    transfer = Transfer(
        source_phc_id=transfer_in.source_phc_id,
        destination_phc_id=transfer_in.destination_phc_id,
        medicine=transfer_in.medicine,
        quantity=transfer_in.quantity,
        status="pending"
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    
    # Reload relationships for response serialization
    transfer = db.query(Transfer).options(
        joinedload(Transfer.source_phc),
        joinedload(Transfer.destination_phc)
    ).filter(Transfer.id == transfer.id).first()
    
    return transfer

# Approve and execute transfer
@router.post("/approve/{transfer_id}", response_model=TransferResponse)
def approve_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["PHC Staff", "System Admin"]))
):
    transfer = db.query(Transfer).options(
        joinedload(Transfer.source_phc),
        joinedload(Transfer.destination_phc)
    ).filter(Transfer.id == transfer_id).first()
    
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
        
    if transfer.status != "pending":
        raise HTTPException(status_code=400, detail=f"Transfer is already in '{transfer.status}' status.")
        
    # Security: PHC Staff can only approve if they belong to either source or destination PHC
    if current_user.role == "PHC Staff" and current_user.phc_id != transfer.source_phc_id and current_user.phc_id != transfer.destination_phc_id:
         raise HTTPException(
             status_code=status.HTTP_403_FORBIDDEN,
             detail="You can only approve transfers involving your own PHC."
         )
         
    # Perform transaction: subtract from source, add to destination
    # Find stock items at source. We deduct from the stock record that expires first.
    source_stocks = db.query(Stock).filter(
        Stock.phc_id == transfer.source_phc_id,
        Stock.medicine == transfer.medicine,
        Stock.quantity > 0
    ).order_by(Stock.expiry_date.asc()).all()
    
    total_src = sum(s.quantity for s in source_stocks)
    if total_src < transfer.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock at source PHC at execution time.")
        
    qty_to_deduct = transfer.quantity
    expiry_to_transfer = None
    
    for stock_item in source_stocks:
        if qty_to_deduct <= 0:
            break
        
        deduct = min(stock_item.quantity, qty_to_deduct)
        stock_item.quantity -= deduct
        qty_to_deduct -= deduct
        # Capture the expiry date from the source to keep consistency at destination
        expiry_to_transfer = stock_item.expiry_date
        stock_item.updated_at = datetime.now(timezone.utc)
        
    # If no expiry date was captured, use current date + 180 days fallback
    if not expiry_to_transfer:
        expiry_to_transfer = datetime.now(timezone.utc).date()
        
    # Add to destination
    dest_stock = db.query(Stock).filter(
        Stock.phc_id == transfer.destination_phc_id,
        Stock.medicine == transfer.medicine,
        Stock.expiry_date == expiry_to_transfer
    ).first()
    
    if dest_stock:
        dest_stock.quantity += transfer.quantity
        dest_stock.updated_at = datetime.now(timezone.utc)
    else:
        dest_stock = Stock(
            phc_id=transfer.destination_phc_id,
            medicine=transfer.medicine,
            quantity=transfer.quantity,
            expiry_date=expiry_to_transfer,
            sync_status="synced"
        )
        db.add(dest_stock)
        
    # Update transfer status
    transfer.status = "completed"
    transfer.approved_by = current_user.id
    transfer.approved_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(transfer)
    
    return transfer
