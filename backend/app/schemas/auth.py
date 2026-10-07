from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    login_type: Literal["root", "iam"] = "iam"
    # Only checked for IAM sign-in, as on the real AWS sign-in page
    account_id: str | None = Field(default=None, max_length=64)
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    account_id: str
