from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # LLM providers. All three speak the OpenAI chat-completions API, so any
    # combination may be configured — one, two, or all three. Whichever keys
    # are present form the fallback chain; the app only fails if none are.
    GROQ_API_KEY: str = ""
    NVIDIA_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""

    # Promoted to the front of the chain on every provider that serves it.
    # GROQ_MODEL is the old name, kept working since it predates the chain
    # spanning more than one provider; PREFERRED_MODEL wins when both are set.
    PREFERRED_MODEL: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"

    @property
    def preferred_model(self) -> str:
        return self.PREFERRED_MODEL or self.GROQ_MODEL

    # Comma-separated model ids per provider, so a renamed or newly available
    # model is an .env edit rather than a code change.
    GROQ_MODELS: str = "openai/gpt-oss-120b,qwen/qwen3.8-27b,qwen/qwen3.6-27b,openai/gpt-oss-20b"
    NVIDIA_MODELS: str = "openai/gpt-oss-120b,nvidia/llama-3.3-nemotron-super-49b-v1.5"
    OPENROUTER_MODELS: str = "openai/gpt-oss-120b"

    # Sent by OpenRouter's API for attribution; harmless elsewhere.
    OPENROUTER_APP_URL: str = "http://localhost:3000"
    OPENROUTER_APP_TITLE: str = "FinPilot"
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    CORS_ORIGINS: str = "http://localhost:3000"

    MCP_SERVER_PORT: int = 8100
    ENVIRONMENT: str = "development"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
