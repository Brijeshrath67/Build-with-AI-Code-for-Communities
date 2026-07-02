from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from typing import List
from apps.api.app.core.database import get_db
from apps.api.app.core.dependencies import get_current_active_user, RoleChecker
from apps.api.app.models.models import Transfer, Stock, User, PHC, Alert
from apps.api.app.schemas.schemas import TransferResponse, TransferCreate, TransferUpdate, DeclineTransferRequest
from datetime import datetime, timezone

router = APIRouter()

def _add_alert(db: Session, phc_id: int, message: str, severity: str = "medium") -> Alert:
    alert = Alert(
        phc_id=phc_id,
        message=message,
        severity=severity,
        created_at=datetime.now(timezone.utc)
    )
    db.add(alert)
    return alert


def _resolve_transfer_request_alert(db: Session, transfer: Transfer) -> None:
    db.query(Alert).filter(
        Alert.phc_id == transfer.source_phc_id,
        Alert.resolved_at == None,
        Alert.message.ilike(f"%transfer request #{transfer.id}%")
    ).update(
        {Alert.resolved_at: datetime.now(timezone.utc)},
        synchronize_session=False
    )


def _serialize_phc(phc: PHC | None, fallback_id: int | None = None) -> dict:
    if not phc:
        return {
            "id": fallback_id,
            "name": f"PHC {fallback_id}" if fallback_id is not None else "Unknown PHC",
            "district": "",
            "latitude": 0.0,
            "longitude": 0.0,
            "type": "",
        }
    return {
        "id": phc.id,
        "name": phc.name,
        "district": phc.district,
        "latitude": phc.latitude,
        "longitude": phc.longitude,
        "type": phc.type,
    }


def _serialize_transfer(transfer: Transfer) -> dict:
    return {
        "id": transfer.id,
        "source_phc_id": transfer.source_phc_id,
        "source_phc": _serialize_phc(transfer.source_phc, transfer.source_phc_id),
        "destination_phc_id": transfer.destination_phc_id,
        "destination_phc": _serialize_phc(transfer.destination_phc, transfer.destination_phc_id),
        "medicine": transfer.medicine,
        "quantity": transfer.quantity,
        "status": transfer.status,
        "message": transfer.message,
        "decline_reason": transfer.decline_reason,
        "requested_expiry_date": transfer.requested_expiry_date,
        "created_at": transfer.created_at,
        "approved_by": transfer.approved_by,
        "approved_at": transfer.approved_at,
    }

