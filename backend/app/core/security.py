import os
from datetime import datetime, timedelta, timezone

import bcrypt
from dotenv import load_dotenv
from jose import JWTError, jwt


load_dotenv()


# ============================================================
# JWT CONFIGURATION
# ============================================================

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not configured"
    )


JWT_ALGORITHM = "HS256"

# Access token lifetime.
# 8 hours is suitable for a school ERP working session.
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "480",
    )
)


# ============================================================
# CREATE ACCESS TOKEN
# ============================================================

def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT access token.

    If expires_delta is provided, that duration is used.
    Otherwise ACCESS_TOKEN_EXPIRE_MINUTES is used.
    """

    to_encode = data.copy()

    if expires_delta is not None:
        expire = (
            datetime.now(timezone.utc)
            + expires_delta
        )
    else:
        expire = (
            datetime.now(timezone.utc)
            + timedelta(
                minutes=ACCESS_TOKEN_EXPIRE_MINUTES
            )
        )

    to_encode.update(
        {
            "exp": expire,
        }
    )

    return jwt.encode(
        to_encode,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


# ============================================================
# DECODE ACCESS TOKEN
# ============================================================

def decode_access_token(
    token: str,
) -> dict:
    """
    Decode and validate JWT access token.

    JWTError covers:
    - expired token
    - invalid signature
    - malformed token
    - invalid claims
    """

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        return payload

    except JWTError as exc:
        raise ValueError(
            "Invalid or expired token"
        ) from exc


# ============================================================
# PASSWORD HASHING
# ============================================================

def hash_password(
    password: str,
) -> str:
    password_bytes = password.encode(
        "utf-8"
    )

    hashed_password = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt(),
    )

    return hashed_password.decode(
        "utf-8"
    )


# ============================================================
# PASSWORD VERIFICATION
# ============================================================

def verify_password(
    password: str,
    hashed_password: str,
) -> bool:
    password_bytes = password.encode(
        "utf-8"
    )

    hashed_bytes = hashed_password.encode(
        "utf-8"
    )

    return bcrypt.checkpw(
        password_bytes,
        hashed_bytes,
    )