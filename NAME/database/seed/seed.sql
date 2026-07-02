-- Seed data for PHC Exchange

-- Clear existing data
TRUNCATE alerts, forecasts, feature_snapshots, transfers, stock, users, phcs, medicine_mappings CASCADE;

-- 1. Insert PHCs
-- A 10-facility Bangalore Urban/Rural network for redistribution, network view, and map demos.
INSERT INTO phcs (id, name, district, latitude, longitude, type) VALUES
(1, 'UPHC Unit-9', 'Bangalore Urban', 12.9715987, 77.5945627, 'UPHC'),
(2, 'UPHC Unit-3', 'Bangalore Urban', 12.9815987, 77.6045627, 'UPHC'),
(3, 'CHC Nelamangala', 'Bangalore Rural', 13.0987, 77.3912, 'CHC'),
(4, 'PHC Devanahalli', 'Bangalore Rural', 13.2486, 77.7123, 'PHC'),
(5, 'UPHC Malleswaram', 'Bangalore Urban', 13.0031, 77.5643, 'UPHC'),
(6, 'UPHC Jayanagar', 'Bangalore Urban', 12.9250, 77.5938, 'UPHC'),
(7, 'PHC Yelahanka', 'Bangalore Urban', 13.1007, 77.5963, 'PHC'),
(8, 'CHC Hoskote', 'Bangalore Rural', 13.0707, 77.7981, 'CHC'),
(9, 'PHC Anekal', 'Bangalore Urban', 12.7111, 77.6956, 'PHC'),
(10, 'PHC Magadi', 'Bangalore Rural', 12.9572, 77.2236, 'PHC');