# Get transfer ledger
@router.get("/ledger", response_model=List[TransferResponse])
def get_transfer_ledger(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        ledger_sql = text("""
            SELECT
                t.id,
                t.source_phc_id,
                t.destination_phc_id,
                t.medicine,
                t.quantity,
                t.status,
                t.message,
                t.decline_reason,
                t.requested_expiry_date,
                t.created_at,
                t.approved_by,
                t.approved_at,
                sp.id AS source_id,
                sp.name AS source_name,
                sp.district AS source_district,
                sp.latitude AS source_latitude,
                sp.longitude AS source_longitude,
                sp.type AS source_type,
                dp.id AS destination_id,
                dp.name AS destination_name,
                dp.district AS destination_district,
                dp.latitude AS destination_latitude,
                dp.longitude AS destination_longitude,
                dp.type AS destination_type
            FROM transfers t
            LEFT JOIN phcs sp ON sp.id = t.source_phc_id
            LEFT JOIN phcs dp ON dp.id = t.destination_phc_id
        """)

        rows = db.execute(ledger_sql).mappings().all()

        if current_user.role in ["ASHA Worker", "PHC Staff"]:
            rows = [
                row for row in rows
                if row["source_phc_id"] == current_user.phc_id or row["destination_phc_id"] == current_user.phc_id
            ]

        rows.sort(key=lambda row: row["created_at"], reverse=True)

        return [
            {
                "id": row["id"],
                "source_phc_id": row["source_phc_id"],
                "source_phc": {
                    "id": row["source_id"] or row["source_phc_id"],
                    "name": row["source_name"] or f"PHC {row['source_phc_id']}",
                    "district": row["source_district"] or "",
                    "latitude": row["source_latitude"] or 0.0,
                    "longitude": row["source_longitude"] or 0.0,
                    "type": row["source_type"] or "",
                },
                "destination_phc_id": row["destination_phc_id"],
                "destination_phc": {
                    "id": row["destination_id"] or row["destination_phc_id"],
                    "name": row["destination_name"] or f"PHC {row['destination_phc_id']}",
                    "district": row["destination_district"] or "",
                    "latitude": row["destination_latitude"] or 0.0,
                    "longitude": row["destination_longitude"] or 0.0,
                    "type": row["destination_type"] or "",
                },
                "medicine": row["medicine"],
                "quantity": row["quantity"],
                "status": row["status"],
                "message": row["message"],
                "decline_reason": row["decline_reason"],
                "requested_expiry_date": row["requested_expiry_date"],
                "created_at": row["created_at"],
                "approved_by": row["approved_by"],
                "approved_at": row["approved_at"],
            }
            for row in rows
        ]
    except Exception as exc:
        print(f"Transfer ledger fallback failed: {exc}")
        return []


# Create a transfer request
# Flow: Requester (destination PHC doctor, e.g. Dr. Ramesh) requests medicine
#       from a supplier (source PHC, e.g. Dr. Suresh).
#       source_phc_id  = the PHC that has the surplus (supplier, Dr. Suresh)
#       destination_phc_id = the PHC that needs medicine (requester, Dr. Ramesh)
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

    # Ensure a PHC staff doctor can only create a transfer request for their own PHC
    if current_user.role == "PHC Staff" and current_user.phc_id != transfer_in.destination_phc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create transfer requests on behalf of your own PHC."
        )

    # Prevent self-requests where source and destination are identical
    if transfer_in.source_phc_id == transfer_in.destination_phc_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination PHC cannot be the same."
        )

    # Check if source has enough stock
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

    if transfer_in.source_phc_id == transfer_in.destination_phc_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination PHC cannot be the same."
        )

    transfer = Transfer(
        source_phc_id=transfer_in.source_phc_id,
        destination_phc_id=transfer_in.destination_phc_id,
        medicine=transfer_in.medicine,
        quantity=transfer_in.quantity,
        message=transfer_in.message,
        requested_expiry_date=transfer_in.requested_expiry_date,
        status="pending"
    )
    db.add(transfer)
    db.flush()  # Get the transfer.id before committing

    # Create an alert for the SOURCE PHC (supplier, e.g. Dr. Suresh) with the requester's message
    requester_name = current_user.name
    msg_body = f'"{transfer_in.message}"' if transfer_in.message else "(no message provided)"
    _add_alert(
        db,
        transfer_in.source_phc_id,
        (
            f"[REQUEST] New transfer request #{transfer.id} from {requester_name} ({dest.name}): "
            f"{transfer_in.quantity} units of {transfer_in.medicine}. "
            f"Message: {msg_body}. Please accept or reject this request."
        ),
        "high"
    )
    db.commit()
    db.refresh(transfer)

    # Reload relationships for response serialization
    transfer = db.query(Transfer).options(
        joinedload(Transfer.source_phc),
        joinedload(Transfer.destination_phc)
    ).filter(Transfer.id == transfer.id).first()

    return transfer


# Accept and execute transfer
# Only the SOURCE PHC doctor (supplier, e.g. Dr. Suresh) can accept.
# The DESTINATION PHC doctor (requester, e.g. Dr. Ramesh) must use /withdraw to cancel.
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

    # Security: Only the SOURCE PHC doctor (supplier) can accept.
    if current_user.role == "PHC Staff":
        if current_user.phc_id == transfer.destination_phc_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot accept a transfer you requested. Only the supplier PHC can accept. Use Withdraw to cancel your own request."
            )
        if current_user.phc_id != transfer.source_phc_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only accept transfers where your PHC is the supplier (source)."
            )

    # Perform transaction: subtract from source, add to destination
    all_source_stocks = db.query(Stock).filter(
        Stock.phc_id == transfer.source_phc_id,
        Stock.medicine == transfer.medicine,
        Stock.quantity > 0
    ).all()

    total_src = sum(s.quantity for s in all_source_stocks)
    if total_src < transfer.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock at source PHC at execution time.")

    # Reorder to prioritize exact requested_expiry_date
    if transfer.requested_expiry_date:
        exact_match = [s for s in all_source_stocks if s.expiry_date == transfer.requested_expiry_date]
        others = [s for s in all_source_stocks if s.expiry_date != transfer.requested_expiry_date]
        others.sort(key=lambda x: x.expiry_date)
        source_stocks = exact_match + others
    else:
        source_stocks = sorted(all_source_stocks, key=lambda x: x.expiry_date)

    qty_to_deduct = transfer.quantity

    for stock_item in source_stocks:
        if qty_to_deduct <= 0:
            break
        deduct = min(stock_item.quantity, qty_to_deduct)
        stock_item.quantity -= deduct
        qty_to_deduct -= deduct
        stock_item.updated_at = datetime.now(timezone.utc)

        # Add this deducted amount to destination PHC under the same expiry date
        dest_stock = db.query(Stock).filter(
            Stock.phc_id == transfer.destination_phc_id,
            Stock.medicine == transfer.medicine,
            Stock.expiry_date == stock_item.expiry_date
        ).first()

        if dest_stock:
            dest_stock.quantity += deduct
            dest_stock.updated_at = datetime.now(timezone.utc)
        else:
            dest_stock = Stock(
                phc_id=transfer.destination_phc_id,
                medicine=transfer.medicine,
                quantity=deduct,
                expiry_date=stock_item.expiry_date,
                sync_status="synced"
            )
            db.add(dest_stock)

    transfer.status = "completed"
    transfer.approved_by = current_user.id
    transfer.approved_at = datetime.now(timezone.utc)
    _resolve_transfer_request_alert(db, transfer)

    _add_alert(
        db,
        transfer.destination_phc_id,
        (
            f"[TRANSFER] Your transfer request has been accepted by {current_user.name} "
            f"({transfer.source_phc.name}). {transfer.quantity} units of "
            f"{transfer.medicine} have been transferred to {transfer.destination_phc.name}."
        ),
        "medium"
    )
    _add_alert(
        db,
        transfer.source_phc_id,
        (
            f"[TRANSFER] You accepted transfer request #{transfer.id} from "
            f"{transfer.destination_phc.name}: {transfer.quantity} units of "
            f"{transfer.medicine} were transferred."
        ),
        "low"
    )

    db.commit()
    db.refresh(transfer)

    return transfer


