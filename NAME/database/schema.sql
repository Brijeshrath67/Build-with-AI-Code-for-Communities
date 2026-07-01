-- Database Schema for PHC Exchange

-- Drop tables if they exist
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS forecasts CASCADE;
DROP TABLE IF EXISTS feature_snapshots CASCADE;
DROP TABLE IF EXISTS transfers CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS phcs CASCADE;
DROP TABLE IF EXISTS medicine_mappings CASCADE;

-- 1. PHC Metadata Table
CREATE TABLE phcs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    district VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    type VARCHAR(50) NOT NULL -- 'UPHC', 'CHC', 'PHC'
);

-- 2. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'ASHA Worker', 'PHC Staff', 'District Health Official', 'System Admin'
    phone VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phc_id INTEGER REFERENCES phcs(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active'
);

-- 3. Stock/Inventory Table
CREATE TABLE stock (
    id SERIAL PRIMARY KEY,
    phc_id INTEGER NOT NULL REFERENCES phcs(id) ON DELETE CASCADE,
    medicine VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    expiry_date DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'synced' -- 'synced', 'pending_offline'
);

-- Create index on stock for faster queries
CREATE INDEX idx_stock_phc_medicine ON stock(phc_id, medicine);

-- 4. Feature Snapshot Table (For forecasting inputs)
CREATE TABLE feature_snapshots (
    id SERIAL PRIMARY KEY,
    phc_id INTEGER NOT NULL REFERENCES phcs(id) ON DELETE CASCADE,
    medicine VARCHAR(255) NOT NULL,
    consumption_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    seasonal_index DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    disease_trend_signal DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Forecasts Table
CREATE TABLE forecasts (
    id SERIAL PRIMARY KEY,
    phc_id INTEGER NOT NULL REFERENCES phcs(id) ON DELETE CASCADE,
    medicine VARCHAR(255) NOT NULL,
    risk_score VARCHAR(50) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
    stockout_date DATE NOT NULL,
    predicted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    feature_snapshot_id INTEGER REFERENCES feature_snapshots(id) ON DELETE SET NULL
);

-- 6. Transfers Table (Ledger)
CREATE TABLE transfers (
    id SERIAL PRIMARY KEY,
    source_phc_id INTEGER NOT NULL REFERENCES phcs(id) ON DELETE CASCADE,
    destination_phc_id INTEGER NOT NULL REFERENCES phcs(id) ON DELETE CASCADE,
    medicine VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'in_transit', 'completed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE
);

-- 7. Alerts Table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    phc_id INTEGER NOT NULL REFERENCES phcs(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL, -- 'low', 'medium', 'high'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 8. Medicine Mappings (For semantic name mapping)
CREATE TABLE medicine_mappings (
    id SERIAL PRIMARY KEY,
    alias_name VARCHAR(255) UNIQUE NOT NULL,
    standard_name VARCHAR(255) NOT NULL,
    embedding DOUBLE PRECISION[] -- Vector representation fallback
);