-- 2. Insert Users
-- Password for all: 'password123' -> Bcrypt hash: '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS'
INSERT INTO users (id, name, role, phone, password_hash, phc_id, status) VALUES
(1, 'Dr. Ramesh', 'PHC Staff', '7777777777', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 1, 'active'),
(2, 'Dr. Suresh', 'PHC Staff', '6666666666', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 2, 'active'),
(3, 'Dr. Meera Nair', 'PHC Staff', '4444444444', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 3, 'active'),
(4, 'Dr. Arjun Rao', 'PHC Staff', '3333333333', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 4, 'active'),
(5, 'Dr. Kavya Iyer', 'PHC Staff', '2222222222', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 5, 'active'),
(6, 'Dr. Nikhil Shah', 'PHC Staff', '1111111111', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 6, 'active'),
(7, 'Dr. Farah Khan', 'PHC Staff', '1010101010', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 7, 'active'),
(8, 'Dr. Prakash Gowda', 'PHC Staff', '2020202020', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 8, 'active'),
(9, 'Dr. Leela Menon', 'PHC Staff', '3030303030', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 9, 'active'),
(10, 'Dr. Vivek Patil', 'PHC Staff', '4040404040', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 10, 'active'),
(11, 'System Admin', 'System Admin', '9999999999', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', NULL, 'active'),
(12, 'District Officer Gupta', 'District Health Official', '5555555555', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', NULL, 'active'),
(13, 'Asha Devi', 'ASHA Worker', '8888888888', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 1, 'active'),
(14, 'Asha Kumari', 'ASHA Worker', '5050505050', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 6, 'active'),
(15, 'Asha Banu', 'ASHA Worker', '6060606060', '$2b$12$62qbR78iUI0J.VS.g3Gy7O8zzV1QfhmyepI2PTit65MNUnQ8baVGS', 8, 'active');

-- 3. Insert Starting Stocks
-- Quantities intentionally include shortages, surpluses, and near-expiry items.
INSERT INTO stock (phc_id, medicine, quantity, expiry_date, sync_status) VALUES
(1, 'Paracetamol 500mg', 20, '2026-12-31', 'synced'),
(1, 'Amoxicillin 500mg', 500, '2026-10-31', 'synced'),
(1, 'Metformin 500mg', 180, '2027-06-30', 'synced'),
(1, 'ORS Sachet', 35, '2026-08-15', 'synced'),

(2, 'Paracetamol 500mg', 800, '2026-12-31', 'synced'),
(2, 'Amoxicillin 500mg', 10, '2026-09-30', 'synced'),
(2, 'Metformin 500mg', 420, '2027-06-30', 'synced'),
(2, 'ORS Sachet', 600, '2027-02-28', 'synced'),

(3, 'Paracetamol 500mg', 300, '2027-01-31', 'synced'),
(3, 'Amoxicillin 500mg', 400, '2026-11-30', 'synced'),
(3, 'Metformin 500mg', 30, '2027-06-30', 'synced'),
(3, 'Cetirizine 10mg', 450, '2027-04-30', 'synced'),

(4, 'Paracetamol 500mg', 250, '2026-08-31', 'synced'),
(4, 'Amoxicillin 500mg', 300, '2027-03-31', 'synced'),
(4, 'Metformin 500mg', 500, '2027-06-30', 'synced'),
(4, 'ORS Sachet', 0, '2027-01-31', 'synced'),

(5, 'Paracetamol 500mg', 15, '2026-12-31', 'synced'),
(5, 'Amoxicillin 500mg', 250, '2026-12-15', 'synced'),
(5, 'Metformin 500mg', 700, '2027-08-31', 'synced'),
(5, 'Cetirizine 10mg', 75, '2027-04-30', 'synced'),

(6, 'Paracetamol 500mg', 550, '2027-02-28', 'synced'),
(6, 'Amoxicillin 500mg', 40, '2026-10-31', 'synced'),
(6, 'Metformin 500mg', 22, '2027-06-30', 'synced'),
(6, 'ORS Sachet', 500, '2026-12-31', 'synced'),

(7, 'Paracetamol 500mg', 450, '2026-11-30', 'synced'),
(7, 'Amoxicillin 500mg', 0, '2026-12-31', 'synced'),
(7, 'Metformin 500mg', 260, '2027-07-31', 'synced'),
(7, 'Cetirizine 10mg', 20, '2027-05-31', 'synced'),

(8, 'Paracetamol 500mg', 700, '2027-01-31', 'synced'),
(8, 'Amoxicillin 500mg', 650, '2027-02-28', 'synced'),
(8, 'Metformin 500mg', 90, '2027-07-31', 'synced'),
(8, 'ORS Sachet', 25, '2026-08-10', 'synced'),

(9, 'Paracetamol 500mg', 50, '2026-09-30', 'synced'),
(9, 'Amoxicillin 500mg', 350, '2027-03-31', 'synced'),
(9, 'Metformin 500mg', 650, '2027-06-30', 'synced'),
(9, 'Cetirizine 10mg', 300, '2027-04-30', 'synced'),

(10, 'Paracetamol 500mg', 600, '2027-01-31', 'synced'),
(10, 'Amoxicillin 500mg', 25, '2026-10-31', 'synced'),
(10, 'Metformin 500mg', 40, '2027-06-30', 'synced'),
(10, 'ORS Sachet', 350, '2027-03-31', 'synced');

-- Additional widely used medicines seeded across every PHC for transfer/search demos.
WITH new_medicines(ord, medicine, base_quantity, expiry_date) AS (
    VALUES
    (1, 'Ciprofloxacin 500mg', 260, DATE '2027-03-31'),
    (2, 'Amlodipine 5mg', 380, DATE '2027-04-30'),
    (3, 'Atenolol 50mg', 240, DATE '2027-05-31'),
    (4, 'Losartan 50mg', 330, DATE '2027-06-30'),
    (5, 'Enalapril 5mg', 220, DATE '2027-07-31'),
    (6, 'Hydrochlorothiazide 25mg', 210, DATE '2027-08-31'),
    (7, 'Aspirin 75mg', 420, DATE '2027-09-30'),
    (8, 'Atorvastatin 10mg', 360, DATE '2027-10-31'),
    (9, 'Omeprazole 20mg', 300, DATE '2027-11-30'),
    (10, 'Pantoprazole 40mg', 310, DATE '2027-12-31'),
    (11, 'Ranitidine 150mg', 180, DATE '2027-02-28'),
    (12, 'Domperidone 10mg', 190, DATE '2027-03-31'),
    (13, 'Ondansetron 4mg', 160, DATE '2027-04-30'),
    (14, 'Albendazole 400mg', 280, DATE '2027-05-31'),
    (15, 'Azithromycin 500mg', 230, DATE '2027-06-30'),
    (16, 'Doxycycline 100mg', 250, DATE '2027-07-31'),
    (17, 'Cefixime 200mg', 240, DATE '2027-08-31'),
    (18, 'Co-trimoxazole 480mg', 260, DATE '2027-09-30'),
    (19, 'Fluconazole 150mg', 170, DATE '2027-10-31'),
    (20, 'Clotrimazole Cream', 140, DATE '2027-11-30'),
    (21, 'Mupirocin Ointment', 120, DATE '2027-12-31'),
    (22, 'Povidone Iodine Solution', 200, DATE '2027-03-31'),
    (23, 'Salbutamol Inhaler', 130, DATE '2027-04-30'),
    (24, 'Budesonide Inhaler', 90, DATE '2027-05-31'),
    (25, 'Montelukast 10mg', 240, DATE '2027-06-30'),
    (26, 'Prednisolone 5mg', 260, DATE '2027-07-31'),
    (27, 'Hydrocortisone Cream', 150, DATE '2027-08-31'),
    (28, 'Ferrous Sulphate Tablet', 520, DATE '2027-09-30'),
    (29, 'Folic Acid 5mg', 500, DATE '2027-10-31'),
    (30, 'Calcium Carbonate 500mg', 460, DATE '2027-11-30'),
    (31, 'Vitamin D3 60000 IU', 180, DATE '2027-12-31'),
    (32, 'Vitamin B Complex', 430, DATE '2027-03-31'),
    (33, 'Zinc Sulphate 20mg', 300, DATE '2027-04-30'),
    (34, 'Chloroquine 250mg', 160, DATE '2027-05-31'),
    (35, 'Artesunate 50mg', 140, DATE '2027-06-30'),
    (36, 'Primaquine 15mg', 130, DATE '2027-07-31'),
    (37, 'Insulin Regular', 80, DATE '2027-08-31'),
    (38, 'Glimepiride 2mg', 260, DATE '2027-09-30'),
    (39, 'Gliclazide 80mg', 240, DATE '2027-10-31'),
    (40, 'Levothyroxine 50mcg', 300, DATE '2027-11-30'),
    (41, 'Saline Nasal Drops', 170, DATE '2027-12-31'),
    (42, 'Chlorpheniramine 4mg', 360, DATE '2027-03-31'),
    (43, 'Dextromethorphan Syrup', 150, DATE '2027-04-30'),
    (44, 'Ambroxol Syrup', 180, DATE '2027-05-31'),
    (45, 'Loperamide 2mg', 230, DATE '2027-06-30'),
    (46, 'Lactulose Syrup', 140, DATE '2027-07-31'),
    (47, 'Bisacodyl 5mg', 210, DATE '2027-08-31'),
    (48, 'Diclofenac Gel', 190, DATE '2027-09-30'),
    (49, 'Tramadol 50mg', 110, DATE '2027-10-31'),
    (50, 'Magnesium Hydroxide Suspension', 150, DATE '2027-11-30')
)
INSERT INTO stock (phc_id, medicine, quantity, expiry_date, sync_status)
SELECT
    p.id,
    m.medicine,
    CASE
        WHEN (p.id + m.ord) % 11 = 0 THEN 0
        WHEN (p.id + m.ord) % 7 = 0 THEN 15
        ELSE m.base_quantity + ((p.id % 4) * 25)
    END,
    m.expiry_date,
    'synced'
FROM phcs p
CROSS JOIN new_medicines m;

-- 4. Insert Feature Snapshots (Consumption rates)
INSERT INTO feature_snapshots (phc_id, medicine, consumption_rate, seasonal_index, disease_trend_signal) VALUES
(1, 'Paracetamol 500mg', 15.0, 1.1, 0.1),
(1, 'Amoxicillin 500mg', 5.0, 1.0, 0.0),
(1, 'Metformin 500mg', 4.5, 1.0, 0.0),
(1, 'ORS Sachet', 8.0, 1.4, 0.3),

(2, 'Paracetamol 500mg', 5.0, 1.0, 0.0),
(2, 'Amoxicillin 500mg', 10.0, 1.2, 0.2),
(2, 'Metformin 500mg', 3.0, 1.0, 0.0),
(2, 'ORS Sachet', 6.0, 1.2, 0.1),

(3, 'Paracetamol 500mg', 8.0, 1.0, 0.0),
(3, 'Amoxicillin 500mg', 6.0, 1.0, 0.0),
(3, 'Metformin 500mg', 5.5, 1.0, 0.0),
(3, 'Cetirizine 10mg', 7.0, 1.1, 0.1),

(4, 'Paracetamol 500mg', 12.0, 1.1, 0.1),
(4, 'Amoxicillin 500mg', 8.0, 1.0, 0.0),
(4, 'Metformin 500mg', 4.0, 1.0, 0.0),
(4, 'ORS Sachet', 9.5, 1.5, 0.2),

(5, 'Paracetamol 500mg', 16.0, 1.1, 0.1),
(5, 'Amoxicillin 500mg', 7.0, 1.0, 0.0),
(5, 'Metformin 500mg', 6.0, 1.0, 0.0),
(5, 'Cetirizine 10mg', 4.0, 1.0, 0.0),

(6, 'Paracetamol 500mg', 10.0, 1.0, 0.0),
(6, 'Amoxicillin 500mg', 9.0, 1.2, 0.1),
(6, 'Metformin 500mg', 6.5, 1.0, 0.0),
(6, 'ORS Sachet', 7.0, 1.3, 0.1),

(7, 'Paracetamol 500mg', 7.0, 1.0, 0.0),
(7, 'Amoxicillin 500mg', 12.0, 1.2, 0.2),
(7, 'Metformin 500mg', 4.5, 1.0, 0.0),
(7, 'Cetirizine 10mg', 5.0, 1.1, 0.1),

(8, 'Paracetamol 500mg', 9.0, 1.0, 0.0),
(8, 'Amoxicillin 500mg', 5.0, 1.0, 0.0),
(8, 'Metformin 500mg', 5.0, 1.0, 0.0),
(8, 'ORS Sachet', 11.0, 1.5, 0.3),

(9, 'Paracetamol 500mg', 14.0, 1.1, 0.1),
(9, 'Amoxicillin 500mg', 6.0, 1.0, 0.0),
(9, 'Metformin 500mg', 5.5, 1.0, 0.0),
(9, 'Cetirizine 10mg', 5.0, 1.0, 0.0),

(10, 'Paracetamol 500mg', 7.0, 1.0, 0.0),
(10, 'Amoxicillin 500mg', 8.5, 1.1, 0.1),
(10, 'Metformin 500mg', 5.5, 1.0, 0.0),
(10, 'ORS Sachet', 6.0, 1.2, 0.1);

WITH new_medicines(ord, medicine) AS (
    VALUES
    (1, 'Ciprofloxacin 500mg'),
    (2, 'Amlodipine 5mg'),
    (3, 'Atenolol 50mg'),
    (4, 'Losartan 50mg'),
    (5, 'Enalapril 5mg'),
    (6, 'Hydrochlorothiazide 25mg'),
    (7, 'Aspirin 75mg'),
    (8, 'Atorvastatin 10mg'),
    (9, 'Omeprazole 20mg'),
    (10, 'Pantoprazole 40mg'),
    (11, 'Ranitidine 150mg'),
    (12, 'Domperidone 10mg'),
    (13, 'Ondansetron 4mg'),
    (14, 'Albendazole 400mg'),
    (15, 'Azithromycin 500mg'),
    (16, 'Doxycycline 100mg'),
    (17, 'Cefixime 200mg'),
    (18, 'Co-trimoxazole 480mg'),
    (19, 'Fluconazole 150mg'),
    (20, 'Clotrimazole Cream'),
    (21, 'Mupirocin Ointment'),
    (22, 'Povidone Iodine Solution'),
    (23, 'Salbutamol Inhaler'),
    (24, 'Budesonide Inhaler'),
    (25, 'Montelukast 10mg'),
    (26, 'Prednisolone 5mg'),
    (27, 'Hydrocortisone Cream'),
    (28, 'Ferrous Sulphate Tablet'),
    (29, 'Folic Acid 5mg'),
    (30, 'Calcium Carbonate 500mg'),
    (31, 'Vitamin D3 60000 IU'),
    (32, 'Vitamin B Complex'),
    (33, 'Zinc Sulphate 20mg'),
    (34, 'Chloroquine 250mg'),
    (35, 'Artesunate 50mg'),
    (36, 'Primaquine 15mg'),
    (37, 'Insulin Regular'),
    (38, 'Glimepiride 2mg'),
    (39, 'Gliclazide 80mg'),
    (40, 'Levothyroxine 50mcg'),
    (41, 'Saline Nasal Drops'),
    (42, 'Chlorpheniramine 4mg'),
    (43, 'Dextromethorphan Syrup'),
    (44, 'Ambroxol Syrup'),
    (45, 'Loperamide 2mg'),
    (46, 'Lactulose Syrup'),
    (47, 'Bisacodyl 5mg'),
    (48, 'Diclofenac Gel'),
    (49, 'Tramadol 50mg'),
    (50, 'Magnesium Hydroxide Suspension')
)
INSERT INTO feature_snapshots (phc_id, medicine, consumption_rate, seasonal_index, disease_trend_signal)
SELECT
    p.id,
    m.medicine,
    3.0 + ((m.ord + p.id) % 8),
    CASE WHEN m.ord % 5 = 0 THEN 1.2 ELSE 1.0 END,
    CASE WHEN m.ord % 9 = 0 THEN 0.1 ELSE 0.0 END
FROM phcs p
CROSS JOIN new_medicines m;

-- 5. Insert Medicine Naming Variants for Semantic Matching
INSERT INTO medicine_mappings (alias_name, standard_name, embedding) VALUES
('PCM 500mg', 'Paracetamol 500mg', ARRAY[0.9, 0.1, 0.0, 0.0, 0.0]),
('Crocin', 'Paracetamol 500mg', ARRAY[0.85, 0.15, 0.0, 0.0, 0.0]),
('Paracetamol tab', 'Paracetamol 500mg', ARRAY[0.95, 0.05, 0.0, 0.0, 0.0]),
('Paracetamol 500mg', 'Paracetamol 500mg', ARRAY[1.0, 0.0, 0.0, 0.0, 0.0]),
('Amox 500', 'Amoxicillin 500mg', ARRAY[0.0, 0.9, 0.1, 0.0, 0.0]),
('Amoxicillin capsule', 'Amoxicillin 500mg', ARRAY[0.0, 0.95, 0.05, 0.0, 0.0]),
('Mox 500', 'Amoxicillin 500mg', ARRAY[0.0, 0.8, 0.2, 0.0, 0.0]),
('Amoxicillin 500mg', 'Amoxicillin 500mg', ARRAY[0.0, 1.0, 0.0, 0.0, 0.0]),
('Metformin', 'Metformin 500mg', ARRAY[0.0, 0.0, 0.95, 0.05, 0.0]),
('Metformin 500', 'Metformin 500mg', ARRAY[0.0, 0.0, 0.9, 0.1, 0.0]),
('Metformin 500mg', 'Metformin 500mg', ARRAY[0.0, 0.0, 1.0, 0.0, 0.0]),
('ORS', 'ORS Sachet', ARRAY[0.0, 0.0, 0.0, 0.95, 0.05]),
('ORS Sachet', 'ORS Sachet', ARRAY[0.0, 0.0, 0.0, 1.0, 0.0]),
('Cetirizine', 'Cetirizine 10mg', ARRAY[0.0, 0.0, 0.0, 0.05, 0.95]),
('Cetirizine 10mg', 'Cetirizine 10mg', ARRAY[0.0, 0.0, 0.0, 0.0, 1.0]);

INSERT INTO medicine_mappings (alias_name, standard_name) VALUES
('Ciprofloxacin 500mg', 'Ciprofloxacin 500mg'),
('Amlodipine 5mg', 'Amlodipine 5mg'),
('Atenolol 50mg', 'Atenolol 50mg'),
('Losartan 50mg', 'Losartan 50mg'),
('Enalapril 5mg', 'Enalapril 5mg'),
('Hydrochlorothiazide 25mg', 'Hydrochlorothiazide 25mg'),
('Aspirin 75mg', 'Aspirin 75mg'),
('Atorvastatin 10mg', 'Atorvastatin 10mg'),
('Omeprazole 20mg', 'Omeprazole 20mg'),
('Pantoprazole 40mg', 'Pantoprazole 40mg'),
('Ranitidine 150mg', 'Ranitidine 150mg'),
('Domperidone 10mg', 'Domperidone 10mg'),
('Ondansetron 4mg', 'Ondansetron 4mg'),
('Albendazole 400mg', 'Albendazole 400mg'),
('Azithromycin 500mg', 'Azithromycin 500mg'),
('Doxycycline 100mg', 'Doxycycline 100mg'),
('Cefixime 200mg', 'Cefixime 200mg'),
('Co-trimoxazole 480mg', 'Co-trimoxazole 480mg'),
('Fluconazole 150mg', 'Fluconazole 150mg'),
('Clotrimazole Cream', 'Clotrimazole Cream'),
('Mupirocin Ointment', 'Mupirocin Ointment'),
('Povidone Iodine Solution', 'Povidone Iodine Solution'),
('Salbutamol Inhaler', 'Salbutamol Inhaler'),
('Budesonide Inhaler', 'Budesonide Inhaler'),
('Montelukast 10mg', 'Montelukast 10mg'),
('Prednisolone 5mg', 'Prednisolone 5mg'),
('Hydrocortisone Cream', 'Hydrocortisone Cream'),
('Ferrous Sulphate Tablet', 'Ferrous Sulphate Tablet'),
('Folic Acid 5mg', 'Folic Acid 5mg'),
('Calcium Carbonate 500mg', 'Calcium Carbonate 500mg'),
('Vitamin D3 60000 IU', 'Vitamin D3 60000 IU'),
('Vitamin B Complex', 'Vitamin B Complex'),
('Zinc Sulphate 20mg', 'Zinc Sulphate 20mg'),
('Chloroquine 250mg', 'Chloroquine 250mg'),
('Artesunate 50mg', 'Artesunate 50mg'),
('Primaquine 15mg', 'Primaquine 15mg'),
('Insulin Regular', 'Insulin Regular'),
('Glimepiride 2mg', 'Glimepiride 2mg'),
('Gliclazide 80mg', 'Gliclazide 80mg'),
('Levothyroxine 50mcg', 'Levothyroxine 50mcg'),
('Saline Nasal Drops', 'Saline Nasal Drops'),
('Chlorpheniramine 4mg', 'Chlorpheniramine 4mg'),
('Dextromethorphan Syrup', 'Dextromethorphan Syrup'),
('Ambroxol Syrup', 'Ambroxol Syrup'),
('Loperamide 2mg', 'Loperamide 2mg'),
('Lactulose Syrup', 'Lactulose Syrup'),
('Bisacodyl 5mg', 'Bisacodyl 5mg'),
('Diclofenac Gel', 'Diclofenac Gel'),
('Tramadol 50mg', 'Tramadol 50mg'),
('Magnesium Hydroxide Suspension', 'Magnesium Hydroxide Suspension');

-- Keep serial IDs in sync after explicit seed IDs.
SELECT setval(pg_get_serial_sequence('phcs', 'id'), (SELECT MAX(id) FROM phcs));
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));
SELECT setval(pg_get_serial_sequence('stock', 'id'), (SELECT MAX(id) FROM stock));
SELECT setval(pg_get_serial_sequence('feature_snapshots', 'id'), (SELECT MAX(id) FROM feature_snapshots));
SELECT setval(pg_get_serial_sequence('medicine_mappings', 'id'), (SELECT MAX(id) FROM medicine_mappings));