# Decline a transfer request — only the SOURCE PHC doctor (supplier) can decline
@router.post("/decline/{transfer_id}", response_model=TransferResponse)
def decline_transfer(
    transfer_id: int,
    payload: DeclineTransferRequest,
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
        raise HTTPException(status_code=400, detail=f"Only pending transfers can be declined. This transfer is '{transfer.status}'.")

    # Only the source PHC doctor (supplier) or System Admin can decline
    if current_user.role == "PHC Staff":
        if current_user.phc_id == transfer.destination_phc_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot decline your own request. Use Withdraw instead."
            )
        if current_user.phc_id != transfer.source_phc_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only decline transfers where your PHC is the supplier (source)."
            )

    transfer.status = "rejected"
    transfer.decline_reason = payload.reason
    transfer.approved_by = current_user.id
    transfer.approved_at = datetime.now(timezone.utc)
    _resolve_transfer_request_alert(db, transfer)

    # Notify both sides: requester sees the rejection, supplier sees their action reflected.
    _add_alert(
        db,
        transfer.destination_phc_id,
        (
            f"[TRANSFER] Your transfer request has been rejected by {current_user.name} "
            f"({transfer.source_phc.name}). Request: {transfer.quantity} units of "
            f"{transfer.medicine}. Reason: \"{payload.reason}\""
        ),
        "high"
    )
    _add_alert(
        db,
        transfer.source_phc_id,
        (
            f"[TRANSFER] You rejected transfer request #{transfer.id} from "
            f"{transfer.destination_phc.name}: {transfer.quantity} units of "
            f"{transfer.medicine}. Reason: \"{payload.reason}\""
        ),
        "medium"
    )
    db.commit()
    db.refresh(transfer)
    return transfer


# Withdraw (cancel) a transfer — only the DESTINATION PHC doctor (requester) can withdraw
@router.post("/withdraw/{transfer_id}", response_model=TransferResponse)
def withdraw_transfer(
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
        raise HTTPException(status_code=400, detail=f"Only pending transfers can be withdrawn. This transfer is '{transfer.status}'.")

    # Only the destination PHC doctor (requester) or System Admin can withdraw
    if current_user.role == "PHC Staff" and current_user.phc_id != transfer.destination_phc_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only withdraw transfers that your PHC requested."
        )

    transfer.status = "rejected"
    transfer.approved_by = current_user.id
    transfer.approved_at = datetime.now(timezone.utc)
    _add_alert(
        db,
        transfer.destination_phc_id,
        (
            f"[TRANSFER] Your transfer request #{transfer.id} was withdrawn by "
            f"{current_user.name}. Request for {transfer.quantity} units of {transfer.medicine} "
            f"is no longer pending."
        ),
        "medium"
    )
    _add_alert(
        db,
        transfer.source_phc_id,
        (
            f"[TRANSFER] Transfer request #{transfer.id} from {transfer.destination_phc.name} "
            f"was withdrawn."
        ),
        "low"
    )
    db.commit()
    db.refresh(transfer)
    return transfer
