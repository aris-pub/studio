"""Logging configuration for the RSM Studio backend.

Provides centralized logging setup with environment-aware configuration.
Designed for development stage - console output with structured formatting.
"""

import logging
import os
import sys
from typing import Optional


def setup_logging(log_level: Optional[str] = None) -> None:
    """Configure application logging.
    
    Args:
        log_level: Override log level. If None, uses environment-based defaults.
    """
    # Determine log level based on environment
    if log_level is None:
        env = os.getenv("ENV", "LOCAL")
        ci_mode = os.getenv("CI") or env == "CI"
        
        if ci_mode:
            log_level = "INFO"
        else:
            log_level = "DEBUG"
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format="%(asctime)s | %(levelname)8s | %(name)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
        force=True,
    )
    
    # Set specific loggers to avoid noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.dialects").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    
    # Create application logger
    logger = logging.getLogger("aris")
    logger.info(f"Logging initialized with level: {log_level}")


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance for a specific module.
    
    Args:
        name: Logger name, typically __name__ from calling module.
        
    Returns:
        Configured logger instance.
    """
    return logging.getLogger(name)