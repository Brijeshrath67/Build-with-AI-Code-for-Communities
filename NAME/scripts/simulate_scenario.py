import requests
import time
import sys

API_URL = "http://localhost:8000/api/v1"

def print_section(title):
    print("\n" + "=" * 55)
    print(f" {title}")
    print("=" * 55)

def run_simulation():
    print("Starting End-to-End Simulation for PHC Exchange...\n")
    
    # 1. Log in as ASHA Worker to view stock and trigger alert
    print_section("1. Authenticating Demo Users")
    
    # ASHA Worker credentials
    login_payload = {"phone": "8888888888", "password": "password123"}
    try:
        res = requests.post(f"{API_URL}/auth/login", json=login_payload)
        res.raise_for_status()
        token_data = res.json()
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"[OK] Successfully authenticated ASHA Worker: {token_data['user']['name']} (PHC #{token_data['user']['phc_id']})")
    except Exception as e:
        print(f"[FAIL] Authentication failed. Is the API service running on port 8000? Error: {e}")
        sys.exit(1)

    # PHC Staff credentials (to approve transfer later)
    staff_payload = {"phone": "6666666666", "password": "password123"}
    res_staff = requests.post(f"{API_URL}/auth/login", json=staff_payload)
    res_staff.raise_for_status()
    staff_token = res_staff.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    print(f"[OK] Successfully authenticated PHC Staff: {res_staff.json()['user']['name']} (PHC #{res_staff.json()['user']['phc_id']})")

    # 2. View current stock at UPHC Unit-9
    print_section("2. Fetching Current Stock at UPHC Unit-9 (PHC #1)")
    res = requests.get(f"{API_URL}/stock/1", headers=headers)
    res.raise_for_status()
    stock_items = res.json()
    pcm_stock = next((s for s in stock_items if s["medicine"] == "Paracetamol 500mg"), None)
    if pcm_stock:
        print(f"[OK] Paracetamol 500mg stock: {pcm_stock['quantity']} units (Expires: {pcm_stock['expiry_date']})")
    else:
        print("[FAIL] Paracetamol stock not found at UPHC Unit-9")
        sys.exit(1)

    # 3. Generate Stockout Prediction / Forecast
    print_section("3. Running AI Forecasting Engine for PHC #1")
    res = requests.get(f"{API_URL}/forecast/1", headers=headers)
    res.raise_for_status()
    forecasts = res.json()
    pcm_forecast = next((f for f in forecasts if f["medicine"] == "Paracetamol 500mg"), None)
    if pcm_forecast:
        print(f"[OK] AI Forecast Alert generated!")
        print(f"  Medicine:        {pcm_forecast['medicine']}")
        print(f"  Stockout Risk:   {pcm_forecast['risk_score']}")
        print(f"  Stockout Date:   {pcm_forecast['stockout_date']}")
    else:
        print("[FAIL] AI Forecast failed to generate")
        sys.exit(1)

    # 4. Search nearby surplus candidates
    print_section("4. Querying AI Geospatial Match Engine for Surplus")
    res = requests.get(f"{API_URL}/match/1", params={"medicine": "Paracetamol 500mg", "required_quantity": 200}, headers=headers)
    res.raise_for_status()
    matches = res.json()
    recommendations = matches["recommendations"]
    print(f"Found {len(recommendations)} candidate matching PHCs for {matches['medicine']}:")
    for r in recommendations:
        print(f"  - {r['phc_name']} (PHC #{r['phc_id']}): {r['distance_km']} km away, {r['available_surplus']} units surplus (Expires {r['expiry_date']})")

    if not recommendations:
        print("[FAIL] No surplus candidates found")
        sys.exit(1)
        
    best_candidate = recommendations[0]
    print(f"\n--> AI Recommendation: Transfer from {best_candidate['phc_name']} (PHC #{best_candidate['phc_id']})")

    # 5. Create Transfer Request
    print_section("5. Creating Lateral Transfer Request")
    transfer_payload = {
        "source_phc_id": best_candidate["phc_id"],
        "destination_phc_id": 1, # UPHC Unit-9
        "medicine": "Paracetamol 500mg",
        "quantity": 200
    }
    res = requests.post(f"{API_URL}/transfer/create", json=transfer_payload, headers=staff_headers)
    res.raise_for_status()
    transfer = res.json()
    print(f"[OK] Transfer Request Created (ID: #{transfer['id']})")
    print(f"  Status: {transfer['status']}")
    print(f"  Amount: {transfer['quantity']} units of {transfer['medicine']}")

    # 6. Approve and Execute Transfer
    print_section("6. Executing and Auditing Transfer")
    approve_res = requests.post(f"{API_URL}/transfer/approve/{transfer['id']}", headers=staff_headers)
    approve_res.raise_for_status()
    executed_transfer = approve_res.json()
    print(f"[OK] Transfer Execution Audited & Ledger Logged!")
    print(f"  New Status:  {executed_transfer['status']}")
    print(f"  Approved By: User #{executed_transfer['approved_by']} at {executed_transfer['approved_at']}")

    # 7. Verify Inventories Updated
    print_section("7. Verifying Inventory Redistribution Outcome")
    
    # Destination PHC (Unit-9)
    res = requests.get(f"{API_URL}/stock/1", headers=headers)
    dest_stock = next((s for s in res.json() if s["medicine"] == "Paracetamol 500mg"), None)
    
    # Source PHC (Unit-3)
    res = requests.get(f"{API_URL}/stock/2", headers=staff_headers)
    source_stock = next((s for s in res.json() if s["medicine"] == "Paracetamol 500mg"), None)

    print("Final Stock Levels:")
    print(f"  PHC UPHC Unit-9 (Recipient): {dest_stock['quantity']} units (Previous: {pcm_stock['quantity']})")
    print(f"  PHC UPHC Unit-3 (Supplier):  {source_stock['quantity']} units (Previous: 800)")
    
    if dest_stock['quantity'] == pcm_stock['quantity'] + 200 and source_stock['quantity'] == 800 - 200:
        print("\n=== SUCCESS: End-to-end lateral redistribution scenario completed. Stockout prevented successfully! ===")
    else:
        print("\n[WARNING] Inventory mismatch. Expected dest={}, source={} but got dest={}, source={}".format(
            pcm_stock['quantity'] + 200, 800 - 200,
            dest_stock['quantity'], source_stock['quantity']
        ))

if __name__ == "__main__":
    run_simulation()
