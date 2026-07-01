from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from apps.api.app.core.database import get_db
from apps.api.app.core.security import verify_password, get_password_hash, create_access_token
from apps.api.app.models.models import User
from apps.api.app.schemas.schemas import UserCreate, UserResponse, UserLogin, Token

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if phone already exists
    db_user = db.query(User).filter(User.phone == user_in.phone).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this phone number already exists."
        )
    
    hashed_password = get_password_hash(user_in.password)
    user = User(
        name=user_in.name,
        phone=user_in.phone,
        password_hash=hashed_password,
        role=user_in.role,
        phc_id=user_in.phc_id,
        status="active"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == login_data.phone).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password"
        )
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive"
        )
    
    access_token = create_access_token(subject=user.phone)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }
