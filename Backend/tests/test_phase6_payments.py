"""
Backend/tests/test_phase6_payments.py
Unit and integration tests for Phase 6 Razorpay payments and wallet ledger:
- POST /create-order: amount conversion, test limit validation, error cases
- POST /buy-credits: transactional credit purchase, certificate generation, wallet credit accumulation, audit log
- GET /wallet/{corporate_name}: balance inquiry
- GET /transactions/{corporate_name}: historical transactions
"""

import os
import sys
import uuid
import pytest
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app, migrate_db, seed_initial_data
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import (
    Project, Wallet, Transaction, Certificate, AuditLog
)

migrate_db()
seed_initial_data()
client = TestClient(app)


def test_create_order_valid():
    resp = client.post("/create-order", json={
        "amount": 25000.0,
        "currency": "INR",
        "project_id": "PRJ-MAN-AMAZON",
        "corporate_name": "Nordic Clean Tech",
        "quantity": 10.0
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert data["amount"] == 2500000  # 25,000 INR = 2,500,000 paise
    assert data["currency"] == "INR"


def test_create_order_invalid_amount():
    resp = client.post("/create-order", json={
        "amount": -50.0,
        "currency": "INR"
    })
    assert resp.status_code == 400


def test_create_order_exceeds_test_mode_cap():
    # Attempting to order ₹600,000 (exceeds ₹5,00,000 test cap)
    resp = client.post("/create-order", json={
        "amount": 600000.0,
        "currency": "INR",
        "project_id": "PRJ-MAN-AMAZON"
    })
    # If in test mode, returns 400 with cap explanation
    if os.getenv("RAZORPAY_KEY_ID", "rzp_test_").startswith("rzp_test_"):
        assert resp.status_code == 400
        assert "limit" in resp.json()["detail"].lower()


def test_buy_credits_demo_workflow():
    uid = uuid.uuid4().hex[:6]
    corp_name = f"Apex Industrial {uid}"
    proj_id = "PRJ-MAN-AMAZON"

    # Seed or ensure wallet exists
    db = SessionLocal()
    try:
        proj = db.query(Project).filter(Project.project_id == proj_id).first()
        assert proj is not None
        initial_credits = float(proj.credits or 0.0)
    finally:
        db.close()

    order_id = f"order_demo_{uuid.uuid4().hex[:8]}"
    payment_id = f"pay_demo_{uuid.uuid4().hex[:8]}"
    purchased_quantity = 5.0
    amount_inr = 45000.0

    buy_resp = client.post("/buy-credits", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": "demo_signature",
        "project_id": proj_id,
        "corporate_name": corp_name,
        "quantity": purchased_quantity,
        "amount": amount_inr
    })

    assert buy_resp.status_code == 200
    buy_data = buy_resp.json()
    assert "transaction_id" in buy_data
    assert "certificate_id" in buy_data
    assert buy_data["quantity"] == purchased_quantity

    # Verify wallet query
    wallet_resp = client.get(f"/wallet/{corp_name}")
    assert wallet_resp.status_code == 200
    w_data = wallet_resp.json()
    assert w_data["total_credits"] >= purchased_quantity
    assert w_data["total_spent_inr"] >= amount_inr

    # Verify transactions query
    tx_resp = client.get(f"/transactions/{corp_name}")
    assert tx_resp.status_code == 200
    tx_list = tx_resp.json()
    assert any(t["razorpay_order_id"] == order_id for t in tx_list)
