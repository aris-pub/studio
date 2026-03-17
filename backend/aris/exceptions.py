"""Common exception utilities for the RSM Studio backend."""

from fastapi import HTTPException, status


def not_found_exception(resource: str, resource_id: int | None = None) -> HTTPException:
    """Create a standardized 404 Not Found exception.

    Parameters
    ----------
    resource : str
        The name of the resource that was not found (e.g., "User", "File", "Tag").
    resource_id : int, optional
        The ID of the resource that was not found.

    Returns
    -------
    HTTPException
        A 404 exception with standardized error message.
    """
    if resource_id is not None:
        detail = f"{resource} with id {resource_id} not found"
    else:
        detail = f"{resource} not found"
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def unauthorized_exception(message: str = "Unauthorized access") -> HTTPException:
    """Create a standardized 401 Unauthorized exception.

    Parameters
    ----------
    message : str, optional
        Custom unauthorized message (default: "Unauthorized access").

    Returns
    -------
    HTTPException
        A 401 exception with the specified message.
    """
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)


def bad_request_exception(message: str) -> HTTPException:
    """Create a standardized 400 Bad Request exception.

    Parameters
    ----------
    message : str
        The error message describing what went wrong.

    Returns
    -------
    HTTPException
        A 400 exception with the specified message.
    """
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


def forbidden_exception(message: str = "Access forbidden") -> HTTPException:
    """Create a standardized 403 Forbidden exception.

    Parameters
    ----------
    message : str, optional
        Custom forbidden message (default: "Access forbidden").

    Returns
    -------
    HTTPException
        A 403 exception with the specified message.
    """
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)


def validation_exception(field: str, message: str) -> HTTPException:
    """Create a standardized 422 Validation Error exception.

    Parameters
    ----------
    field : str
        The field that failed validation.
    message : str
        The validation error message.

    Returns
    -------
    HTTPException
        A 422 exception with field-specific validation error.
    """
    detail = f"Validation error for {field}: {message}"
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)

