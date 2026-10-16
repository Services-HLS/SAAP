from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now():
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(40), index=True)
    district: Mapped[str] = mapped_column(String(80), default="")
    phone: Mapped[str] = mapped_column(String(20), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(40), unique=True)


class Permission(Base):
    __tablename__ = "permissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True)


class UserRoleAssignment(Base):
    __tablename__ = "user_role_assignments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    role_name: Mapped[str] = mapped_column(String(40))


class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    full_name: Mapped[str] = mapped_column(String(160))
    dob: Mapped[datetime] = mapped_column(Date)
    gender: Mapped[str] = mapped_column(String(20), default="")
    district: Mapped[str] = mapped_column(String(80), index=True)
    phone: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(160), default="")
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    aadhaar_last4: Mapped[str] = mapped_column(String(4), default="")
    aadhaar_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_name: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(40), default="draft")
    reference_no: Mapped[str] = mapped_column(String(40), unique=True)
    whatsapp_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    user = relationship("User")


class StudentBank(Base):
    __tablename__ = "student_banks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), unique=True)
    bank_name: Mapped[str] = mapped_column(String(80))
    bank_last4: Mapped[str] = mapped_column(String(4))
    status: Mapped[str] = mapped_column(String(40), default="unverified")
    provider_ref: Mapped[str] = mapped_column(String(80), default="sandbox-bank")


class ContactOtp(Base):
    __tablename__ = "contact_otps"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    email: Mapped[str] = mapped_column(String(160), default="")
    channel: Mapped[str] = mapped_column(String(20), default="mobile")
    otp_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class AadhaarKycSession(Base):
    """Tracks Sandbox.co.in Aadhaar OKYC generate/verify for registration."""

    __tablename__ = "aadhaar_kyc_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference_id: Mapped[str] = mapped_column(String(80), index=True)
    aadhaar_hash: Mapped[str] = mapped_column(String(64), index=True)
    aadhaar_last4: Mapped[str] = mapped_column(String(4), default="")
    provider: Mapped[str] = mapped_column(String(40), default="sandbox.co.in")
    status: Mapped[str] = mapped_column(String(40), default="otp_sent")
    local_otp_hash: Mapped[str] = mapped_column(String(64), default="")
    kyc_token_hash: Mapped[str] = mapped_column(String(64), default="", index=True)
    name: Mapped[str] = mapped_column(String(160), default="")
    dob: Mapped[str] = mapped_column(String(20), default="")
    gender: Mapped[str] = mapped_column(String(20), default="")
    full_address: Mapped[str] = mapped_column(Text, default="")
    provider_tx: Mapped[str] = mapped_column(String(120), default="")
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class OtpChallenge(Base):
    __tablename__ = "otp_challenges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    otp_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class StudentDocument(Base):
    __tablename__ = "student_documents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    doc_type: Mapped[str] = mapped_column(String(40))
    file_name: Mapped[str] = mapped_column(String(200))


class Sport(Base):
    __tablename__ = "sports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)


class AgeCategory(Base):
    __tablename__ = "age_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(40))
    min_age: Mapped[int] = mapped_column(Integer)
    max_age: Mapped[int] = mapped_column(Integer)


class EligibilityRule(Base):
    __tablename__ = "eligibility_rules"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sport_id: Mapped[int] = mapped_column(ForeignKey("sports.id"))
    age_category_id: Mapped[int] = mapped_column(ForeignKey("age_categories.id"))
    notes: Mapped[str] = mapped_column(Text, default="")


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    sport_id: Mapped[int] = mapped_column(ForeignKey("sports.id"))
    district: Mapped[str] = mapped_column(String(80))
    venue: Mapped[str] = mapped_column(String(160))
    age_category_id: Mapped[int] = mapped_column(ForeignKey("age_categories.id"))
    deadline: Mapped[datetime] = mapped_column(DateTime)
    held_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=50)
    sport = relationship("Sport")
    category = relationship("AgeCategory")


