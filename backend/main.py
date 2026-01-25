"""Aris backend: FastApi app."""

import importlib
import os
import sys
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from aris.deps import get_db
from aris.health import HealthResponse, perform_health_check
from aris.logging_config import get_logger, setup_logging
from aris.routes import (
    auth_router,
    copilot_router,
    file_assets_router,
    file_router,
    file_settings_router,
    render_router,
    signup_router,
    tag_router,
    user_public_router,
    user_router,
    user_settings_router,
)


# Initialize logging before anything else
setup_logging()
logger = get_logger(__name__)


# API metadata for documentation
logger.info("Starting Aris backend application")
app = FastAPI(
    title="Aris API",
    description="""
    **Aris** is a web-native scientific publishing platform that manages research manuscripts
    written in RSM (Research Source Markup) format.

    ## Features

    * **User Management** - Authentication, profile management, and user settings
    * **Document Management** - Create, edit, and organize research manuscripts
    * **Tagging System** - Organize documents with custom tags
    * **File Assets** - Upload and manage images, data files, and other assets
    * **Rendering** - Convert RSM markup to HTML with scientific formatting
    * **Collaboration** - Share and collaborate on research documents

    ## Authentication

    Most endpoints require authentication using JWT tokens. After registering or logging in,
    include the token in the Authorization header:

    ```
    Authorization: Bearer <your_token_here>
    ```

    ## RSM Format

    Research Source Markup (RSM) is a specialized markup format for scientific documents.

    ## Getting Started

    1. Register a new account at `/register`
    2. Login to get your authentication token at `/login`
    3. Start creating and managing documents through the `/files` endpoints
    """,
    version="1.0.0",
    contact={
        "name": "Aris Development Team",
        "url": "https://github.com/your-org/aris",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
    openapi_tags=[
        {
            "name": "authentication",
            "description": "User authentication and registration operations",
        },
        {"name": "users", "description": "User profile management and user-specific operations"},
        {
            "name": "files",
            "description": "Research document management (create, read, update, delete)",
        },
        {"name": "tags", "description": "Document organization with custom tags"},
        {
            "name": "file-assets",
            "description": "Upload and manage document assets (images, data files)",
        },
        {
            "name": "file-settings",
            "description": "User preferences for document display and formatting",
        },
        {
            "name": "user-settings",
            "description": "User behavioral preferences and privacy settings",
        },
        # {"name": "render", "description": "Convert RSM markup to rendered HTML output"},  # DISABLED FOR NOW
        {"name": "signup", "description": "Early access signup and waitlist management"},
        {"name": "copilot", "description": "AI-powered writing assistant for scientific manuscripts"},
        {"name": "public", "description": "Public preprint access without authentication"},
        {"name": "health", "description": "System health and status monitoring"},
    ],
)


@app.get("/health", tags=["health"], summary="Health Check", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """Check the health status of the API and its dependencies.

    Performs comprehensive health checks including:
    - API service availability
    - Database connectivity and responsiveness
    - Email service configuration
    # - RSM rendering engine functionality  # DISABLED FOR NOW
    - Environment configuration validation

    Returns detailed status information for monitoring and debugging.
    This endpoint does not require authentication.
    """
    health_result = await perform_health_check(db)

    # Return appropriate HTTP status based on health
    if health_result.status == "unhealthy":
        raise HTTPException(status_code=503, detail=health_result.model_dump())

    return health_result


@app.get("/debug/user-state", tags=["health"], summary="Debug User State")
async def debug_user_state(db: AsyncSession = Depends(get_db)):
    """Debug endpoint to check test user state for auth-enabled E2E diagnostic.

    Returns detailed information about the test user setup including:
    - User existence and credentials
    - File count and basic file information
    - Tag count and basic tag information
    - Database connectivity status

    This endpoint is for debugging auth-enabled E2E test failures.
    """
    try:
        # Check if test user exists
        test_user_email = os.getenv("TEST_USER_EMAIL", "testuser@aris.pub")

        user_result = await db.execute(
            text("SELECT id, email, name, created_at FROM users WHERE email = :email"),
            {"email": test_user_email}
        )
        user_row = user_result.first()

        if not user_row:
            return {
                "status": "error",
                "message": f"Test user {test_user_email} not found in database",
                "user": None,
                "files": [],
                "tags": []
            }

        user_id = user_row.id

        # Get user files
        files_result = await db.execute(
            text("SELECT id, title, status, created_at FROM files WHERE owner_id = :user_id ORDER BY created_at DESC"),
            {"user_id": user_id}
        )
        files = [{"id": row.id, "title": row.title, "status": row.status, "created_at": str(row.created_at)}
                for row in files_result.fetchall()]

        # Get user tags
        tags_result = await db.execute(
            text("SELECT id, name, color, created_at FROM tags WHERE user_id = :user_id ORDER BY created_at DESC"),
            {"user_id": user_id}
        )
        tags = [{"id": row.id, "name": row.name, "color": row.color, "created_at": str(row.created_at)}
               for row in tags_result.fetchall()]

        return {
            "status": "success",
            "user": {
                "id": user_id,
                "email": user_row.email,
                "name": user_row.name,
                "created_at": str(user_row.created_at)
            },
            "files": files,
            "files_count": len(files),
            "tags": tags,
            "tags_count": len(tags),
            "expected_test_data": {
                "files_expected": 2,
                "tags_expected": 2,
                "files_match": len(files) == 2,
                "tags_match": len(tags) == 2
            }
        }

    except Exception as e:
        logger.error(f"Debug user state failed: {e}")
        return {
            "status": "error",
            "message": f"Database error: {str(e)}",
            "user": None,
            "files": [],
            "tags": []
        }


@app.get("/debug/reload", tags=["health"], summary="Reload RSM Module")
async def reload_rsm():
    """Force reload of RSM module to pick up changes from local editable installation.

    This endpoint is useful during development when you've made changes to the local
    RSM package and want to reload it without restarting the entire backend service.

    Returns status of the reload operation. Only available in development environment.
    """
    # Only allow in development environment
    if os.getenv("ENV") in ("PROD", "STAGING"):
        raise HTTPException(status_code=404, detail="Not found")

    try:
        # Get all RSM-related modules that are currently imported
        rsm_modules = [name for name in sys.modules.keys() if name.startswith('rsm')]

        # Reload each RSM module
        reloaded_modules = []
        for module_name in rsm_modules:
            if module_name in sys.modules:
                importlib.reload(sys.modules[module_name])
                reloaded_modules.append(module_name)

        logger.info(f"Reloaded RSM modules: {reloaded_modules}")

        return {
            "status": "success",
            "message": "RSM modules reloaded successfully",
            "reloaded_modules": reloaded_modules,
            "module_count": len(reloaded_modules)
        }

    except Exception as e:
        logger.error(f"RSM module reload failed: {e}")
        return {
            "status": "error",
            "message": f"Failed to reload RSM modules: {str(e)}"
        }


origins = [
    "https://app.rsm.studio",  # Production frontend
    "https://rsm.studio",  # Production landing site
    "https://aris-frontend.netlify.app",  # Legacy Netlify URL (remove after migration)
]

# Add local development origins only if environment variables are set
if os.getenv('FRONTEND_PORT'):
    origins.extend([
        f"http://localhost:{os.getenv('FRONTEND_PORT')}",  # local Vue app (Vite dev server)
        f"http://127.0.0.1:{os.getenv('FRONTEND_PORT')}",  # 127.0.0.1 variant
        f"http://localhost:{int(os.getenv('FRONTEND_PORT', '5173')) + 1}",  # alternate port
        f"http://127.0.0.1:{int(os.getenv('FRONTEND_PORT', '5173')) + 1}",  # 127.0.0.1 variant
        f"http://localhost:{int(os.getenv('FRONTEND_PORT', '5173')) + 2}",  # third instance
        f"http://127.0.0.1:{int(os.getenv('FRONTEND_PORT', '5173')) + 2}",  # 127.0.0.1 variant
    ])

if os.getenv('SITE_PORT'):
    origins.extend([
        f"http://localhost:{os.getenv('SITE_PORT')}",  # local Nuxt app
        f"http://127.0.0.1:{os.getenv('SITE_PORT')}",  # 127.0.0.1 variant
    ])

if os.getenv('STORYBOOK_PORT'):
    origins.extend([
        f"http://localhost:{os.getenv('STORYBOOK_PORT')}",  # local Storybook
        f"http://127.0.0.1:{os.getenv('STORYBOOK_PORT')}",  # 127.0.0.1 variant
    ])


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with proper tags
logger.info("Registering API routers")
app.include_router(auth_router, tags=["authentication"])
app.include_router(user_router, tags=["users"])
app.include_router(user_public_router, tags=["users"])
app.include_router(file_router, tags=["files"])
app.include_router(tag_router, tags=["tags"])
app.include_router(file_assets_router, tags=["file-assets"])
app.include_router(file_settings_router, tags=["file-settings"])
app.include_router(user_settings_router, tags=["user-settings"])
app.include_router(render_router, tags=["render"])
app.include_router(signup_router, tags=["signup"])
app.include_router(copilot_router, tags=["copilot"])
logger.info("All routers registered successfully")


@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static") or request.url.path.startswith("/styles") or request.url.path.startswith("/brand"):
        response.headers["Cache-Control"] = "no-store"
    return response


# Mount RSM static files - dynamically find RSM static directory
def find_rsm_static_dir():
    """Find RSM static directory, works with both PyPI and editable installs."""
    import rsm
    rsm_module_path = Path(rsm.__file__).parent
    static_dir = rsm_module_path / "static"
    if static_dir.exists():
        return str(static_dir)

    # Fallback to site-packages if static dir not found
    fallback_dir = Path(".venv/lib/python3.13/site-packages/rsm/static")
    if fallback_dir.exists():
        return str(fallback_dir)

    raise RuntimeError(f"RSM static directory not found. Tried: {static_dir}, {fallback_dir}")

app.mount(
    "/static",
    StaticFiles(directory=find_rsm_static_dir()),
    name="static",
)

# Mount styles (only if directory exists)
styles_paths = [
    "../styles",  # When running from backend/ directory
    "styles",     # When running from project root
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "styles")  # Absolute path fallback
]

styles_dir = None
for path in styles_paths:
    if os.path.exists(path):
        styles_dir = path
        break

if styles_dir:
    app.mount(
        "/styles",
        StaticFiles(directory=styles_dir),
        name="styles"
    )
    logger.info(f"Styles mounted successfully at /styles from {styles_dir}")
else:
    logger.info(f"Styles directory not found. Tried paths: {styles_paths}")

# Mount brand assets (only if directory exists)
brand_paths = [
    "../brand",  # When running from backend/ directory
    "brand",     # When running from project root
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "brand")  # Absolute path fallback
]

brand_dir = None
for path in brand_paths:
    if os.path.exists(path):
        brand_dir = path
        break

if brand_dir:
    app.mount(
        "/brand",
        StaticFiles(directory=brand_dir),
        name="brand"
    )
    logger.info(f"Brand assets mounted successfully at /brand from {brand_dir}")
else:
    logger.info(f"Brand directory not found. Tried paths: {brand_paths}")
