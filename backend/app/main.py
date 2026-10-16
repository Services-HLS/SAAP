import hashlib
import json
import os
import random
import secrets
from datetime import date, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .auditlog import append_audit, proof_for, verify_chain
from .db import Base, engine, ensure_schema, get_db
from .models import (
    AadhaarKycSession,
    AgeCategory,
    AuditCheckpoint,
    AuditEvent,
    BankValidationRecord,
    BiometricVerificationLog,
    BlockchainAnchor,
    Certificate,
    ChatbotConversation,
    ContactOtp,
    StudentBank,
    Event,
    EventRegistration,
    InventoryItem,
    InventoryTransaction,
    ItemAcknowledgement,
    Notification,
    OtpChallenge,
    ParticipationRecord,
    RewardApplication,
    RewardTransaction,
    Sport,
    Student,
    SupportTicket,
    User,
    UserRoleAssignment,
    WhatsAppMessageLog,
)
from .sandbox_kyc import (
    SandboxKycError,
    credentials_configured,
    generate_otp as sandbox_generate_otp,
    map_dob,
    map_gender,
    verify_otp as sandbox_verify_otp,
)
from .security import SANDBOX, check_password, hash_password, hash_secret, make_token, read_token
from .seed import ensure_demo_banks, seed

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

app = FastAPI(title="Sports registration platform", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ROLE_PERMS = {
    "student": {"profile.own", "event.register", "certificate.own", "reward.own", "inventory.ack"},
    "department": {"registration.review", "event.manage", "certificate.issue", "reward.approve", "inventory.issue", "audit.read"},
    "operator": {"attendance.record"},
    "accountant": {"payment.process", "audit.read"},
    "admin": {"users.manage", "audit.read", "audit.anchor", "registration.review", "event.manage", "certificate.issue", "reward.approve", "inventory.issue", "payment.process", "attendance.record"},
    "auditor": {"audit.read"},
}


def bearer(authorization: str | None = Header(default=None)) -> str | None:
    return authorization


def current_user(db: Session, authorization: str | None) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in required")
    payload = read_token(authorization.split(" ", 1)[1])
    if not payload:
        raise HTTPException(401, "Session expired")
    user = db.get(User, payload["sub"])
    if not user or not user.active:
        raise HTTPException(401, "Account is not active")
    return user


def require(user: User, permission: str) -> None:
    if permission not in ROLE_PERMS.get(user.role, set()):
        raise HTTPException(403, "You do not have permission for this action")


def district_ok(user: User, district: str) -> None:
    if user.role in {"admin", "auditor", "accountant"}:
        return
    if user.role == "student":
        return
    if user.district and district and user.district != district:
        raise HTTPException(403, "This record is outside your district")


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return ""


def verify_page(reference_no: str) -> str:
    base = os.environ.get("PUBLIC_APP_URL", "http://127.0.0.1:5173").rstrip("/")
    return f"{base}/cert/{reference_no}"


def issuer_payload(db: Session, cert: Certificate) -> dict:
    actor = None
    if cert.issued_by_user_id:
        actor = db.get(User, cert.issued_by_user_id)
    if not actor:
        audit = db.scalar(
            select(AuditEvent)
            .where(AuditEvent.entity == "certificate", AuditEvent.entity_id == str(cert.id), AuditEvent.action == "CERTIFICATE_ISSUED")
            .order_by(AuditEvent.id.desc())
        )
        if audit and audit.actor_id:
            actor = db.get(User, audit.actor_id)
    if not actor:
        return {"name": "", "username": "", "role": "", "district": ""}
    return {
        "name": actor.full_name,
        "username": actor.username,
        "role": actor.role,
        "district": actor.district or "",
    }


def qr_svg(value: str) -> str:
    import qrcode
    import qrcode.image.svg

    image = qrcode.make(value, image_factory=qrcode.image.svg.SvgPathImage, border=2)
    stream = __import__("io").BytesIO()
    image.save(stream)
    return stream.getvalue().decode()


def own_student(db: Session, user: User) -> Student:
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    if not student:
        raise HTTPException(404, "Student profile not found")
    return student


def age_on(dob: date, day: date) -> int:
    years = day.year - dob.year
    if (day.month, day.day) < (dob.month, dob.day):
        years -= 1
    return years


def event_day(event: Event) -> date:
    if event.held_on:
        return event.held_on
    deadline = event.deadline
    return deadline.date() if isinstance(deadline, datetime) else deadline


def certificate_hash(reference_no: str, title: str, student_id: int, registration_id: int, status: str) -> str:
    body = {
        "reference_no": reference_no,
        "registration_id": registration_id,
        "status": status,
        "student_id": student_id,
        "title": title,
    }
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def same_district(user: User) -> bool:
    return user.role == "department"


def notify(db: Session, user: User, template: str, body: str) -> None:
    if not user.phone:
        return
    note = Notification(user_id=user.id, channel="whatsapp-sandbox", template=template, body=body, status="sandbox-logged")
    db.add(note)
    db.flush()
    db.add(WhatsAppMessageLog(notification_id=note.id, provider_ref=f"sandbox-{note.id}", status="sandbox-logged"))


class LoginIn(BaseModel):
    username: str
    password: str


class StudentRegisterIn(BaseModel):
    full_name: str = Field(min_length=3, max_length=160)
    username: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_.]+$")
    password: str = Field(min_length=6, max_length=80)
    phone: str = Field(pattern=r"^\d{10}$")
    email: str = ""
    otp: str = Field(min_length=6, max_length=6)
    district: str = Field(min_length=2, max_length=80)
    dob: date
    gender: str
    aadhaar_last4: str = Field(pattern=r"^\d{4}$")
    bank_name: str = Field(min_length=2, max_length=80)
    bank_last4: str = Field(pattern=r"^\d{4}$")
    kyc_token: str = ""


class ContactOtpIn(BaseModel):
    phone: str = Field(pattern=r"^\d{10}$")
    email: str = ""
    channel: str = "mobile"


class OtpIn(BaseModel):
    otp: str = Field(min_length=6, max_length=6)


class AadhaarOtpSendIn(BaseModel):
    aadhaar_number: str = Field(pattern=r"^\d{12}$")
    consent: str = "Y"
    reason: str = "KYC verification"


class AadhaarOtpVerifyIn(BaseModel):
    reference_id: str = Field(min_length=1, max_length=80)
    otp: str = Field(min_length=6, max_length=6)

    @field_validator("reference_id", "otp", mode="before")
    @classmethod
    def coerce_str(cls, value):
        return str(value).strip() if value is not None else value


class RegisterEventIn(BaseModel):
    event_id: int


class ReviewIn(BaseModel):
    status: str


class AttendanceIn(BaseModel):
    registration_id: int
    status: str = "present"
    exception_note: str = ""


class RewardIn(BaseModel):
    amount: int = Field(gt=0, le=50000)
    bank_last4: str = Field(pattern=r"^\d{4}$")


class PayIn(BaseModel):
    status: str


class IssueItemIn(BaseModel):
    item_id: int
    student_id: int
    quantity: int = 1


class SportIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    min_age: int = Field(ge=4, le=80)
    max_age: int = Field(ge=4, le=80)


