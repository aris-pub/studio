"""HTTP endpoints for signup management.

This module provides REST API endpoints for early access signup functionality,
including creation, status checking, and unsubscription.
"""

import html
import json
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.signup import (
    DuplicateEmailError,
    SignupError,
    create_signup,
    email_exists,
    get_signup_by_token,
    unsubscribe_by_token,
)
from ..deps import get_db
from ..logging_config import get_logger
from ..models.models import SignupStatus
from ..services.email import get_email_service


logger = get_logger(__name__)


class SignupCreate(BaseModel):
    """Signup creation request schema."""

    email: EmailStr = Field(
        ..., description="Email address for early access notifications"
    )
    authoring_tools: Optional[list[str]] = Field(
        None, description="List of authoring tools user currently uses"
    )
    improvements: Optional[str] = Field(
        None, max_length=500, description="What improvements user would like to see"
    )

    @field_validator("improvements")
    @classmethod
    def sanitize_text_fields(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize text input to prevent XSS."""
        if v:
            return html.escape(v.strip())
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "researcher@university.edu",
                "authoring_tools": ["LaTeX", "Markdown"],
                "improvements": "Better collaboration features would be great",
            }
        }
    }


class SignupResponse(BaseModel):
    """Signup creation response schema."""

    id: int
    email: str
    authoring_tools: Optional[list[str]]
    improvements: Optional[str]
    status: SignupStatus
    unsubscribe_token: str
    created_at: str  # ISO format datetime string

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "email": "researcher@university.edu",
                "authoring_tools": ["LaTeX", "Markdown"],
                "improvements": "Better collaboration features would be great",
                "status": "active",
                "unsubscribe_token": "abcdef123456",
                "created_at": "2025-01-15T10:30:00Z",
            }
        },
    }


class SignupStatusCheck(BaseModel):
    """Response for checking if email is already registered."""

    exists: bool

    model_config = {"json_schema_extra": {"example": {"exists": True}}}


class ErrorResponse(BaseModel):
    """Standard error response schema."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[dict] = Field(None, description="Additional error details")

    model_config = {
        "json_schema_extra": {
            "example": {
                "error": "duplicate_email",
                "message": "This email address is already registered for early access",
                "details": {"field": "email"},
            }
        }
    }


class MessageResponse(BaseModel):
    """Simple message response schema."""

    message: str

    model_config = {
        "json_schema_extra": {"example": {"message": "Successfully added to waitlist"}}
    }


router = APIRouter(prefix="/signup", tags=["signup"])


@router.post(
    "/",
    response_model=SignupResponse,
    responses={
        201: {"description": "Successfully created signup"},
        400: {"model": ErrorResponse, "description": "Invalid input data"},
        409: {"model": ErrorResponse, "description": "Email already exists"},
        422: {"model": ErrorResponse, "description": "Validation error"},
    },
    summary="Create a new signup",
    description="Register a new user for early access to Aris platform",
)
async def create_signup_endpoint(
    signup_data: SignupCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create a new early access signup.

    Validates input data and creates a new signup record. Returns the created
    signup information with sanitized data.
    """
    origin = request.headers.get("origin", "")
    if re.match(r"^https://deploy-preview-\d+--rsm-studio-(site|frontend)\.netlify\.app$", origin):
        raise HTTPException(
            status_code=403,
            detail="Signup is disabled on deploy previews.",
        )

    logger.info(f"Creating signup for email: {signup_data.email}")
    try:
        # Extract client information for compliance
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        signup = await create_signup(
            email=signup_data.email,
            authoring_tools=signup_data.authoring_tools,
            improvements=signup_data.improvements,
            db=db,
            ip_address=ip_address,
            user_agent=user_agent,
            source="website",
        )

        # Send confirmation email
        email_service = get_email_service()
        if email_service:
            try:
                await email_service.send_waitlist_confirmation(
                    to_email=signup.email,
                    unsubscribe_token=signup.unsubscribe_token
                )
            except Exception as e:
                # Log email failure but don't fail the signup
                logger.error(f"Failed to send confirmation email to {signup.email}: {str(e)}")

            # Send admin notification
            try:
                await email_service.send_signup_notification(
                    signup_email=signup.email,
                    authoring_tools=signup_data.authoring_tools,
                    improvements=signup_data.improvements
                )
            except Exception as e:
                # Log failure but don't fail the signup
                logger.error(f"Failed to send admin notification for {signup.email}: {str(e)}")

        # Convert datetime to ISO format string for response
        # Parse authoring_tools JSON string back to list for response
        authoring_tools_list = None
        if signup.authoring_tools is not None:
            try:
                authoring_tools_list = json.loads(signup.authoring_tools)
            except json.JSONDecodeError:
                authoring_tools_list = None
        
        response_data = SignupResponse(
            id=signup.id,
            email=signup.email,
            authoring_tools=authoring_tools_list,
            improvements=signup.improvements,
            status=signup.status,
            unsubscribe_token=signup.unsubscribe_token,
            created_at=signup.created_at.isoformat(),
        )

        logger.info(f"Successfully created signup for {signup.email}")
        return response_data

    except DuplicateEmailError:
        logger.warning(f"Duplicate email signup attempt: {signup_data.email}")
        raise HTTPException(
            status_code=409,
            detail={
                "error": "duplicate_email",
                "message": "This email address is already registered for early access",
                "details": {"field": "email"},
            },
        )
    except SignupError as e:
        logger.error(f"Signup error for {signup_data.email}: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail={"error": "signup_error", "message": str(e), "details": None},
        )
    except Exception as e:
        logger.error(f"Unexpected error during signup for {signup_data.email}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": "An unexpected error occurred. Please try again later.",
                "details": None,
            },
        )


@router.get(
    "/status",
    response_model=SignupStatusCheck,
    responses={
        200: {"description": "Email status check result"},
        400: {"model": ErrorResponse, "description": "Invalid email format"},
    },
    summary="Check if email is registered",
    description="Check whether an email address is already registered for early access",
)
async def check_signup_status(
    email: str = Query(..., description="Email address to check"),
    db: AsyncSession = Depends(get_db),
):
    """Check if an email address is already registered.

    Returns whether the email exists in the signup database without
    exposing any other user information.
    """
    logger.debug(f"Checking signup status for email: {email}")
    try:
        exists = await email_exists(email, db)
        return SignupStatusCheck(exists=exists)

    except Exception as e:
        logger.error(f"Error checking signup status for {email}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": "Unable to check email status",
                "details": None,
            },
        )


@router.delete(
    "/unsubscribe/{token}",
    response_model=MessageResponse,
    responses={
        200: {"description": "Successfully unsubscribed"},
        400: {"model": ErrorResponse, "description": "Already unsubscribed"},
        404: {"model": ErrorResponse, "description": "Invalid token"},
    },
    summary="Unsubscribe from early access",
    description="Remove an email address from the early access signup list using unsubscribe token",
)
async def unsubscribe_endpoint(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Unsubscribe an email from the early access list using token.

    Marks the signup as unsubscribed rather than deleting it completely
    for compliance and analytics purposes.
    """
    logger.info(f"Processing unsubscribe request for token: {token[:8]}...")
    try:
        signup = await get_signup_by_token(token, db)
        if not signup:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "invalid_token",
                    "message": "Invalid or expired unsubscribe token",
                    "details": None,
                },
            )

        # Check if already unsubscribed
        if signup.status == SignupStatus.UNSUBSCRIBED:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "already_unsubscribed",
                    "message": "This email is already unsubscribed from early access notifications",
                    "details": None,
                },
            )

        await unsubscribe_by_token(token, db)
        logger.info(f"Successfully unsubscribed user with token: {token[:8]}...")

        return MessageResponse(
            message="Successfully unsubscribed from early access notifications"
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error processing unsubscribe for token {token[:8]}...: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": "Unable to process unsubscribe request",
                "details": None,
            },
        )
