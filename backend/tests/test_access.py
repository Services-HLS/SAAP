import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
db_file = ROOT / "data" / "test_portal.db"
os.environ["DATABASE_URL"] = "sqlite:///" + db_file.as_posix()
os.environ["SANDBOX_MODE"] = "1"
if db_file.exists():
    db_file.unlink()

from fastapi.testclient import TestClient

from app.main import app, startup

startup()
client = TestClient(app)


def contact_code(phone, email="", channel="mobile"):
    sent = client.post("/api/auth/otp/send", json={"phone": phone, "email": email, "channel": channel})
    assert sent.status_code == 200, sent.text
    assert "no sms or email provider" in sent.json()["notice"].lower()
    return sent.json()["sandbox_otp"]


def auth(username):
    response = client.post("/api/auth/login", json={"username": username, "password": "demo123"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_student_cannot_read_audit_or_pay():
    student = auth("student")
    assert client.get("/api/audit", headers=student).status_code == 403
    reward = client.post("/api/rewards", json={"amount": 1500, "bank_last4": "4412"}, headers=student)
    assert reward.status_code == 200
    assert client.post(f"/api/rewards/{reward.json()['id']}/approve", headers=student).status_code == 403
    assert client.post(f"/api/rewards/{reward.json()['id']}/pay", json={"status": "processed"}, headers=student).status_code == 403


def test_district_boundary_and_eligibility():
    student = auth("student2")
    events = client.get("/api/events").json()
    created = client.post("/api/events/register", json={"event_id": events[0]["id"]}, headers=student)
    assert created.status_code == 200, created.text
    department = auth("department")
    assert client.post(f"/api/registrations/{created.json()['id']}/review", json={"status": "approved"}, headers=department).status_code == 403
    admin = auth("admin")
    assert client.post(f"/api/registrations/{created.json()['id']}/review", json={"status": "approved"}, headers=admin).status_code == 200


def test_new_student_follows_age_and_bank_rules():
    created = client.post("/api/auth/register", json={
        "full_name": "Lalitha Rao",
        "username": "lalitha",
        "password": "demo123",
        "phone": "9000000199",
        "otp": contact_code("9000000199"),
        "district": "Krishna",
        "dob": "2015-04-02",
        "gender": "Female",
        "aadhaar_last4": "6677",
        "bank_name": "State Bank",
        "bank_last4": "2291",
    })
    assert created.status_code == 200, created.text
    token = {"Authorization": f"Bearer {created.json()['token']}"}
    assert created.json()["bank_status"] == "sandbox-matched"
    blocked = client.post("/api/events/register", json={"event_id": 1}, headers=token)
    assert blocked.status_code == 400
    otp = client.post("/api/students/me/otp", headers=token).json()["sandbox_otp"]
    assert client.post("/api/students/me/otp/verify", json={"otp": otp}, headers=token).status_code == 200
    events = client.get("/api/events", headers=token).json()
    assert events[0]["eligible"] is True
    assert client.post("/api/events/register", json={"event_id": events[0]["id"]}, headers=token).status_code == 200
    older = client.post("/api/auth/register", json={
        "full_name": "Senior Player",
        "username": "seniorplayer",
        "password": "demo123",
        "phone": "9000000188",
        "otp": contact_code("9000000188"),
        "district": "Krishna",
        "dob": "2000-04-02",
        "gender": "Male",
        "aadhaar_last4": "1010",
        "bank_name": "State Bank",
        "bank_last4": "0000",
    })
    assert older.status_code == 200, older.text
    assert older.json()["bank_status"] == "sandbox-failed"
    older_token = {"Authorization": f"Bearer {older.json()['token']}"}
    older_otp = client.post("/api/students/me/otp", headers=older_token).json()["sandbox_otp"]
    client.post("/api/students/me/otp/verify", json={"otp": older_otp}, headers=older_token)
    older_events = client.get("/api/events", headers=older_token).json()
    assert older_events[0]["eligible"] is False
    refused = client.post("/api/events/register", json={"event_id": events[0]["id"]}, headers=older_token)
    assert refused.status_code == 400
    assert client.get("/api/reports", headers=token).status_code == 403
    admin = auth("admin")
    summary = client.get("/api/reports", headers=admin)
    assert summary.status_code == 200
    assert summary.json()["bank"]["unvalidated"] >= 1


def test_chain_and_chat_safety():
    auditor = auth("auditor")
    verified = client.get("/api/audit/verify", headers=auditor)
    assert verified.json()["ok"] is True
    assert client.post("/api/audit/anchor", headers=auditor).status_code == 403
    chat = client.post("/api/chat", json={"question": "Please approve payment for this reward"})
    assert "cannot approve" in chat.json()["answer"].lower()


def test_reward_bank_must_match_and_payment_is_once():
    student = auth("student")
    mismatch = client.post("/api/rewards", json={"amount": 200, "bank_last4": "7788"}, headers=student)
    assert mismatch.status_code == 400
    claim = client.post("/api/rewards", json={"amount": 200, "bank_last4": "4412"}, headers=student)
    assert claim.status_code == 200, claim.text
    assert claim.json()["simulation"] is True
    reward_id = claim.json()["id"]
    department = auth("department")
    assert client.post(f"/api/rewards/{reward_id}/approve", headers=department).status_code == 200
    accountant = auth("accountant")
    paid = client.post(f"/api/rewards/{reward_id}/pay", json={"status": "processed"}, headers=accountant)
    assert paid.status_code == 200, paid.text
    assert "no bank transfer" in paid.json()["notice"].lower()
    assert client.post(f"/api/rewards/{reward_id}/pay", json={"status": "processed"}, headers=accountant).status_code == 400


def test_department_reports_stay_inside_the_district():
    department = auth("department")
    admin = auth("admin")
    dept = client.get("/api/reports", headers=department)
    full = client.get("/api/reports", headers=admin)
    assert dept.status_code == 200
    assert dept.json()["scope"] == "Krishna"
    assert full.json()["scope"] == "all"
    assert dept.json()["students"] < full.json()["students"]
    assert isinstance(full.json()["by_district"], list)
    assert dept.json()["by_district"] is None
    dash = client.get("/api/dashboard", headers=department)
    assert dash.status_code == 200
    assert dash.json()["scope"] == "Krishna"
    assert dash.json()["pending_registrations"] is not None


def test_admin_can_add_an_event_and_audit_lists_the_actor():
    admin = auth("admin")
    sport = client.post("/api/sports", json={"name": "Kho-Kho"}, headers=admin)
    assert sport.status_code == 200, sport.text
    assert client.post("/api/sports", json={"name": "Kho-Kho"}, headers=auth("student")).status_code == 403
    category = client.post("/api/age-categories", json={"name": "Under 12", "min_age": 8, "max_age": 12}, headers=admin)
    assert category.status_code == 200, category.text
    created = client.post("/api/events", json={
        "name": "Krishna Kho-Kho Meet",
        "sport_id": sport.json()["id"],
        "district": "Krishna",
        "venue": "IGMC Stadium",
        "age_category_id": category.json()["id"],
        "deadline": "2026-12-01",
        "held_on": "2026-11-15",
        "capacity": 20,
    }, headers=admin)
    assert created.status_code == 200, created.text
    outside = client.post("/api/events", json={
        "name": "Vizag Meet",
        "sport_id": sport.json()["id"],
        "district": "Visakhapatnam",
        "venue": "District ground",
        "age_category_id": category.json()["id"],
        "deadline": "2026-12-01",
        "held_on": "2026-11-15",
        "capacity": 20,
    }, headers=auth("department"))
    assert outside.status_code == 403
    audit = client.get("/api/audit", headers=auth("auditor"))
    assert audit.status_code == 200
    assert audit.json()[0]["actor"]
    assert audit.json()[0]["time"]


def test_otp_login_ip_permissions_chain_and_qr():
    refused = client.post("/api/auth/register", json={
        "full_name": "Unverified Player",
        "username": "unverified",
        "password": "demo123",
        "phone": "9000000177",
        "otp": "000000",
        "district": "Krishna",
        "dob": "2015-04-02",
        "gender": "Female",
        "aadhaar_last4": "7788",
        "bank_name": "State Bank",
        "bank_last4": "2291",
    })
    assert refused.status_code == 400
    code = contact_code("9000000177", "player@example.com", "email")
    created = client.post("/api/auth/register", json={
        "full_name": "Verified Player",
        "username": "verifiedplayer",
        "password": "demo123",
        "phone": "9000000177",
        "email": "player@example.com",
        "otp": code,
        "district": "Krishna",
        "dob": "2015-04-02",
        "gender": "Female",
        "aadhaar_last4": "7788",
        "bank_name": "State Bank",
        "bank_last4": "2291",
    })
    assert created.status_code == 200, created.text
    token = {"Authorization": f"Bearer {created.json()['token']}"}
    me = client.get("/api/me", headers=token)
    assert me.json()["phone_verified"] is True
    assert "event.register" in me.json()["permissions"]
    assert "payment.process" not in me.json()["permissions"]
    client.post("/api/auth/login", json={"username": "verifiedplayer", "password": "wrong-pass"})
    aadhaar = client.post("/api/students/me/otp", headers=token).json()["sandbox_otp"]
    assert client.post("/api/students/me/otp/verify", json={"otp": aadhaar}, headers=token).status_code == 200
    events = client.get("/api/events", headers=token).json()
    registration = client.post("/api/events/register", json={"event_id": events[0]["id"]}, headers=token)
    assert registration.status_code == 200, registration.text
    department = auth("department")
    assert client.post(f"/api/registrations/{registration.json()['id']}/review", json={"status": "approved"}, headers=department).status_code == 200
    operator = auth("operator")
    attended = client.post("/api/attendance", json={"registration_id": registration.json()["id"], "status": "present"}, headers=operator)
    assert attended.status_code == 200, attended.text
    assert len(attended.json()["chain_hash"]) == 64
    issued = client.post(f"/api/certificates/{registration.json()['id']}", headers=department)
    assert issued.status_code == 200, issued.text
    checked = client.get(f"/api/certificates/verify/{issued.json()['reference_no']}")
    assert checked.status_code == 200, checked.text
    body = checked.json()
    assert body["student"] == "Verified Player"
    assert body["participation"]["status"] == "present"
    assert body["chain"]["intact"] is True
    assert body["chain"]["hash"] == issued.json()["chain_hash"]
    qr = client.get(f"/api/certificates/verify/{issued.json()['reference_no']}/qr")
    assert qr.status_code == 200
    assert "svg" in qr.headers["content-type"]
    assert b"<svg" in qr.content
    chat = client.post("/api/chat", json={"question": "What is my registration status?"}, headers=token)
    assert chat.json()["source"] == "account-records"
    assert "Verified Player" in chat.json()["answer"]
    auditor = auth("auditor")
    rows = client.get("/api/audit", headers=auditor).json()
    failed = [row for row in rows if row["action"] == "LOGIN_FAILED"]
    assert failed and failed[0]["ip"]
    logins = [row for row in rows if row["action"] == "LOGIN"]
    assert any(row["ip"] for row in logins)
    from sqlalchemy import select
    from app.db import SessionLocal
    from app.models import AuditEvent
    db = SessionLocal()
    try:
        stored = db.scalar(select(AuditEvent).where(AuditEvent.action == "LOGIN_FAILED").order_by(AuditEvent.id.desc()))
        assert "password" not in (stored.metadata_json or "")
    finally:
        db.close()
