from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class Provider(str, Enum):
    OPENCODE_GO = "opencode-go"
    OPENCODE_ZEN = "opencode-zen"


class CreateJobRequest(BaseModel):
    app_name: str = Field(..., min_length=1, max_length=200, description="Application name")
    prompt: str = Field(..., min_length=1, max_length=10000, description="Build prompt")
    provider: Provider = Provider.OPENCODE_GO
    repo_name: Optional[str] = Field(None, max_length=100, pattern=r"^[a-z0-9][a-z0-9._-]*$")


class JobResponse(BaseModel):
    job_id: str
    state: Optional[dict] = None


class HealthResponse(BaseModel):
    ok: bool
    version: str = "22.0.0"
