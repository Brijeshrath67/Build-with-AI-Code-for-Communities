import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "PHC Exchange AI Service"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+pg8000://phc_user:phc_password@localhost:5432/phc_exchange"
    )
    
    class Config:
        case_sensitive = True

settings = Settings()
