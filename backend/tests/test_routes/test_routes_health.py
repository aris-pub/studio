"""Health check endpoint tests."""

from unittest.mock import patch


async def test_health_check_healthy(client):
    """Test health endpoint returns healthy or degraded status when core systems are working."""
    response = await client.get("/health")
    assert response.status_code == 200
    
    data = response.json()
    # In CI, may be degraded due to short JWT_SECRET_KEY, but should not be unhealthy
    assert data["status"] in ["healthy", "degraded"]
    assert data["message"] in ["RSM Studio API is healthy", "RSM Studio API is degraded but functional"]
    assert "checks" in data
    assert "timestamp" in data
    
    # Check all health components
    expected_checks = ["api", "database", "email_service", "rsm_rendering", "environment_config"]
    for check_name in expected_checks:
        assert check_name in data["checks"]
        assert "status" in data["checks"][check_name]
        assert "response_time_ms" in data["checks"][check_name]
        assert "message" in data["checks"][check_name]
    
    # Verify specific checks
    assert data["checks"]["api"]["status"] == "healthy"
    assert data["checks"]["database"]["status"] == "healthy"
    assert data["checks"]["database"]["message"] == "Database connection successful"
    
    # RSM rendering should be healthy
    assert data["checks"]["rsm_rendering"]["status"] == "healthy"
    assert data["checks"]["rsm_rendering"]["message"] == "RSM rendering engine is working"
    
    # Environment config should be healthy or degraded (degraded in CI due to short JWT key)
    assert data["checks"]["environment_config"]["status"] in ["healthy", "degraded"]
    
    # Email service might be disabled, which is okay
    assert data["checks"]["email_service"]["status"] in ["healthy", "disabled"]


async def test_health_check_database_failure(client):
    """Test health endpoint returns unhealthy status when database is down."""
    with patch("aris.health.check_database_health") as mock_db_check:
        mock_db_check.return_value = {
            "status": "unhealthy",
            "response_time_ms": 1000.0,
            "message": "Database connection failed: Connection refused"
        }
        
        response = await client.get("/health")
        assert response.status_code == 503
        
        data = response.json()["detail"]
        assert data["status"] == "unhealthy"
        assert data["message"] == "RSM Studio API is unhealthy"
        assert data["checks"]["database"]["status"] == "unhealthy"
        assert "Connection refused" in data["checks"]["database"]["message"]


async def test_health_check_rsm_failure(client):
    """Test health endpoint returns unhealthy when RSM rendering fails."""
    with patch("aris.health.check_rsm_rendering_health") as mock_rsm_check:
        mock_rsm_check.return_value = {
            "status": "unhealthy",
            "response_time_ms": 500.0,
            "message": "RSM rendering error: Import failed"
        }
        
        response = await client.get("/health")
        assert response.status_code == 503
        
        data = response.json()["detail"]
        assert data["status"] == "unhealthy"
        assert data["checks"]["rsm_rendering"]["status"] == "unhealthy"
        assert "Import failed" in data["checks"]["rsm_rendering"]["message"]


async def test_health_check_email_service_disabled(client):
    """Test health endpoint handles disabled email service gracefully."""
    with patch("aris.health.check_email_service_health") as mock_email_check:
        mock_email_check.return_value = {
            "status": "disabled",
            "response_time_ms": 1.0,
            "message": "Email service is disabled (RESEND_API_KEY not configured)"
        }
        
        response = await client.get("/health")
        # Should still be healthy/degraded since email is non-critical
        assert response.status_code == 200
        
        data = response.json()
        # May be degraded due to other config issues (like short JWT key in CI)
        assert data["status"] in ["healthy", "degraded"]
        assert data["checks"]["email_service"]["status"] == "disabled"


async def test_health_check_response_structure(client):
    """Test health endpoint returns properly structured response."""
    response = await client.get("/health")
    data = response.json()
    
    # Required top-level fields
    required_fields = ["status", "message", "checks", "timestamp"]
    for field in required_fields:
        assert field in data, f"Missing required field: {field}"
    
    # Check structure of all health checks
    expected_checks = ["api", "database", "email_service", "rsm_rendering", "environment_config"]
    for check_name in expected_checks:
        assert check_name in data["checks"]
        
        check = data["checks"][check_name]
        assert "status" in check
        assert "message" in check
        assert "response_time_ms" in check
        
        # Validate response times are numbers
        assert isinstance(check["response_time_ms"], (int, float))
        assert check["response_time_ms"] >= 0
        
        # Validate status values
        assert check["status"] in ["healthy", "degraded", "unhealthy", "disabled"]
