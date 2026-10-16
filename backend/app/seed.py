from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auditlog import append_audit
from .models import (
    AgeCategory,
    EligibilityRule,
    Event,
    InventoryItem,
    Permission,
    StudentBank,
    RewardApplication,
    Role,
    Sport,
    Student,
    SystemSetting,
    User,
    UserRoleAssignment,
)
from .security import hash_password

ROLES = ["student", "department", "operator", "accountant", "admin", "auditor"]
PERMISSIONS = [
    "profile.own",
    "event.register",
    "certificate.own",
    "reward.own",
    "inventory.ack",
    "registration.review",
    "event.manage",
    "attendance.record",
    "certificate.issue",
    "reward.approve",
    "inventory.issue",
    "payment.process",
    "users.manage",
    "audit.read",
    "audit.anchor",
]


def seed(db: Session) -> None:
    if db.scalar(select(User).limit(1)):
        return
    for name in ROLES:
        db.add(Role(name=name))
    for code in PERMISSIONS:
        db.add(Permission(code=code))
    password = hash_password("demo123")
    people = [
        ("student", "Sravani K", "student", "Krishna", "9000000101"),
        ("student2", "Ravi Teja", "student", "Visakhapatnam", "9000000102"),
        ("department", "DSA Krishna", "department", "Krishna", "9000000201"),
        ("operator", "Venue Operator", "operator", "Krishna", "9000000301"),
        ("accountant", "SAAP Accounts", "accountant", "NTR", "9000000401"),
        ("admin", "Portal Administrator", "admin", "NTR", "9000000501"),
        ("auditor", "Internal Auditor", "auditor", "NTR", "9000000601"),
    ]
    users = {}
    for username, name, role, district, phone in people:
        user = User(username=username, full_name=name, password_hash=password, role=role, district=district, phone=phone)
        db.add(user)
        db.flush()
        db.add(UserRoleAssignment(user_id=user.id, role_name=role))
        users[username] = user
    athletics = Sport(name="Athletics")
    badminton = Sport(name="Badminton")
    db.add_all([athletics, badminton])
    db.flush()
    under14 = AgeCategory(name="Under 14", min_age=10, max_age=14)
    under17 = AgeCategory(name="Under 17", min_age=14, max_age=17)
    db.add_all([under14, under17])
    db.flush()
    db.add(EligibilityRule(sport_id=athletics.id, age_category_id=under14.id, notes="Age is calculated from date of birth on the event day."))
    meet = Event(
        name="Krishna District Athletics Meet 2026",
        sport_id=athletics.id,
        district="Krishna",
        venue="IGMC Stadium, Vijayawada",
        age_category_id=under14.id,
        deadline=datetime.utcnow() + timedelta(days=60),
        held_on=date.today() + timedelta(days=30),
        capacity=40,
    )
    db.add(meet)
    sravani = Student(
        user_id=users["student"].id,
        full_name="Sravani K",
        dob=date(2013, 6, 2),
        gender="Female",
        district="Krishna",
        phone="9000000101",
        aadhaar_last4="4821",
        aadhaar_verified=True,
        status="approved",
        reference_no="STU-2026-0001",
        whatsapp_consent=True,
    )
    ravi = Student(
        user_id=users["student2"].id,
        full_name="Ravi Teja",
        dob=date(2012, 1, 18),
        gender="Male",
        district="Visakhapatnam",
        phone="9000000102",
        aadhaar_last4="1190",
        aadhaar_verified=True,
        status="approved",
        reference_no="STU-2026-0002",
        whatsapp_consent=False,
    )
    db.add_all([sravani, ravi, InventoryItem(name="Training T-shirt", stock=25)])
    db.flush()
    db.add(StudentBank(student_id=sravani.id, bank_name="State Bank", bank_last4="4412", status="sandbox-matched"))
    db.add(StudentBank(student_id=ravi.id, bank_name="State Bank", bank_last4="3301", status="sandbox-matched"))
    db.add(RewardApplication(student_id=sravani.id, amount=2000, status="pending", bank_last4="4412", bank_status="sandbox-matched"))
    db.add(SystemSetting(key="sandbox_mode", value="Aadhaar OTP, bank validation, WhatsApp, and ledger anchoring use local sandboxes."))
    append_audit(db, users["admin"].id, "SEED", "system", "1", {"note": "demo records created"})
    db.commit()


def ensure_demo_banks(db: Session) -> None:
    """Attach the known demo accounts to a sandbox bank only when they have none."""
    known = {"student": ("State Bank", "4412"), "student2": ("State Bank", "3301")}
    changed = False
    for username, (bank_name, last4) in known.items():
        user = db.scalar(select(User).where(User.username == username))
        if not user:
            continue
        student = db.scalar(select(Student).where(Student.user_id == user.id))
        if not student:
            continue
        bank = db.scalar(select(StudentBank).where(StudentBank.student_id == student.id))
        if bank:
            continue
        db.add(StudentBank(student_id=student.id, bank_name=bank_name, bank_last4=last4, status="sandbox-matched"))
        changed = True
    if changed:
        db.commit()
