import asyncio
import json
from fastapi.testclient import TestClient
from main import app
from core.events import publish

client = TestClient(app)

def test_realtime_spine():
    # 1. Test ticket generation
    res = client.post("/realtime/ticket", json={"role": "admin", "email": "admin@carbonvault.com"})
    assert res.status_code == 200, f"Ticket failed: {res.text}"
    ticket_data = res.json()
    assert "ticket" in ticket_data
    assert ticket_data["role"] == "admin"
    ticket = ticket_data["ticket"]
    print("Ticket obtained successfully:", ticket[:16], "...")

    # 2. Test publishing an event
    ev_id = publish("project.created", {"project_id": "PRJ-TEST-001", "name": "Test Project"}, audience="all")
    assert ev_id is not None
    print("Event published with id:", ev_id)

    # 3. Test fallback polling endpoint
    res_poll = client.get(f"/realtime/events?since_id=0&role=admin")
    assert res_poll.status_code == 200
    events_data = res_poll.json()
    assert "events" in events_data
    assert len(events_data["events"]) > 0
    print(f"Fallback polling returned {len(events_data['events'])} events OK")

    print("[SUCCESS] Phase 1 Real-time Spine tests passed!")

if __name__ == "__main__":
    test_realtime_spine()
