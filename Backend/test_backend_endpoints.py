import requests
import json
from io import BytesIO
from PIL import Image

BASE_URL = "http://127.0.0.1:8000"

def test_endpoint(method, path, **kwargs):
    url = f"{BASE_URL}{path}"
    try:
        resp = requests.request(method, url, timeout=10, **kwargs)
        status = resp.status_code
        ok = 200 <= status < 300
        print(f"[{'PASS' if ok else 'FAIL'}] {method} {path} -> {status}")
        if not ok:
            print(f"   Error: {resp.text[:300]}")
        return ok, resp
    except Exception as e:
        print(f"[FAIL] {method} {path} -> Exception: {e}")
        return False, None

def run_tests():
    print("\n--- TESTING CORE ENDPOINTS ---")
    test_endpoint("GET", "/")
    test_endpoint("GET", "/health")

    print("\n--- TESTING PROJECT ENDPOINTS ---")
    test_endpoint("GET", "/projects/all-projects")
    test_endpoint("GET", "/projects/projects?ngo_id=1")
    test_endpoint("GET", "/projects/dashboard/1")
    test_endpoint("GET", "/projects/map")
    test_endpoint("GET", "/projects/pending")
    test_endpoint("PATCH", "/projects/projects/PRJ-MAN-SUNDAR/status?status=approved")

    # Test create-project with in-memory image
    img = Image.new('RGB', (100, 100), color='green')
    img_byte_arr = BytesIO()
    img.save(img_byte_arr, format='JPEG')
    img_byte_arr.seek(0)

    files = {
        'evidence_image': ('test_evidence.jpg', img_byte_arr, 'image/jpeg')
    }
    data = {
        'project_name': 'Automated Test Plantation',
        'ngo_name': 'EcoGuard Brazil',
        'latitude': -3.465,
        'longitude': -62.215,
        'plantation_type': 'mangrove',
        'area_hectares': 150.0,
        'number_of_trees': 12000,
        'start_date': '2024-05-01',
        'polygon_wkt': 'POLYGON((-62.22 -3.47, -62.21 -3.47, -62.21 -3.46, -62.22 -3.46, -62.22 -3.47))'
    }
    ok, create_resp = test_endpoint("POST", "/projects/create-project", data=data, files=files)
    created_id = "PRJ-MAN-AMAZON"
    if ok and create_resp:
        try:
            created_id = create_resp.json().get("project_id", created_id)
            print(f"   Created Project ID: {created_id}")
        except Exception:
            pass

    print("\n--- TESTING MARKETPLACE ENDPOINTS ---")
    test_endpoint("GET", "/marketplace/listings")
    test_endpoint("GET", "/marketplace/requests/1")
    test_endpoint("POST", "/marketplace/request", json={
        "corporate_name": "Microsoft Sustainability",
        "project_id": "PRJ-MAN-AMAZON",
        "offered_price": 28.50
    })
    test_endpoint("POST", "/marketplace/accept/1")

    print("\n--- TESTING CREDITS ENDPOINTS ---")
    test_endpoint("GET", "/credits/balance/Microsoft%20Sustainability")
    test_endpoint("POST", "/credits/mint", json={
        "project_id": "PRJ-MAN-AMAZON",
        "credits": 500.0
    })
    test_endpoint("POST", "/credits/transfer", json={
        "from_entity": "Microsoft Sustainability",
        "to_entity": "Google Carbon Team",
        "quantity": 100.0,
        "project_id": "PRJ-MAN-AMAZON"
    })

    print("\n--- TESTING PAYMENT / RAZORPAY ENDPOINTS ---")
    test_endpoint("POST", "/payment/create-order", json={
        "amount": 25000.0,
        "currency": "INR",
        "project_id": "PRJ-MAN-AMAZON",
        "corporate_name": "Microsoft Sustainability"
    })
    test_endpoint("POST", "/payment/buy-credits", json={
        "razorpay_order_id": "order_demo_test123",
        "razorpay_payment_id": "pay_demo_test123",
        "razorpay_signature": "demo_signature",
        "project_id": "PRJ-MAN-AMAZON",
        "corporate_name": "Microsoft Sustainability",
        "quantity": 50.0,
        "amount": 118987.5
    })
    test_endpoint("GET", "/payment/transactions/Microsoft%20Sustainability")
    test_endpoint("GET", "/payment/wallet/Microsoft%20Sustainability")

    print("\n--- TESTING GRS ENDPOINTS ---")
    test_endpoint("POST", "/grs/calculate-grs", json={
        "company_name": "Microsoft Sustainability",
        "total_carbon_funded": 15000.0,
        "avg_survival_probability": 0.88,
        "avg_project_suitability": 85.0,
        "avg_project_risk": 0.12,
        "years_committed": 5,
        "transparency_score": 92.0,
        "verification_score": 95.0
    })
    test_endpoint("GET", "/grs/leaderboard")

    print("\n--- TESTING FRAUD DETECTION ENDPOINT ---")
    test_endpoint("POST", "/fraud/check-project", json={
        "project_id": created_id,
        "polygon_wkt": "POLYGON((-62.22 -3.47, -62.21 -3.47, -62.21 -3.46, -62.22 -3.46, -62.22 -3.47))",
        "image_path": ""
    })

    print("\n--- TESTING SITE SUITABILITY ENDPOINT ---")
    test_endpoint("POST", "/suitability/predict", json={
        "lat": -3.465,
        "lon": -62.215,
        "area": 100.0
    })

    print("\n--- TESTING ESG REPORT GENERATOR ENDPOINT ---")
    test_endpoint("POST", "/esg/generate-report", json={
        "corporate_name": "Microsoft Sustainability",
        "project_id": None
    })
    test_endpoint("POST", "/esg/generate-report", json={
        "corporate_name": "Microsoft Sustainability",
        "project_id": "PRJ-MAN-AMAZON"
    })

if __name__ == "__main__":
    run_tests()