class EventRegistration(Base):
    __tablename__ = "event_registrations"
    __table_args__ = (UniqueConstraint("event_id", "student_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    status: Mapped[str] = mapped_column(String(40), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    event = relationship("Event")
    student = relationship("Student")


class ParticipationRecord(Base):
    __tablename__ = "participation_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    registration_id: Mapped[int] = mapped_column(ForeignKey("event_registrations.id"), unique=True)
    status: Mapped[str] = mapped_column(String(40), default="present")
    verified_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    device_ref: Mapped[str] = mapped_column(String(80), default="sandbox-device")
    exception_note: Mapped[str] = mapped_column(Text, default="")
    chain_hash: Mapped[str] = mapped_column(String(64), default="")


class BiometricVerificationLog(Base):
    __tablename__ = "biometric_verification_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participation_id: Mapped[int] = mapped_column(ForeignKey("participation_records.id"))
    status: Mapped[str] = mapped_column(String(40))
    device_ref: Mapped[str] = mapped_column(String(80))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Certificate(Base):
    __tablename__ = "certificates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    registration_id: Mapped[int] = mapped_column(ForeignKey("event_registrations.id"))
    reference_no: Mapped[str] = mapped_column(String(40), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(40), default="issued")
    content_hash: Mapped[str] = mapped_column(String(64), default="")
    chain_hash: Mapped[str] = mapped_column(String(64), default="")
    issued_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    student = relationship("Student")
    issued_by = relationship("User", foreign_keys=[issued_by_user_id])


class RewardApplication(Base):
    __tablename__ = "reward_applications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(40), default="pending")
    bank_last4: Mapped[str] = mapped_column(String(4), default="")
    bank_status: Mapped[str] = mapped_column(String(40), default="unverified")
    student = relationship("Student")


class BankValidationRecord(Base):
    __tablename__ = "bank_validation_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reward_id: Mapped[int] = mapped_column(ForeignKey("reward_applications.id"))
    status: Mapped[str] = mapped_column(String(40))
    provider_ref: Mapped[str] = mapped_column(String(80), default="sandbox")


class RewardTransaction(Base):
    __tablename__ = "reward_transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reward_id: Mapped[int] = mapped_column(ForeignKey("reward_applications.id"), unique=True)
    status: Mapped[str] = mapped_column(String(40))
    reference: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    stock: Mapped[int] = mapped_column(Integer, default=0)


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    officer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    item = relationship("InventoryItem")
    student = relationship("Student")


class ItemAcknowledgement(Base):
    __tablename__ = "item_acknowledgements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("inventory_transactions.id"), unique=True)
    status: Mapped[str] = mapped_column(String(40), default="pending")
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    transaction = relationship("InventoryTransaction")


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    channel: Mapped[str] = mapped_column(String(40))
    template: Mapped[str] = mapped_column(String(80))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="queued")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class WhatsAppMessageLog(Base):
    __tablename__ = "whatsapp_message_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    notification_id: Mapped[int] = mapped_column(ForeignKey("notifications.id"))
    provider_ref: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(40))
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ChatbotConversation(Base):
    __tablename__ = "chatbot_conversations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    subject: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="open")


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_uid: Mapped[str] = mapped_column(String(40), unique=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(80))
    entity: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(40), default="")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    prev_hash: Mapped[str] = mapped_column(String(64))
    event_hash: Mapped[str] = mapped_column(String(64))
    ip_address: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class AuditCheckpoint(Base):
    __tablename__ = "audit_checkpoints"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    merkle_root: Mapped[str] = mapped_column(String(64))
    event_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class BlockchainAnchor(Base):
    __tablename__ = "blockchain_anchors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    checkpoint_id: Mapped[int] = mapped_column(ForeignKey("audit_checkpoints.id"))
    status: Mapped[str] = mapped_column(String(40))
    reference: Mapped[str] = mapped_column(String(120))
    note: Mapped[str] = mapped_column(Text, default="")


class SystemSetting(Base):
    __tablename__ = "system_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True)
    value: Mapped[str] = mapped_column(Text)
