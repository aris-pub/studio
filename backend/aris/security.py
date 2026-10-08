"""Password hashing and verification utilities using bcrypt."""

import hashlib

import bcrypt


def hash_token(raw_token: str) -> str:
    """SHA-256 hex of a raw single-use token (email verification, magic-link invite).

    We store this, never the raw token, so a database leak does not hand out usable
    tokens. The raw value lives only in the email or link sent to the user.
    """
    return hashlib.sha256(raw_token.encode()).hexdigest()


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with salt.

    Parameters
    ----------
    password : str
        The plaintext password to hash.

    Returns
    -------
    str
        The bcrypt hashed password as a UTF-8 encoded string.

    Notes
    -----
    Uses bcrypt.gensalt() to generate a random salt for each password,
    ensuring that identical passwords produce different hashes.
    """
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt(rounds=10)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash.

    Parameters
    ----------
    password : str
        The plaintext password to verify.
    hashed : str
        The bcrypt hashed password to compare against.

    Returns
    -------
    bool
        True if the password matches the hash, False otherwise.

    Notes
    -----
    This function is safe against timing attacks as bcrypt.checkpw()
    performs constant-time comparison.
    """
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))