class EventIn(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    sport_id: int
    district: str = Field(min_length=2, max_length=80)
    venue: str = Field(min_length=2, max_length=160)
    age_category_id: int
    deadline: date
    held_on: date
    capacity: int = Field(gt=0, le=5000)


class EventPatch(BaseModel):
    name: str | None = None
    venue: str | None = None
    district: str | None = None
    deadline: date | None = None
    held_on: date | None = None
    capacity: int | None = Field(default=None, gt=0, le=5000)
    sport_id: int | None = None
    age_category_id: int | None = None


class ItemIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    stock: int = Field(ge=0, le=100000)


class RestockIn(BaseModel):
    quantity: int = Field(ge=1, le=100000)


class UserPatch(BaseModel):
    active: bool


class ChatIn(BaseModel):
    question: str = Field(min_length=2, max_length=500)
    role_hint: str = ""


class TicketIn(BaseModel):
    subject: str
    detail: str


@app.on_event("startup")
def startup():
    Base.metadata.create_all(engine)
    ensure_schema()
    from .db import SessionLocal

    db = SessionLocal()
    try:
        seed(db)
        ensure_demo_banks(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "sandbox": SANDBOX,
        "sandbox_co_in": credentials_configured(),
        "notice": "Demonstration platform. Not an official government service.",
    }


@app.post("/api/kyc/aadhaar/otp")
async def send_aadhaar_otp(body: AadhaarOtpSendIn, request: Request, db: Session = Depends(get_db)):
    if body.consent.upper() != "Y":
        raise HTTPException(400, "Aadhaar verification requires consent = Y")
    aadhaar = body.aadhaar_number
    aadhaar_hash = hash_secret(aadhaar)
    last4 = aadhaar[-4:]

    for old in db.scalars(
        select(AadhaarKycSession).where(
            AadhaarKycSession.aadhaar_hash == aadhaar_hash,
            AadhaarKycSession.used.is_(False),
            AadhaarKycSession.status == "otp_sent",
        )
    ).all():
        old.status = "superseded"

    provider = "sandbox.co.in"
    reference_id = ""
    local_otp = ""
    provider_tx = ""
    notice = "OTP sent to the mobile number linked with Aadhaar."

    if credentials_configured():
        try:
            result = await sandbox_generate_otp(aadhaar, reason=body.reason or "KYC verification")
            reference_id = result["reference_id"]
            provider_tx = str(result.get("transaction_id") or "")
            notice = result.get("message") or notice
        except SandboxKycError as exc:
            raise HTTPException(exc.status_code if 400 <= exc.status_code < 600 else 502, exc.message) from exc
    else:
        # Local fallback when SANDBOX_API_KEY / SECRET are not set.
        provider = "local-demo"
        reference_id = f"LOCAL-{secrets.token_hex(6).upper()}"
        local_otp = f"{random.randint(0, 999999):06d}"
        notice = (
            "Sandbox.co.in API keys are not configured, so a local demonstration OTP is shown. "
            "Add SANDBOX_API_KEY and SANDBOX_API_SECRET from https://console.sandbox.co.in to use live test OTP."
        )

    session = AadhaarKycSession(
        reference_id=reference_id,
        aadhaar_hash=aadhaar_hash,
        aadhaar_last4=last4,
        provider=provider,
        status="otp_sent",
        local_otp_hash=hash_secret(local_otp) if local_otp else "",
        provider_tx=provider_tx,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(session)
    append_audit(
        db,
        None,
        "AADHAAR_OTP_REQUESTED",
        "aadhaar_kyc",
        reference_id,
        {"provider": provider, "aadhaar_last4": last4, "ip": client_ip(request)},
        ip=client_ip(request),
    )
    db.commit()

    payload = {
        "sent": True,
        "reference_id": reference_id,
        "provider": provider,
        "aadhaar_masked": f"XXXX-XXXX-{last4}",
        "notice": notice,
    }
    if local_otp:
        payload["sandbox_otp"] = local_otp
    return payload


@app.post("/api/kyc/aadhaar/otp/verify")
async def verify_aadhaar_otp(body: AadhaarOtpVerifyIn, request: Request, db: Session = Depends(get_db)):
    session = db.scalar(
        select(AadhaarKycSession)
        .where(AadhaarKycSession.reference_id == body.reference_id, AadhaarKycSession.used.is_(False))
        .order_by(AadhaarKycSession.id.desc())
    )
    if not session or session.expires_at < datetime.utcnow():
        raise HTTPException(400, "Aadhaar OTP session is missing or expired. Request a new OTP.")
    if session.status not in {"otp_sent", "verified"}:
        raise HTTPException(400, "This Aadhaar OTP session can no longer be verified")

    profile = {
        "name": "",
        "dob": "",
        "gender": "",
        "full_address": "",
    }

    if session.provider == "sandbox.co.in":
        try:
            result = await sandbox_verify_otp(body.reference_id, body.otp)
        except SandboxKycError as exc:
            raise HTTPException(exc.status_code if 400 <= exc.status_code < 600 else 502, exc.message) from exc
        profile["name"] = result.get("name") or ""
        profile["dob"] = map_dob(result.get("date_of_birth") or "")
        profile["gender"] = map_gender(result.get("gender") or "")
        profile["full_address"] = result.get("full_address") or ""
        session.provider_tx = str(result.get("transaction_id") or session.provider_tx)
    else:
        if not session.local_otp_hash or session.local_otp_hash != hash_secret(body.otp):
            raise HTTPException(400, "The OTP is incorrect or expired")

    kyc_token = secrets.token_urlsafe(24)
    session.status = "verified"
    session.name = profile["name"]
    session.dob = profile["dob"]
    session.gender = profile["gender"]
    session.full_address = profile["full_address"]
    session.kyc_token_hash = hash_secret(kyc_token)
    session.expires_at = datetime.utcnow() + timedelta(hours=2)
    append_audit(
        db,
        None,
        "AADHAAR_OTP_VERIFIED",
        "aadhaar_kyc",
        session.reference_id,
        {"provider": session.provider, "aadhaar_last4": session.aadhaar_last4, "ip": client_ip(request)},
        ip=client_ip(request),
    )
    db.commit()

    return {
        "verified": True,
        "kyc_token": kyc_token,
        "aadhaar_last4": session.aadhaar_last4,
        "aadhaar_masked": f"XXXX-XXXX-{session.aadhaar_last4}",
        "name": session.name,
        "dob": session.dob,
        "gender": session.gender,
        "full_address": session.full_address,
        "provider": session.provider,
        "notice": "Aadhaar verified. Complete the player profile to finish registration.",
    }


@app.post("/api/auth/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    user = db.scalar(select(User).where(User.username == body.username))
    if not user or not check_password(body.password, user.password_hash):
        append_audit(db, user.id if user else None, "LOGIN_FAILED", "user", user.id if user else "", {"username": body.username, "ip": ip}, ip=ip)
        db.commit()
        raise HTTPException(401, "Username or password is incorrect")
    append_audit(db, user.id, "LOGIN", "user", user.id, {"username": user.username, "ip": ip}, ip=ip)
    db.commit()
    return {"token": make_token(user.id, user.role, user.district), "role": user.role, "name": user.full_name, "district": user.district, "permissions": sorted(ROLE_PERMS.get(user.role, set()))}


@app.post("/api/auth/otp/send")
def send_contact_otp(body: ContactOtpIn, request: Request, db: Session = Depends(get_db)):
    channel = body.channel if body.channel in {"mobile", "email"} else "mobile"
    email = body.email.strip().lower()
    if channel == "email" and "@" not in email:
        raise HTTPException(400, "Enter an email address to receive the email code")
    code = f"{random.randint(0, 999999):06d}"
    for old in db.scalars(select(ContactOtp).where(ContactOtp.phone == body.phone, ContactOtp.used.is_(False))).all():
        old.used = True
    db.add(ContactOtp(
        phone=body.phone,
        email=email,
        channel=channel,
        otp_hash=hash_secret(code),
        expires_at=datetime.utcnow() + timedelta(minutes=5),
    ))
    db.commit()
    destination = email if channel == "email" else f"******{body.phone[-4:]}"
    return {
        "sent": True,
        "channel": channel,
        "destination": destination,
        "sandbox_otp": code if SANDBOX else None,
        "notice": "No SMS or email provider is connected. The code is shown here so this demonstration can be completed. It expires in 5 minutes.",
        "ip": client_ip(request),
    }


@app.post("/api/auth/register")
def register_student(body: StudentRegisterIn, request: Request, db: Session = Depends(get_db)):
    if body.gender not in {"Female", "Male", "Other"}:
        raise HTTPException(400, "Gender must be Female, Male, or Other")
    if db.scalar(select(User).where(User.username == body.username)):
        raise HTTPException(400, "That username is already in use")
    if db.scalar(select(Student).where(Student.phone == body.phone)):
        raise HTTPException(400, "A student with this mobile number is already registered")
    duplicate = db.scalar(select(Student).where(Student.aadhaar_last4 == body.aadhaar_last4, Student.dob == body.dob))
    if duplicate:
        raise HTTPException(400, "A student with this date of birth and Aadhaar ending is already registered")
    email = body.email.strip().lower()
    challenge = db.scalar(select(ContactOtp).where(ContactOtp.phone == body.phone, ContactOtp.used.is_(False)).order_by(ContactOtp.id.desc()))
    if not challenge or challenge.expires_at < datetime.utcnow() or challenge.otp_hash != hash_secret(body.otp):
        raise HTTPException(400, "The mobile or email code is missing, expired, or incorrect")
    if challenge.channel == "email" and challenge.email != email:
        raise HTTPException(400, "The email code does not match the email entered")
    challenge.used = True

    kyc_session = None
    aadhaar_verified = False
    if body.kyc_token:
        kyc_session = db.scalar(
            select(AadhaarKycSession).where(
                AadhaarKycSession.kyc_token_hash == hash_secret(body.kyc_token),
                AadhaarKycSession.status == "verified",
                AadhaarKycSession.used.is_(False),
            )
        )
        if not kyc_session or kyc_session.expires_at < datetime.utcnow():
            raise HTTPException(400, "Aadhaar KYC token is missing or expired. Verify Aadhaar again.")
        if kyc_session.aadhaar_last4 != body.aadhaar_last4:
            raise HTTPException(400, "Aadhaar ending does not match the verified KYC session")
        aadhaar_verified = True

    user = User(
        username=body.username,
        full_name=body.full_name.strip(),
        password_hash=hash_password(body.password),
        role="student",
        district=body.district,
        phone=body.phone,
    )
    db.add(user)
    db.flush()
    db.add(UserRoleAssignment(user_id=user.id, role_name="student"))
    count = db.scalar(select(func.count()).select_from(Student)) or 0
    student = Student(
        user_id=user.id,
        full_name=user.full_name,
        dob=body.dob,
        gender=body.gender,
        district=body.district,
        phone=body.phone,
        email=email,
        phone_verified=True,
        aadhaar_last4=body.aadhaar_last4,
        aadhaar_verified=aadhaar_verified,
        status="approved" if aadhaar_verified else "draft",
        reference_no=f"STU-2026-{count + 1:04d}",
    )
    db.add(student)
    db.flush()
    if kyc_session:
        kyc_session.used = True
    bank_status = "sandbox-failed" if body.bank_last4 == "0000" else "sandbox-matched"
    db.add(StudentBank(student_id=student.id, bank_name=body.bank_name.strip(), bank_last4=body.bank_last4, status=bank_status))
    append_audit(
        db,
        user.id,
        "STUDENT_REGISTERED",
        "student",
        student.id,
        {
            "reference_no": student.reference_no,
            "bank_status": bank_status,
            "otp_channel": challenge.channel,
            "aadhaar_verified": aadhaar_verified,
            "kyc_provider": kyc_session.provider if kyc_session else None,
            "ip": client_ip(request),
        },
        ip=client_ip(request),
    )
    db.commit()
    return {
        "token": make_token(user.id, user.role, user.district),
        "role": user.role,
        "name": user.full_name,
        "district": user.district,
        "reference_no": student.reference_no,
        "bank_status": bank_status,
        "aadhaar_verified": aadhaar_verified,
    }


@app.get("/api/me")
def me(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    bank = db.scalar(select(StudentBank).where(StudentBank.student_id == student.id)) if student else None
    return {
        "id": user.id,
        "name": user.full_name,
        "role": user.role,
        "permissions": sorted(ROLE_PERMS.get(user.role, set())),
        "district": user.district,
        "student_id": student.id if student else None,
        "reference_no": student.reference_no if student else None,
        "dob": student.dob.isoformat() if student else None,
        "age": age_on(student.dob, date.today()) if student else None,
        "gender": student.gender if student else None,
        "phone": student.phone if student else user.phone,
        "email": student.email if student else "",
        "phone_verified": bool(student.phone_verified) if student else False,
        "aadhaar_masked": f"XXXX-XXXX-{student.aadhaar_last4}" if student and student.aadhaar_last4 else None,
        "aadhaar_verified": student.aadhaar_verified if student else False,
        "bank_name": bank.bank_name if bank else None,
        "bank_last4": bank.bank_last4 if bank else None,
        "bank_status": bank.status if bank else None,
    }


@app.post("/api/students/me/otp")
def request_otp(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "profile.own")
    student = own_student(db, user)
    code = f"{random.randint(0, 999999):06d}"
    db.add(OtpChallenge(student_id=student.id, otp_hash=hash_secret(code), expires_at=datetime.utcnow() + timedelta(minutes=5)))
    append_audit(db, user.id, "OTP_REQUESTED", "student", student.id, {"sandbox": SANDBOX})
    db.commit()
    payload = {"sent": True, "sandbox": SANDBOX}
    if SANDBOX:
        payload["sandbox_otp"] = code
    return payload


@app.post("/api/students/me/otp/verify")
def verify_otp(body: OtpIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "profile.own")
    student = own_student(db, user)
    challenge = db.scalar(
        select(OtpChallenge)
        .where(OtpChallenge.student_id == student.id, OtpChallenge.used.is_(False))
        .order_by(OtpChallenge.id.desc())
    )
    if not challenge or challenge.expires_at < datetime.utcnow() or challenge.otp_hash != hash_secret(body.otp):
        raise HTTPException(400, "The verification code is incorrect or expired")
    challenge.used = True
    student.aadhaar_verified = True
    student.status = "approved"
    append_audit(db, user.id, "OTP_VERIFIED", "student", student.id, {"verified": True})
    notify(db, user, "registration_confirmed", f"Registration {student.reference_no} is verified in the sandbox.")
    db.commit()
    return {"verified": True, "reference_no": student.reference_no}


@app.get("/api/events")
def events(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    student = None
    if authorization and authorization.lower().startswith("bearer "):
        user = current_user(db, authorization)
        if user.role == "student":
            student = own_student(db, user)
    rows = db.scalars(select(Event)).all()
    result = []
    for event in rows:
        sport = db.get(Sport, event.sport_id)
        category = db.get(AgeCategory, event.age_category_id)
        day = event_day(event)
        years = age_on(student.dob, day) if student else None
        taken = db.scalar(select(func.count()).select_from(EventRegistration).where(EventRegistration.event_id == event.id, EventRegistration.status != "rejected")) or 0
        eligible = None
        note = ""
        if student and category:
            eligible = category.min_age <= years <= category.max_age
            note = f"Eligible. Age {years} is calculated on the event date {day.isoformat()}." if eligible else f"Age {years} on {day.isoformat()} is outside {category.name} ({category.min_age}-{category.max_age})"
            if not student.aadhaar_verified:
                eligible = False
                note = "Complete Aadhaar OTP verification before registering"
        result.append({
            "id": event.id,
            "name": event.name,
            "sport": sport.name if sport else "",
            "sport_id": event.sport_id,
            "district": event.district,
            "venue": event.venue,
            "category": category.name if category else "",
            "age_category_id": event.age_category_id,
            "min_age": category.min_age if category else 0,
            "max_age": category.max_age if category else 0,
            "deadline": event.deadline.isoformat(),
            "held_on": day.isoformat(),
            "capacity": event.capacity,
            "registered": taken,
            "eligible": eligible,
            "eligibility_note": note,
        })
    return result


@app.post("/api/events/register")
def register_event(body: RegisterEventIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "event.register")
    student = own_student(db, user)
    if not student.aadhaar_verified:
        raise HTTPException(400, "Complete sandbox identity verification before registering")
    bank = db.scalar(select(StudentBank).where(StudentBank.student_id == student.id))
    if bank and bank.status != "sandbox-matched":
        raise HTTPException(400, "The bank account was not validated")
    event = db.get(Event, body.event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    if event.deadline < datetime.utcnow():
        raise HTTPException(400, "Registration for this event is closed")
    category = db.get(AgeCategory, event.age_category_id)
    years = age_on(student.dob, event_day(event))
    if years < category.min_age or years > category.max_age:
        raise HTTPException(400, f"Age {years} is outside {category.name} ({category.min_age}-{category.max_age})")
    taken = db.scalar(select(func.count()).select_from(EventRegistration).where(EventRegistration.event_id == event.id, EventRegistration.status != "rejected"))
    if taken >= event.capacity:
        raise HTTPException(400, "This event is full")
    existing = db.scalar(select(EventRegistration).where(EventRegistration.event_id == event.id, EventRegistration.student_id == student.id))
    if existing:
        raise HTTPException(400, "You are already registered for this event")
    row = EventRegistration(event_id=event.id, student_id=student.id, status="pending")
    db.add(row)
    db.flush()
    append_audit(db, user.id, "EVENT_REGISTERED", "event_registration", row.id, {"event_id": event.id})
    notify(db, user, "event_registration", f"Registration received for {event.name}.")
    db.commit()
    return {"id": row.id, "status": row.status}


@app.get("/api/registrations")
def registrations(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    query = select(EventRegistration)
    if user.role == "student":
        student = own_student(db, user)
        query = query.where(EventRegistration.student_id == student.id)
    rows = db.scalars(query).all()
    visible = []
    for row in rows:
        if user.role not in {"admin", "auditor", "accountant", "student"} and user.district and row.student.district != user.district:
            continue
        part = db.scalar(select(ParticipationRecord).where(ParticipationRecord.registration_id == row.id))
        sport = db.get(Sport, row.event.sport_id)
        visible.append({
            "id": row.id,
            "event_id": row.event_id,
            "event": row.event.name,
            "sport": sport.name if sport else "",
            "student": row.student.full_name,
            "student_id": row.student_id,
            "district": row.student.district,
            "status": row.status,
            "participation": part.status if part else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        })
    return visible


@app.post("/api/registrations/{registration_id}/review")
def review(registration_id: int, body: ReviewIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "registration.review")
    if body.status not in {"approved", "rejected", "correction"}:
        raise HTTPException(400, "Status must be approved, rejected, or correction")
    row = db.get(EventRegistration, registration_id)
    if not row:
        raise HTTPException(404, "Registration not found")
    district_ok(user, row.student.district)
    row.status = body.status
    append_audit(db, user.id, "REGISTRATION_REVIEWED", "event_registration", row.id, {"status": body.status})
    notify(db, row.student.user, "application_status", f"Event registration is now {body.status}.")
    db.commit()
    return {"id": row.id, "status": row.status}


@app.post("/api/attendance")
def attendance(body: AttendanceIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "attendance.record")
    row = db.get(EventRegistration, body.registration_id)
    if not row or row.status != "approved":
        raise HTTPException(400, "Only an approved registration can be marked present")
    district_ok(user, row.student.district)
    existing = db.scalar(select(ParticipationRecord).where(ParticipationRecord.registration_id == row.id))
    if existing:
        raise HTTPException(400, "Attendance is already recorded")
    bio_status = "sandbox-matched" if body.status == "present" else "mismatch"
    record = ParticipationRecord(registration_id=row.id, status=body.status, device_ref="sandbox-device", exception_note=body.exception_note)
    db.add(record)
    db.flush()
    db.add(BiometricVerificationLog(participation_id=record.id, status=bio_status, device_ref="sandbox-device", note=body.exception_note or "Sandbox biometric check. No device is connected."))
    sealed = append_audit(db, user.id, "ATTENDANCE", "participation", record.id, {"status": body.status, "registration_id": row.id, "student": row.student.full_name})
    record.chain_hash = sealed.event_hash
    db.commit()
    return {"id": record.id, "status": record.status, "biometric": "sandbox-not-connected", "chain_hash": record.chain_hash}


@app.post("/api/certificates/{registration_id}")
def issue_certificate(registration_id: int, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "certificate.issue")
    row = db.get(EventRegistration, registration_id)
    if not row:
        raise HTTPException(404, "Registration not found")
    district_ok(user, row.student.district)
    participated = db.scalar(select(ParticipationRecord).where(ParticipationRecord.registration_id == row.id, ParticipationRecord.status == "present"))
    if not participated:
        raise HTTPException(400, "Attendance must be recorded before a certificate is issued")
    existing = db.scalar(select(Certificate).where(Certificate.registration_id == row.id))
    if existing:
        if not existing.issued_by_user_id:
            existing.issued_by_user_id = user.id
            db.commit()
        return {
            "reference_no": existing.reference_no,
            "status": existing.status,
            "verify_url": verify_page(existing.reference_no),
            "qr": f"/api/certificates/verify/{existing.reference_no}/qr",
            "issued_by": issuer_payload(db, existing),
        }
    count = db.scalar(select(func.count()).select_from(Certificate)) or 0
    reference_no = f"CERT-2026-{count + 1:04d}"
    cert = Certificate(
        student_id=row.student_id,
        registration_id=row.id,
        reference_no=reference_no,
        title=row.event.name,
        content_hash=certificate_hash(reference_no, row.event.name, row.student_id, row.id, "issued"),
        issued_by_user_id=user.id,
    )
    db.add(cert)
    db.flush()
    sealed = append_audit(
        db,
        user.id,
        "CERTIFICATE_ISSUED",
        "certificate",
        cert.id,
        {
            "reference_no": cert.reference_no,
            "student": row.student.full_name,
            "event": row.event.name,
            "issued_by": user.full_name,
            "issued_by_role": user.role,
        },
    )
    cert.chain_hash = sealed.event_hash
    notify(db, row.student.user, "certificate_ready", f"Certificate {cert.reference_no} is ready.")
    db.commit()
    return {
        "reference_no": cert.reference_no,
        "status": cert.status,
        "chain_hash": cert.chain_hash,
        "verify_url": verify_page(cert.reference_no),
        "qr": f"/api/certificates/verify/{cert.reference_no}/qr",
        "issued_by": issuer_payload(db, cert),
        "student": row.student.full_name,
        "event": row.event.name,
        "sport": (db.get(Sport, row.event.sport_id).name if row.event and row.event.sport_id else ""),
        "district": row.student.district,
    }


@app.get("/api/certificates")
def certificates(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    query = select(Certificate)
    if user.role == "student":
        query = query.where(Certificate.student_id == own_student(db, user).id)
    elif "certificate.own" not in ROLE_PERMS.get(user.role, set()) and "certificate.issue" not in ROLE_PERMS.get(user.role, set()) and user.role not in {"admin", "auditor"}:
        raise HTTPException(403, "You do not have permission for this action")
    rows = []
    for cert in db.scalars(query).all():
        if user.role not in {"student", "admin", "auditor"} and user.district and cert.student.district != user.district:
            continue
        registration = db.get(EventRegistration, cert.registration_id) if cert.registration_id else None
        event = registration.event if registration else None
        sport = db.get(Sport, event.sport_id) if event else None
        expected = certificate_hash(cert.reference_no, cert.title, cert.student_id, cert.registration_id, cert.status)
        if cert.content_hash:
            integrity = "ok" if cert.content_hash == expected else "mismatch"
        else:
            integrity = "unavailable"
        issued_by = issuer_payload(db, cert)
        rows.append({
            "reference_no": cert.reference_no,
            "title": cert.title,
            "student": cert.student.full_name,
            "district": cert.student.district,
            "event": event.name if event else cert.title,
            "sport": sport.name if sport else "",
            "status": cert.status,
            "issued_at": cert.created_at.isoformat() if cert.created_at else None,
            "issued_by": issued_by,
            "issued_by_name": issued_by.get("name") or "",
            "integrity": integrity,
            "chain_hash": cert.chain_hash,
            "qr": f"/api/certificates/verify/{cert.reference_no}/qr",
            "verify_url": verify_page(cert.reference_no),
            "registration_id": cert.registration_id,
        })
    return rows


@app.get("/api/certificates/verify/{reference_no}")
def verify_certificate(reference_no: str, db: Session = Depends(get_db)):
    cert = db.scalar(select(Certificate).where(Certificate.reference_no == reference_no.strip()))
    if not cert:
        raise HTTPException(404, "No platform certificate uses that reference")
    expected = certificate_hash(cert.reference_no, cert.title, cert.student_id, cert.registration_id, cert.status)
    if not cert.content_hash:
        integrity = "unavailable"
    elif cert.content_hash == expected:
        integrity = "ok"
    else:
        integrity = "mismatch"
    registration = db.get(EventRegistration, cert.registration_id) if cert.registration_id else None
    event = registration.event if registration else None
    sport = db.get(Sport, event.sport_id) if event else None
    participation = None
    participation_chain = None
    if registration:
        record = db.scalar(select(ParticipationRecord).where(ParticipationRecord.registration_id == registration.id))
        if record:
            participation = {"status": record.status, "chain_hash": record.chain_hash, "device_ref": record.device_ref}
            participation_chain = proof_for(db, "participation", record.id)
    chain = proof_for(db, "certificate", cert.id)
    issued_by = issuer_payload(db, cert)
    return {
        "reference_no": cert.reference_no,
        "title": cert.title,
        "student": cert.student.full_name,
        "district": cert.student.district,
        "reference_student": cert.student.reference_no,
        "phone_verified": bool(cert.student.phone_verified),
        "aadhaar_verified": bool(cert.student.aadhaar_verified),
        "event": event.name if event else cert.title,
        "sport": sport.name if sport else "",
        "venue": event.venue if event else "",
        "held_on": event.held_on.isoformat() if event and event.held_on else None,
        "status": cert.status,
        "issued_at": cert.created_at.isoformat() if cert.created_at else None,
        "issued_by": issued_by,
        "issued_by_name": issued_by.get("name") or "",
        "issued_by_role": issued_by.get("role") or "",
        "integrity": integrity,
        "participation": participation,
        "participation_chain": participation_chain,
        "chain": chain,
        "chain_hash": cert.chain_hash,
        "qr": f"/api/certificates/verify/{cert.reference_no}/qr",
        "verify_url": verify_page(cert.reference_no),
        "notice": "This checks the candidate, participation, issuer, and certificate against the registration-service hash chain. It is separate from the public portal ledger, and it is not a transaction on an external blockchain.",
    }


@app.get("/api/certificates/verify/{reference_no}/qr")
def certificate_qr(reference_no: str, db: Session = Depends(get_db)):
    cert = db.scalar(select(Certificate).where(Certificate.reference_no == reference_no.strip()))
    if not cert:
        raise HTTPException(404, "No platform certificate uses that reference")
    return Response(content=qr_svg(verify_page(cert.reference_no)), media_type="image/svg+xml")


@app.post("/api/rewards")
def claim_reward(body: RewardIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "reward.own")
    student = own_student(db, user)
    bank = db.scalar(select(StudentBank).where(StudentBank.student_id == student.id))
    if not bank:
        raise HTTPException(400, "No bank account is saved on this registration")
    if bank.status != "sandbox-matched":
        raise HTTPException(400, "The saved bank account did not pass the sandbox check. No bank was contacted.")
    if body.bank_last4 != bank.bank_last4:
        raise HTTPException(400, "The account ending does not match the validated account on file")
    reward = RewardApplication(student_id=student.id, amount=body.amount, bank_last4=bank.bank_last4, bank_status="sandbox-matched", status="pending")
    db.add(reward)
    db.flush()
    db.add(BankValidationRecord(reward_id=reward.id, status="sandbox-matched", provider_ref="sandbox-bank"))
    append_audit(db, user.id, "REWARD_CLAIMED", "reward", reward.id, {"amount": body.amount, "bank_last4": bank.bank_last4})
    db.commit()
    return {
        "id": reward.id,
        "status": reward.status,
        "bank_status": reward.bank_status,
        "simulation": True,
        "notice": "Sandbox match against the saved account ending. No bank was contacted and no money moved.",
    }


@app.get("/api/rewards")
def rewards(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    if user.role == "student":
        rows = db.scalars(select(RewardApplication).where(RewardApplication.student_id == own_student(db, user).id)).all()
    elif user.role in {"department", "accountant", "admin", "auditor"}:
        rows = db.scalars(select(RewardApplication)).all()
    else:
        raise HTTPException(403, "You do not have permission for this action")
    visible = []
    for row in rows:
        if user.role not in {"admin", "auditor", "accountant", "student"} and row.student.district != user.district:
            continue
        txn = db.scalar(select(RewardTransaction).where(RewardTransaction.reward_id == row.id))
        visible.append({
            "id": row.id,
            "student": row.student.full_name,
            "district": row.student.district,
            "amount": row.amount,
            "status": row.status,
            "bank_status": row.bank_status,
            "bank_last4": row.bank_last4,
            "payment_reference": txn.reference if txn else None,
            "simulation": True,
        })
    return visible


@app.post("/api/rewards/{reward_id}/approve")
def approve_reward(reward_id: int, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "reward.approve")
    reward = db.get(RewardApplication, reward_id)
    if not reward:
        raise HTTPException(404, "Reward not found")
    district_ok(user, reward.student.district)
    if reward.bank_status != "sandbox-matched":
        raise HTTPException(400, "The sandbox bank check did not match, so this reward cannot be approved")
    if reward.status != "pending":
        raise HTTPException(400, "Only a pending reward can be approved")
    reward.status = "approved"
    append_audit(db, user.id, "REWARD_APPROVED", "reward", reward.id, {"amount": reward.amount})
    db.commit()
    return {"id": reward.id, "status": reward.status}


@app.post("/api/rewards/{reward_id}/pay")
def pay_reward(reward_id: int, body: PayIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "payment.process")
    if body.status not in {"processed", "failed"}:
        raise HTTPException(400, "Status must be processed or failed")
    reward = db.get(RewardApplication, reward_id)
    if not reward or reward.status != "approved":
        raise HTTPException(400, "Only an approved reward can be paid")
    if reward.bank_status != "sandbox-matched":
        raise HTTPException(400, "The sandbox bank check did not match, so this reward cannot be paid")
    existing = db.scalar(select(RewardTransaction).where(RewardTransaction.reward_id == reward.id))
    if existing:
        raise HTTPException(400, "This reward already has a payment record")
    reference = f"SANDBOX-PAY-{reward.id}"
    db.add(RewardTransaction(reward_id=reward.id, status=body.status, reference=reference))
    reward.status = body.status
    append_audit(db, user.id, "REWARD_PAID", "reward", reward.id, {"status": body.status, "reference": reference})
    notify(db, reward.student.user, "reward_status", f"Reward status is {body.status}. Reference {reference}.")
    db.commit()
    return {
        "reference": reference,
        "status": body.status,
        "simulation": True,
        "notice": "Sandbox payment record only. No bank transfer was made.",
    }


@app.post("/api/inventory/issue")
def issue_item(body: IssueItemIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "inventory.issue")
    item = db.get(InventoryItem, body.item_id)
    student = db.get(Student, body.student_id)
    if not item or not student:
        raise HTTPException(404, "Item or student not found")
    district_ok(user, student.district)
    if body.quantity < 1:
        raise HTTPException(400, "Quantity must be at least 1")
    if item.stock < body.quantity:
        raise HTTPException(400, "Not enough stock")
    waiting = db.scalar(
        select(ItemAcknowledgement)
        .join(InventoryTransaction, ItemAcknowledgement.transaction_id == InventoryTransaction.id)
        .where(
            InventoryTransaction.item_id == item.id,
            InventoryTransaction.student_id == student.id,
            ItemAcknowledgement.status == "pending",
        )
    )
    if waiting:
        raise HTTPException(400, "This student already has this item waiting for acknowledgement")
    item.stock -= body.quantity
    txn = InventoryTransaction(item_id=item.id, student_id=student.id, quantity=body.quantity, officer_id=user.id)
    db.add(txn)
    db.flush()
    ack = ItemAcknowledgement(transaction_id=txn.id, status="pending")
    db.add(ack)
    append_audit(db, user.id, "ITEM_ISSUED", "inventory", txn.id, {"item": item.name, "quantity": body.quantity})
    notify(db, student.user, "kit_ack_reminder", f"Please acknowledge {item.name}.")
    db.commit()
    return {"transaction_id": txn.id, "acknowledgement": "pending", "stock": item.stock}


@app.get("/api/inventory")
def inventory(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    items = [{"id": item.id, "name": item.name, "stock": item.stock} for item in db.scalars(select(InventoryItem)).all()]
    acks = db.scalars(select(ItemAcknowledgement)).all()
    mine = []
    for ack in acks:
        txn = ack.transaction
        if user.role == "student" and txn.student.user_id != user.id:
            continue
        if user.role in {"department", "operator"} and txn.student.district != user.district:
            continue
        mine.append({"id": ack.id, "item": txn.item.name, "item_id": txn.item_id, "student": txn.student.full_name, "student_id": txn.student_id, "quantity": txn.quantity, "status": ack.status, "issued_at": txn.issued_at.isoformat() if txn.issued_at else None})
    return {"items": items, "acknowledgements": mine, "history": mine}


@app.post("/api/inventory/ack/{ack_id}")
def acknowledge(ack_id: int, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "inventory.ack")
    ack = db.get(ItemAcknowledgement, ack_id)
    if not ack or ack.transaction.student.user_id != user.id:
        raise HTTPException(404, "Acknowledgement not found")
    if ack.status != "pending":
        raise HTTPException(400, "This item cannot be acknowledged")
    ack.status = "acknowledged"
    ack.acknowledged_at = datetime.utcnow()
    append_audit(db, user.id, "ITEM_ACKNOWLEDGED", "inventory", ack.id, {})
    db.commit()
    return {"id": ack.id, "status": ack.status}


@app.post("/api/inventory/ack/{ack_id}/return")
def return_item(ack_id: int, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "inventory.issue")
    ack = db.get(ItemAcknowledgement, ack_id)
    if not ack:
        raise HTTPException(404, "Issue record not found")
    txn = ack.transaction
    district_ok(user, txn.student.district)
    if ack.status != "acknowledged":
        raise HTTPException(400, "Only acknowledged kits can be returned")
    item = txn.item
    item.stock += txn.quantity
    ack.status = "returned"
    append_audit(db, user.id, "ITEM_RETURNED", "inventory", ack.id, {"item": item.name, "quantity": txn.quantity})
    notify(db, txn.student.user, "kit_returned", f"{item.name} return recorded. Stock restored.")
    db.commit()
    return {"id": ack.id, "status": ack.status, "stock": item.stock}


@app.post("/api/chat")
def chat(body: ChatIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization) if authorization else None
    text = body.question.lower()
    answer = None
    source = None
    if any(word in text for word in ["approve payment", "pay reward", "change bank"]):
        answer = "I cannot approve rewards or change payment records. An accountant completes that in the reward workflow."
        source = "safety-policy"
    if answer is None and any(word in text for word in ["hithlaksh", "technology partner", "tech partner", "who built", "who developed"]):
        answer = (
            "Hithlaksh Solutions is the technology partner for this SAAP digital registration, certificates, "
            "and audit demonstration portal. They support secure registration workflows, role-based access, "
            "certificate QR verification, the conversational help agent, and WhatsApp enquiry routing. "
            "Programme and sports-policy questions should still be answered from SAAP content."
        )
        source = "tech-partner"
    if answer is None:
        answer, source = account_reply(db, user, text)
    if answer is None:
        answer, source = staff_reply(user, text)
    if answer is None and ("eligibility" in text or "age" in text):
        answer = "Eligibility uses the student's date of birth and the event age category. Under 14 covers ages 10 to 14. Sport, district and category rules on each event also apply."
        source = "eligibility-rules"
    if answer is None and ("otp" in text or "mobile code" in text or "email code" in text):
        answer = "Registration asks for a 6-digit code on the mobile number or email before the account is created. No SMS or email provider is connected, so the demonstration shows the code on the page. Aadhaar checks are a separate sandbox step after sign-in, and the full Aadhaar number is not stored."
        source = "otp-workflow"
    if answer is None and ("qr" in text or "scan" in text):
        answer = "Each issued certificate has a QR code. Scanning it opens the public check page with the candidate name, district, event, participation status, and the hash-chain seal."
        source = "certificate-workflow"
    if answer is None and ("whatsapp" in text or "enquiry" in text):
        answer = "Use the green WhatsApp button to open a chat with the approved SAAP mobile number. Optional consent can be recorded for automated status updates after an enquiry. Officers can send audited notices from the WhatsApp desk."
        source = "whatsapp-workflow"
    if answer is None and ("role" in text or "permission" in text or "access" in text or "what can my role" in text):
        if user:
            granted = ", ".join(sorted(ROLE_PERMS.get(user.role, set()))) or "no elevated permissions"
            answer = f"You are signed in as {user.full_name}, role {user.role}. This role can: {granted}."
        else:
            answer = "Sign in to see the permissions on your role. Students manage their own registration. Department staff work inside their district. Operators record attendance. Accountants process sandbox payments. Auditors read the hash chain. Administrators manage users."
        source = "role-permissions"
    if answer is None and ("audit" in text or "login history" in text or "ip address" in text):
        if user and "audit.read" not in ROLE_PERMS.get(user.role, set()):
            answer = "The audit hash chain exists for authorised staff. Your role cannot open the full audit log. Sign in as auditor, accountant, department or admin to verify the chain."
            source = "role-permissions"
        else:
            answer = "Sign-in, failed sign-in, registration, attendance, certificates, and administrative changes are appended to a hash chain. Each login stores the IP address. Auditors and administrators can read that log. It is not an external blockchain."
            source = "audit-workflow"
    if answer is None and "certificate" in text:
        answer = "A certificate is issued after the event registration is approved and attendance is recorded. The issue is sealed in the hash chain, and the certificate page shows a QR code for the public check."
        source = "certificate-workflow"
    if answer is None:
        if user:
            answer = (
                f"Signed in as {user.full_name} ({user.role}). I can explain registration, eligibility, events, "
                "participation, certificates, QR checks, WhatsApp support, roles, and your permitted workflows. "
                "I answer from registration-service rules and will not invent payment or certificate status."
            )
        else:
            answer = "I can explain registration, the mobile or email code, events, participation, certificates, QR checks, roles, WhatsApp support, and Hithlaksh Solutions (technology partner). Sign in for role-based answers from your records."
        source = "faq"
    db.add(ChatbotConversation(user_id=user.id if user else None, question=body.question, answer=answer, source=source))
    db.commit()
    return {"answer": answer, "source": source, "role": user.role if user else None, "llm": os.environ.get("LLM_PROVIDER", "rules")}


def staff_reply(user: User | None, text: str):
    if not user:
        return None, None
    role = user.role
    if role == "admin" and any(w in text for w in ["report", "power bi", "dashboard", "event desk", "fingerprint", "verify player"]):
        return (
            "Admins can open Reports (Power BI–style dashboard) and Events (upcoming / live / completed player check-in with fingerprint verification). Completed events stay locked.",
            "staff-guide",
        )
    if role == "department" and any(w in text for w in ["approv", "review", "district", "event manage"]):
        return (
            f"As department staff for {user.district or 'your district'}, you can review registrations, manage events, issue certificates and approve rewards inside your district only.",
            "staff-guide",
        )
    if role == "operator" and any(w in text for w in ["biometric", "attendance", "fingerprint", "check-in", "check in"]):
        return (
            "Operators record biometric attendance for approved registrations. Use Biometric check-in on the staff desk. This build is a sandbox — no physical scanner is connected.",
            "staff-guide",
        )
    if role == "accountant" and any(w in text for w in ["payment", "reward", "pay", "bank"]):
        return (
            "Accountants process approved reward payments and can read the audit trail. The agent will not mark a payment complete — use the Rewards workflow.",
            "staff-guide",
        )
    if role == "auditor" and any(w in text for w in ["audit", "hash", "chain", "verify"]):
        return (
            "Auditors have read-only access to the hash-chain audit log and can verify chain integrity. You cannot change registrations or payments.",
            "staff-guide",
        )
    return None, None


def account_reply(db: Session, user: User | None, text: str):
    if not user or user.role != "student":
        return None, None
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    if not student:
        return None, None
    asks_records = any(phrase in text for phrase in ["my registration", "my event", "my certificate", "my participation", "did i", "am i registered", "status of", "what is my"])
    if not asks_records and not any(word in text for word in ["registration", "certificate", "participation", "attendance"]):
        return None, None
    regs = db.scalars(select(EventRegistration).where(EventRegistration.student_id == student.id)).all()
    if not regs and asks_records:
        return f"{student.full_name} has no event registration yet. Open Events and register for a game that matches the date of birth.", "account-records"
    lines = []
    for reg in regs:
        part = db.scalar(select(ParticipationRecord).where(ParticipationRecord.registration_id == reg.id))
        cert = db.scalar(select(Certificate).where(Certificate.registration_id == reg.id))
        lines.append(
            f"{reg.event.name}: registration {reg.status}"
            + (f", participation {part.status}" if part else ", attendance not recorded")
            + (f", certificate {cert.reference_no}" if cert else ", certificate not issued")
        )
    if not lines:
        return None, None
    return f"Records for {student.full_name} ({student.reference_no}): " + "; ".join(lines) + ".", "account-records"


@app.post("/api/support")
def support(body: TicketIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization) if authorization else None
    ticket = SupportTicket(user_id=user.id if user else None, subject=body.subject, detail=body.detail)
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {"id": ticket.id, "status": ticket.status}


@app.get("/api/support")
def support_list(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    query = select(SupportTicket).order_by(SupportTicket.id.desc())
    if user.role not in {"department", "admin", "auditor"}:
        query = query.where(SupportTicket.user_id == user.id)
    rows = []
    for ticket in db.scalars(query.limit(50)).all():
        owner = db.get(User, ticket.user_id) if ticket.user_id else None
        rows.append({
            "id": ticket.id,
            "subject": ticket.subject,
            "detail": ticket.detail,
            "status": ticket.status,
            "name": owner.full_name if owner else "Guest",
        })
    return rows


@app.post("/api/support/{ticket_id}/close")
def close_ticket(ticket_id: int, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "registration.review")
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    ticket.status = "closed"
    append_audit(db, user.id, "TICKET_CLOSED", "support_ticket", ticket.id, {})
    db.commit()
    return {"id": ticket.id, "status": ticket.status}


@app.get("/api/notifications")
def notifications(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(20)).all()
    return [{
        "id": row.id,
        "channel": row.channel,
        "template": row.template,
        "body": row.body,
        "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "delivered": False,
        "notice": "Recorded in the sandbox log. A WhatsApp provider is not connected, so this was not delivered.",
    } for row in rows]


@app.get("/api/sports")
def list_sports(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "event.manage")
    return [{"id": row.id, "name": row.name} for row in db.scalars(select(Sport).order_by(Sport.name)).all()]


@app.post("/api/sports")
def add_sport(body: SportIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "event.manage")
    name = body.name.strip()
    if db.scalar(select(Sport).where(Sport.name == name)):
        raise HTTPException(400, "That sport is already listed")
    row = Sport(name=name)
    db.add(row)
    db.flush()
    append_audit(db, user.id, "SPORT_ADDED", "sport", row.id, {"name": name})
    db.commit()
    return {"id": row.id, "name": row.name}


@app.get("/api/age-categories")
def list_categories(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "event.manage")
    return [{"id": row.id, "name": row.name, "min_age": row.min_age, "max_age": row.max_age} for row in db.scalars(select(AgeCategory)).all()]


@app.post("/api/age-categories")
def add_category(body: CategoryIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "event.manage")
    if body.min_age > body.max_age:
        raise HTTPException(400, "Minimum age cannot be above maximum age")
    row = AgeCategory(name=body.name.strip(), min_age=body.min_age, max_age=body.max_age)
    db.add(row)
    db.flush()
    append_audit(db, user.id, "CATEGORY_ADDED", "age_category", row.id, {"name": row.name})
    db.commit()
    return {"id": row.id, "name": row.name, "min_age": row.min_age, "max_age": row.max_age}


@app.post("/api/events")
def add_event(body: EventIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "event.manage")
    district_ok(user, body.district)
    if not db.get(Sport, body.sport_id) or not db.get(AgeCategory, body.age_category_id):
        raise HTTPException(404, "Sport or age category not found")
    row = Event(
        name=body.name.strip(),
        sport_id=body.sport_id,
        district=body.district,
        venue=body.venue.strip(),
        age_category_id=body.age_category_id,
        deadline=datetime.combine(body.deadline, datetime.min.time()),
        held_on=body.held_on,
        capacity=body.capacity,
    )
    db.add(row)
    db.flush()
    append_audit(db, user.id, "EVENT_CREATED", "event", row.id, {"name": row.name, "district": row.district})
    db.commit()
    return {"id": row.id, "name": row.name}


@app.patch("/api/events/{event_id}")
def patch_event(event_id: int, body: EventPatch, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "event.manage")
    row = db.get(Event, event_id)
    if not row:
        raise HTTPException(404, "Event not found")
    district_ok(user, row.district)
    if body.district:
        district_ok(user, body.district)
        row.district = body.district
    if body.capacity is not None:
        taken = db.scalar(select(func.count()).select_from(EventRegistration).where(EventRegistration.event_id == row.id, EventRegistration.status != "rejected")) or 0
        if body.capacity < taken:
            raise HTTPException(400, "Capacity cannot be lower than the current registrations")
        row.capacity = body.capacity
    if body.name:
        row.name = body.name.strip()
    if body.venue:
        row.venue = body.venue.strip()
    if body.deadline:
        row.deadline = datetime.combine(body.deadline, datetime.min.time())
    if body.held_on:
        row.held_on = body.held_on
    if body.sport_id:
        if not db.get(Sport, body.sport_id):
            raise HTTPException(404, "Sport not found")
        row.sport_id = body.sport_id
    if body.age_category_id:
        if not db.get(AgeCategory, body.age_category_id):
            raise HTTPException(404, "Age category not found")
        row.age_category_id = body.age_category_id
    append_audit(db, user.id, "EVENT_UPDATED", "event", row.id, {"name": row.name})
    db.commit()
    return {"id": row.id, "name": row.name}


@app.post("/api/inventory/items")
def add_item(body: ItemIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "users.manage")
    row = InventoryItem(name=body.name.strip(), stock=body.stock)
    db.add(row)
    db.flush()
    append_audit(db, user.id, "ITEM_ADDED", "inventory", row.id, {"name": row.name, "stock": row.stock})
    db.commit()
    return {"id": row.id, "name": row.name, "stock": row.stock}


@app.post("/api/inventory/items/{item_id}/restock")
def restock_item(item_id: int, body: RestockIn, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "users.manage")
    item = db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Kit item not found")
    item.stock += body.quantity
    append_audit(db, user.id, "ITEM_RESTOCKED", "inventory", item.id, {"name": item.name, "added": body.quantity, "stock": item.stock})
    db.commit()
    return {"id": item.id, "name": item.name, "stock": item.stock, "notice": f"Restocked {body.quantity}. New stock: {item.stock}."}


@app.get("/api/users")
def list_users(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "users.manage")
    return [{
        "id": row.id,
        "username": row.username,
        "name": row.full_name,
        "role": row.role,
        "district": row.district,
        "active": row.active,
    } for row in db.scalars(select(User).order_by(User.id)).all()]


@app.patch("/api/users/{user_id}")
def patch_user(user_id: int, body: UserPatch, authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    actor = current_user(db, authorization)
    require(actor, "users.manage")
    row = db.get(User, user_id)
    if not row:
        raise HTTPException(404, "User not found")
    if row.id == actor.id and not body.active:
        raise HTTPException(400, "You cannot deactivate your own account")
    row.active = body.active
    append_audit(db, actor.id, "USER_UPDATED", "user", row.id, {"active": row.active, "username": row.username})
    db.commit()
    return {"id": row.id, "active": row.active}


@app.get("/api/audit")
def audit(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "audit.read")
    rows = db.scalars(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(100)).all()
    visible = []
    for row in rows:
        actor = db.get(User, row.actor_id) if row.actor_id else None
        visible.append({
            "id": row.event_uid,
            "time": row.created_at.isoformat() if row.created_at else None,
            "actor": actor.full_name if actor else "System",
            "role": actor.role if actor else "",
            "action": row.action,
            "entity": row.entity,
            "entity_id": row.entity_id,
            "hash": row.event_hash,
            "prev": row.prev_hash,
            "ip": row.ip_address or "",
            "integrity": "local-hash",
        })
    return visible


@app.get("/api/audit/verify")
def audit_verify(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "audit.read")
    return verify_chain(db)


@app.post("/api/audit/anchor")
def anchor(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    require(user, "audit.anchor")
    check = verify_chain(db)
    if not check["ok"]:
        raise HTTPException(409, "The audit chain does not verify")
    rows = db.scalars(select(AuditEvent.event_hash).order_by(AuditEvent.id.asc())).all()
    root = hashlib.sha256("".join(rows).encode()).hexdigest()
    checkpoint = AuditCheckpoint(merkle_root=root, event_count=len(rows))
    db.add(checkpoint)
    db.flush()
    note = "Local hash checkpoint. No external ledger is configured."
    status = "local-checkpoint"
    if os.environ.get("BLOCKCHAIN_RPC_URL"):
        status = "pending-external"
        note = "An external ledger URL is set, but this build does not submit a transaction without an approved adapter."
    db.add(BlockchainAnchor(checkpoint_id=checkpoint.id, status=status, reference=f"local-{checkpoint.id}", note=note))
    append_audit(db, user.id, "CHECKPOINT", "audit_checkpoint", checkpoint.id, {"root": root, "status": status})
    db.commit()
    return {
        "root": root,
        "status": status,
        "events": len(rows),
        "notice": f"Local checkpoint created for {len(rows)} events.",
    }


def _district_clause(user: User, column):
    if user.role == "department" and user.district:
        return column == user.district
    return None


@app.get("/api/reports")
def reports(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    if user.role not in {"department", "accountant", "admin", "auditor"}:
        raise HTTPException(403, "You do not have permission for this action")
    limited = user.role == "department"

    def count_students(*filters):
        query = select(func.count()).select_from(Student)
        clause = _district_clause(user, Student.district)
        if clause is not None:
            query = query.where(clause)
        for item in filters:
            query = query.where(item)
        return db.scalar(query) or 0

    def count_joined(model, student_id_col, *filters):
        query = select(func.count()).select_from(model).join(Student, student_id_col == Student.id)
        clause = _district_clause(user, Student.district)
        if clause is not None:
            query = query.where(clause)
        for item in filters:
            query = query.where(item)
        return db.scalar(query) or 0

    participation = select(func.count()).select_from(ParticipationRecord).join(EventRegistration, ParticipationRecord.registration_id == EventRegistration.id).join(Student, EventRegistration.student_id == Student.id)
    biometric = select(func.count()).select_from(BiometricVerificationLog).join(ParticipationRecord, BiometricVerificationLog.participation_id == ParticipationRecord.id).join(EventRegistration, ParticipationRecord.registration_id == EventRegistration.id).join(Student, EventRegistration.student_id == Student.id)
    kits_query = select(func.count()).select_from(ItemAcknowledgement).join(InventoryTransaction, ItemAcknowledgement.transaction_id == InventoryTransaction.id).join(Student, InventoryTransaction.student_id == Student.id)
    if limited:
        participation = participation.where(Student.district == user.district)
        biometric = biometric.where(Student.district == user.district)
        kits_query = kits_query.where(Student.district == user.district)

    by_district = None
    if not limited:
        grouped = db.execute(select(Student.district, func.count()).group_by(Student.district).order_by(Student.district)).all()
        by_district = [{"district": district or "Unknown", "students": total} for district, total in grouped]

    return {
        "scope": user.district if limited else "all",
        "students": count_students(),
        "verified_students": count_students(Student.aadhaar_verified.is_(True)),
        "registrations": {
            "pending": count_joined(EventRegistration, EventRegistration.student_id, EventRegistration.status == "pending"),
            "approved": count_joined(EventRegistration, EventRegistration.student_id, EventRegistration.status == "approved"),
            "rejected": count_joined(EventRegistration, EventRegistration.student_id, EventRegistration.status == "rejected"),
        },
        "participated": db.scalar(participation.where(ParticipationRecord.status == "present")) or 0,
        "biometric_exceptions": db.scalar(biometric.where(BiometricVerificationLog.status == "mismatch")) or 0,
        "certificates": count_joined(Certificate, Certificate.student_id),
        "rewards": {
            "pending": count_joined(RewardApplication, RewardApplication.student_id, RewardApplication.status == "pending"),
            "approved": count_joined(RewardApplication, RewardApplication.student_id, RewardApplication.status == "approved"),
            "processed": count_joined(RewardApplication, RewardApplication.student_id, RewardApplication.status == "processed"),
            "failed": count_joined(RewardApplication, RewardApplication.student_id, RewardApplication.status == "failed"),
        },
        "bank": {
            "validated": count_joined(StudentBank, StudentBank.student_id, StudentBank.status == "sandbox-matched"),
            "unvalidated": count_joined(StudentBank, StudentBank.student_id, StudentBank.status != "sandbox-matched"),
        },
        "kits": {
            "pending": db.scalar(kits_query.where(ItemAcknowledgement.status == "pending")) or 0,
            "acknowledged": db.scalar(kits_query.where(ItemAcknowledgement.status == "acknowledged")) or 0,
            "returned": db.scalar(kits_query.where(ItemAcknowledgement.status == "returned")) or 0,
        },
        "by_district": by_district,
    }


@app.get("/api/dashboard")
def dashboard(authorization: str | None = Depends(bearer), db: Session = Depends(get_db)):
    user = current_user(db, authorization)
    summary = reports(authorization, db) if user.role in {"department", "accountant", "admin", "auditor"} else None
    chain = verify_chain(db) if "audit.read" in ROLE_PERMS.get(user.role, set()) else {"ok": None}
    return {
        "role": user.role,
        "scope": summary["scope"] if summary else user.district,
        "students": summary["students"] if summary else 1,
        "pending_registrations": summary["registrations"]["pending"] if summary else None,
        "approved_registrations": summary["registrations"]["approved"] if summary else None,
        "pending_rewards": summary["rewards"]["pending"] if summary else None,
        "processed_rewards": summary["rewards"]["processed"] if summary else None,
        "failed_rewards": summary["rewards"]["failed"] if summary else None,
        "certificates": summary["certificates"] if summary else None,
        "participated": summary["participated"] if summary else None,
        "kits_pending": summary["kits"]["pending"] if summary else None,
        "audit_ok": chain.get("ok"),
    }
