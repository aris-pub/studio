import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crud, current_user, get_db, jwt
from ..config import settings
from ..logging_config import get_logger
from ..models import User
from ..security import hash_password, verify_password
from ..services.email import get_email_service


_DEPLOY_PREVIEW_RE = re.compile(
    r"^https://deploy-preview-\d+--rsm-studio-(site|frontend)\.netlify\.app$"
)


logger = get_logger(__name__)


class UserLogin(BaseModel):
    """User login credentials."""

    email: EmailStr
    password: str

    model_config = {
        "json_schema_extra": {
            "example": {"email": "user@example.com", "password": "securepassword123"}
        }
    }


class ForgotPasswordRequest(BaseModel):
    """Forgot-password request body."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Reset-password request body."""

    token: str
    new_password: str = Field(min_length=8)


class UserCreate(BaseModel):
    """User registration data."""

    email: EmailStr
    name: str
    initials: str = ""
    password: str = Field(min_length=8)

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "newuser@example.com",
                "name": "Jane Doe",
                "initials": "JD",
                "password": "securepassword123",
            }
        }
    }


class Token(BaseModel):
    """JWT authentication tokens."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"

    model_config = {
        "json_schema_extra": {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
            }
        }
    }


router = APIRouter()


@router.get(
    "/me",
    summary="Get Current User",
    description="Retrieve the profile information of the currently authenticated user.",
    response_description="User profile information",
)
async def me(user: User = Depends(current_user)):
    """Get current authenticated user information.

    Parameters
    ----------
    user : User
        Current authenticated user from JWT token dependency.

    Returns
    -------
    dict
        User information including email, id, name, initials, created_at, avatar color, and email_verified status.

    Notes
    -----
    Requires valid JWT token in Authorization header.
    Returns a subset of user fields suitable for client display.
    """
    logger.debug(f"User profile requested for user_id: {user.id}")
    return {
        "email": user.email,
        "id": user.id,
        "name": user.name,
        "initials": user.initials,
        "created_at": user.created_at,
        "avatar_color": user.avatar_color,
        "email_verified": user.email_verified,
    }


@router.post(
    "/login",
    response_model=Token,
    summary="User Login",
    description="Authenticate a user with email and password to receive access tokens.",
    response_description="JWT access and refresh tokens",
)
async def login(request: Request, user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return access tokens.

    Parameters
    ----------
    request : Request
        The incoming HTTP request (used to check Origin header).
    user_data : UserLogin
        Login credentials containing email and password.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    Token
        Dictionary containing access_token, refresh_token, and token_type.

    Raises
    ------
    HTTPException
        400 error if credentials are invalid or user not found.
        403 error if deploy preview login attempted with non-test user.

    Notes
    -----
    Verifies password using bcrypt and creates both access and refresh tokens.
    Only allows login for non-deleted users.
    Deploy preview origins are restricted to the test user account only.
    """
    origin = request.headers.get("origin", "")
    if _DEPLOY_PREVIEW_RE.match(origin):
        test_email = settings.TEST_USER_EMAIL
        if user_data.email != test_email:
            raise HTTPException(
                status_code=403,
                detail="Deploy preview access is restricted to the test account.",
            )

    logger.debug(f"Login attempt for email: {user_data.email}")
    
    result = await db.execute(
        select(User).where(User.email == user_data.email, User.deleted_at.is_(None))
    )
    user = result.scalars().first()
    
    # DEBUG: Log what user exists if login fails
    if not user:
        all_users_debug = await db.execute(text("SELECT id, email, name FROM users LIMIT 5"))
        all_user_rows = all_users_debug.fetchall()
        logger.warning(f"No user found with email {user_data.email}. Existing users:")
        for row in all_user_rows:
            logger.warning(f"  ID {row.id}: email='{row.email}', name='{row.name}'")
    
    if not user or not verify_password(user_data.password, user.password_hash):
        logger.warning(f"Failed login attempt for email: {user_data.email}")
        raise HTTPException(status_code=400, detail="Invalid credentials")

    logger.debug(f"Successful login for user_id: {user.id}")
    access = jwt.create_access_token(data={"sub": str(user.id)})
    refresh = jwt.create_refresh_token(data={"sub": str(user.id)})
    return {"token_type": "bearer", "access_token": access, "refresh_token": refresh}


@router.post(
    "/register",
    summary="User Registration",
    description="Create a new user account and receive authentication tokens.",
    response_description="User account details with authentication tokens",
)
async def register(request: Request, user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user account.

    Parameters
    ----------
    user_data : UserCreate
        User registration data including email, name, initials, and password.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    dict
        Registration response containing tokens and user information.

    Raises
    ------
    HTTPException
        409 error if email is already registered.

    Notes
    -----
    Creates user with hashed password and default settings.
    Returns both access and refresh tokens for immediate authentication.
    Includes user profile data in response for client initialization.
    """
    origin = request.headers.get("origin", "")
    if _DEPLOY_PREVIEW_RE.match(origin):
        raise HTTPException(
            status_code=403,
            detail="Registration is disabled on deploy previews.",
        )

    logger.info(f"Registration attempt for email: {user_data.email}")
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalars().first()
    if existing_user:
        logger.warning(f"Registration failed - email already exists: {user_data.email}")
        raise HTTPException(status_code=409, detail="Email already registered.")

    password_hash = hash_password(user_data.password)
    new_user = await crud.create_user(
        user_data.name, user_data.initials, user_data.email, password_hash, db
    )

    token = new_user.generate_verification_token()
    new_user.email_verification_sent_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(new_user)

    email_service = get_email_service()
    if email_service:
        await email_service.send_verification_email(
            to_email=new_user.email,
            name=new_user.name,
            token=token,
            frontend_url=settings.FRONTEND_URL,
        )

    logger.info(f"Successfully registered new user with id: {new_user.id}")
    access_token = jwt.create_access_token(data={"sub": str(new_user.id)})
    refresh_token = jwt.create_refresh_token(data={"sub": str(new_user.id)})

    return {
        "token_type": "bearer",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "name": new_user.name,
            "initials": new_user.initials,
            "created_at": new_user.created_at,
            "email_verified": new_user.email_verified,
        },
    }


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Request a password reset link.

    Always returns 200 regardless of whether the email exists to prevent
    account enumeration.
    """
    result = await db.execute(
        select(User).where(User.email == body.email, User.deleted_at.is_(None))
    )
    user = result.scalars().first()

    if user:
        token = user.generate_password_reset_token()
        user.password_reset_sent_at = datetime.now(UTC)  # type: ignore
        await db.commit()

        email_service = get_email_service()
        if email_service:
            await email_service.send_password_reset_email(
                to_email=user.email,
                name=user.name,
                token=token,
                frontend_url=settings.FRONTEND_URL,
            )

    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset a user's password using a valid reset token."""
    result = await db.execute(
        select(User).where(
            User.password_reset_token == body.token,
            User.deleted_at.is_(None),
        )
    )
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    user.password_hash = hash_password(body.new_password)  # type: ignore
    user.password_reset_token = None  # type: ignore
    user.password_reset_sent_at = None  # type: ignore
    await db.commit()

    return {"message": "Password has been reset."}
