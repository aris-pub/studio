"""Health check functionality for the Aris backend.

This module provides comprehensive health monitoring for all critical
and non-critical system components.
"""

import asyncio
import os
import time
from datetime import UTC, datetime
from typing import Any, Dict

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .logging_config import get_logger
from .services.email import get_email_service


logger = get_logger(__name__)


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str
    message: str
    checks: Dict[str, Any]
    timestamp: str


async def check_database_health(db: AsyncSession) -> Dict[str, Any]:
    """Check database connectivity and basic functionality.

    Args:
        db: Database session

    Returns:
        Dictionary with database health status
    """
    start_time = time.time()
    try:
        # Simple query to check connectivity
        result = await db.execute(text("SELECT 1"))
        result.fetchone()

        response_time = round((time.time() - start_time) * 1000, 2)
        logger.debug(f"Database health check passed in {response_time}ms")

        return {
            "status": "healthy",
            "response_time_ms": response_time,
            "message": "Database connection successful",
        }
    except Exception as e:
        response_time = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Database health check failed after {response_time}ms: {str(e)}")

        return {
            "status": "unhealthy",
            "response_time_ms": response_time,
            "message": f"Database connection failed: {str(e)}",
        }


async def check_email_service_health() -> Dict[str, Any]:
    """Check email service connectivity and configuration.

    Returns:
        Dictionary with email service health status
    """
    start_time = time.time()
    try:
        email_service = get_email_service()
        response_time = round((time.time() - start_time) * 1000, 2)

        if email_service is None:
            logger.debug(f"Email service health check - service disabled in {response_time}ms")
            return {
                "status": "disabled",
                "response_time_ms": response_time,
                "message": "Email service is disabled (RESEND_API_KEY not configured)",
            }

        # Service is configured and available
        logger.debug(f"Email service health check passed in {response_time}ms")
        return {
            "status": "healthy",
            "response_time_ms": response_time,
            "message": "Email service configured and available",
        }

    except Exception as e:
        response_time = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Email service health check failed after {response_time}ms: {str(e)}")

        return {
            "status": "unhealthy",
            "response_time_ms": response_time,
            "message": f"Email service error: {str(e)}",
        }


async def check_rsm_rendering_health() -> Dict[str, Any]:
    """Check RSM rendering engine functionality.

    Returns:
        Dictionary with RSM rendering health status
    """
    start_time = time.time()
    try:
        import rsm

        # Test simple RSM rendering
        test_rsm = "# Test content"
        result = rsm.render(test_rsm, handrails=True)

        response_time = round((time.time() - start_time) * 1000, 2)

        if result and len(result) > 0:
            logger.debug(f"RSM rendering health check passed in {response_time}ms")
            return {
                "status": "healthy",
                "response_time_ms": response_time,
                "message": "RSM rendering engine is working",
            }
        else:
            logger.warning(f"RSM rendering health check - empty result in {response_time}ms")
            return {
                "status": "degraded",
                "response_time_ms": response_time,
                "message": "RSM rendering returned empty result",
            }

    except Exception as e:
        response_time = round((time.time() - start_time) * 1000, 2)
        logger.error(f"RSM rendering health check failed after {response_time}ms: {str(e)}")

        return {
            "status": "unhealthy",
            "response_time_ms": response_time,
            "message": f"RSM rendering error: {str(e)}",
        }


def check_environment_config() -> Dict[str, Any]:
    """Check critical environment configuration.

    Returns:
        Dictionary with environment config health status
    """
    start_time = time.time()
    issues = []

    # Check critical environment variables
    critical_vars = {
        "DB_URL_LOCAL": settings.DB_URL_LOCAL,
        "DB_URL_PROD": settings.DB_URL_PROD,
        "JWT_SECRET_KEY": settings.JWT_SECRET_KEY,
    }

    for var_name, var_value in critical_vars.items():
        if not var_value:
            issues.append(f"{var_name} not configured")

    # Check JWT secret is not default/weak
    if settings.JWT_SECRET_KEY and len(settings.JWT_SECRET_KEY) < 32:
        issues.append("JWT_SECRET_KEY appears to be too short (< 32 chars)")

    response_time = round((time.time() - start_time) * 1000, 2)

    if issues:
        logger.warning(f"Environment config issues detected: {', '.join(issues)}")
        return {
            "status": "degraded",
            "response_time_ms": response_time,
            "message": f"Configuration issues: {', '.join(issues)}",
            "issues": issues,
        }

    logger.debug(f"Environment config health check passed in {response_time}ms")
    return {
        "status": "healthy",
        "response_time_ms": response_time,
        "message": "All critical environment variables configured",
    }


