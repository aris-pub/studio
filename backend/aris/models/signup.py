"""Mailing-list signups and feedback."""

import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.sql import func

from aris.models.base import Base


class InterestLevel(enum.Enum):
    """Enum for signup interest levels."""

    EXPLORING = "exploring"
    PLANNING = "planning"
    READY = "ready"
    MIGRATING = "migrating"


class SignupStatus(enum.Enum):
    """Enum for signup status tracking."""

    ACTIVE = "active"
    UNSUBSCRIBED = "unsubscribed"
    CONVERTED = "converted"


class Signup(Base):
    """Early access signup registration.

    Stores user signup information for early access waitlist and updates.
    Matches the frontend form structure: email, authoring tools, improvements.
    Includes compliance fields and basic analytics tracking.

    Attributes
    ----------
    id : int
        Primary key.
    email : str
        Unique email address.
    authoring_tools : str
        JSON string of selected authoring tools.
    improvements : str
        Optional text feedback on desired improvements.
    status : SignupStatus
        Current status (active, unsubscribed, converted).
    source : str
        Optional signup source tracking.
    ip_address : str
        IP address for compliance/security.
    user_agent : str
        User agent string for analytics.
    consent_given : bool
        Whether user consented to data processing.
    unsubscribe_token : str
        Unique token for unsubscribe functionality.
    unsubscribed_at : datetime
        Timestamp when user unsubscribed (nullable).
    created_at : datetime
        Timestamp of signup.
    updated_at : datetime
        Timestamp of last update.

    """

    __tablename__ = "signups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False, index=True)
    authoring_tools = Column(Text, nullable=True)  # JSON array of tools
    improvements = Column(Text, nullable=True)     # User feedback text

    # Status and tracking
    status: Column[SignupStatus] = Column(
        Enum(SignupStatus), nullable=False, default=SignupStatus.ACTIVE
    )
    source = Column(String, nullable=True)

    # Compliance and analytics
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    consent_given = Column(Boolean, nullable=False, default=True)

    # Unsubscribe functionality
    unsubscribe_token = Column(String, unique=True, nullable=False, index=True)
    unsubscribed_at = Column(DateTime(timezone=True), nullable=True)

    # Email tracking
    email_sent = Column(Boolean, nullable=False, default=False)
    email_sent_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Feedback(Base):
    """User-submitted feedback message.

    Attributes
    ----------
    id : int
        Primary key.
    user_id : int
        Foreign key to User who submitted the feedback.
    message : str
        Feedback message text.
    created_at : datetime
        Timestamp of submission.

    """

    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


