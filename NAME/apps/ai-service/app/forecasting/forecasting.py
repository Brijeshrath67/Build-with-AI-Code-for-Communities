import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from datetime import date, datetime, timedelta, timezone

def predict_stockout(
    current_quantity: int,
    consumption_history: list, # List of dicts with keys: date, quantity_consumed
    daily_consumption_rate: float, # from feature snapshot
    seasonal_index: float = 1.0,
    disease_trend_signal: float = 0.0
) -> dict:
    """
    Predicts stockout date and risk score using linear regression and seasonal/disease multipliers.
    """
    if current_quantity <= 0:
        return {
            "risk_score": "HIGH",
            "days_to_stockout": 0,
            "stockout_date": datetime.now(timezone.utc).date()
        }

    # If we have detailed consumption history, we can fit a linear regression model
    if len(consumption_history) >= 5:
        df = pd.DataFrame(consumption_history)
        df['date'] = pd.to_datetime(df['date'])
        df['days_ago'] = (df['date'] - df['date'].min()).dt.days
        
        # Fit linear regression: days_ago -> quantity_consumed
        X = df[['days_ago']].values
        y = df['quantity_consumed'].values
        
        model = LinearRegression()
        model.fit(X, y)
        
        # Predict daily consumption rate (slope of linear model)
        predicted_rate = model.coef_[0]
        # Ensure predicted rate is positive and reasonable
        if predicted_rate <= 0:
            predicted_rate = daily_consumption_rate
    else:
        # Fallback to feature snapshot rate
        predicted_rate = daily_consumption_rate

    # Apply seasonal index and disease trend multipliers
    # e.g., if disease trend signal is high (dengue outbreak -> high PCM consumption)
    adjusted_daily_rate = predicted_rate * seasonal_index * (1.0 + disease_trend_signal)
    
    if adjusted_daily_rate <= 0:
        adjusted_daily_rate = 1.0 # Avoid division by zero
        
    days_to_stockout = current_quantity / adjusted_daily_rate
    
    # Cap days to stockout at a reasonable max (e.g. 365 days)
    days_to_stockout = min(days_to_stockout, 365.0)
    
    # Calculate target stockout date
    stockout_date = datetime.now(timezone.utc).date() + timedelta(days=int(days_to_stockout))
    
    # Compute Risk Score
    if days_to_stockout <= 7:
        risk = "HIGH"
    elif days_to_stockout <= 21:
        risk = "MEDIUM"
    else:
        risk = "LOW"
        
    return {
        "risk_score": risk,
        "days_to_stockout": int(days_to_stockout),
        "stockout_date": stockout_date
    }