async def check_supervisord_services() -> Dict[str, Any]:
    """Check that all supervisord services are running.

    Returns:
        Dictionary with supervisord services health status
    """
    start_time = time.time()

    # Skip supervisord check in test environment
    if os.environ.get("ENV") == "TEST":
        response_time = round((time.time() - start_time) * 1000, 2)
        logger.debug(f"Supervisord health check skipped (test mode) in {response_time}ms")
        return {
            "status": "skipped",
            "response_time_ms": response_time,
            "message": "Supervisord not configured (test environment)",
        }

    # Check if we're running under supervisord (production/docker)
    health_check_script = "/usr/local/bin/health-check.sh"
    if not os.path.exists(health_check_script):
        # Not running under supervisord (development mode)
        response_time = round((time.time() - start_time) * 1000, 2)
        logger.debug(f"Supervisord health check skipped (dev mode) in {response_time}ms")
        return {
            "status": "skipped",
            "response_time_ms": response_time,
            "message": "Supervisord not configured (development mode)",
        }

    try:
        # Run the health check script
        result = await asyncio.create_subprocess_exec(
            health_check_script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await result.communicate()

        response_time = round((time.time() - start_time) * 1000, 2)

        if result.returncode == 0:
            logger.debug(f"Supervisord services health check passed in {response_time}ms")
            return {
                "status": "healthy",
                "response_time_ms": response_time,
                "message": "All services running (backend, multiplayer, lsp)",
            }
        else:
            error_msg = stderr.decode().strip() if stderr else stdout.decode().strip()
            logger.error(f"Supervisord services health check failed: {error_msg}")
            return {
                "status": "unhealthy",
                "response_time_ms": response_time,
                "message": f"Some services not running: {error_msg}",
            }

    except Exception as e:
        response_time = round((time.time() - start_time) * 1000, 2)
        logger.error(f"Supervisord health check error after {response_time}ms: {str(e)}")
        return {
            "status": "unhealthy",
            "response_time_ms": response_time,
            "message": f"Health check error: {str(e)}",
        }


async def perform_health_check(db: AsyncSession) -> HealthResponse:
    """Perform comprehensive health check of all system components.

    Args:
        db: Database session

    Returns:
        Complete health check response
    """
    logger.debug("Health check requested")
    start_time = time.time()

    # Run all health checks
    db_health = await check_database_health(db)
    email_health = await check_email_service_health()
    rsm_health = await check_rsm_rendering_health()
    config_health = check_environment_config()
    services_health = await check_supervisord_services()

    # Calculate total response time
    total_response_time = round((time.time() - start_time) * 1000, 2)

    checks = {
        "api": {
            "status": "healthy",
            "message": "API service is running",
            "response_time_ms": total_response_time,
        },
        "database": db_health,
        "email_service": email_health,
        "rsm_rendering": rsm_health,
        "environment_config": config_health,
        "services": services_health,
    }

    # Determine overall status based on all checks
    # Services check is critical in production, but skipped in dev
    critical_checks = [db_health, rsm_health, config_health]
    if services_health["status"] != "skipped":
        critical_checks.append(services_health)

    non_critical_checks = [email_health]  # Email can be disabled

    # Check if any critical systems are unhealthy
    critical_unhealthy = any(check["status"] == "unhealthy" for check in critical_checks)

    # Check if any systems are degraded
    any_degraded = any(
        check["status"] in ["degraded", "unhealthy"]
        for check in critical_checks + non_critical_checks
    )

    if critical_unhealthy:
        overall_status = "unhealthy"
    elif any_degraded:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    # Log the result
    if overall_status == "healthy":
        logger.debug(f"Health check passed - total response time: {total_response_time}ms")
    elif overall_status == "degraded":
        logger.warning("Health check degraded - some systems have issues")
    else:
        logger.error("Health check failed - critical systems are unhealthy")

    return HealthResponse(
        status=overall_status,
        message=f"Aris API is {overall_status}",
        checks=checks,
        timestamp=datetime.now(UTC).isoformat(),
    )
