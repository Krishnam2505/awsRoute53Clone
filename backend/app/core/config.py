"""Application settings, read from environment variables (or a local .env file)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Route 53 Clone API"
    database_url: str = "sqlite:///./route53.db"
    session_cookie_name: str = "r53_session"
    session_cookie_secure: bool = True
    session_ttl_days: int = 7
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
