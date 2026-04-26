import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .services.db import init_db
from .services.env_validation import validate_env
from .routes.jobs import router as jobs_router
from .routes.admin import router as admin_router
from .routes.webhooks import router as webhooks_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("forge_agent")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://your-coding-agent.pages.dev",
    os.getenv("FRONTEND_URL", ""),
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    missing = validate_env()
    if missing:
        logger.error(f"Missing required environment variables: {', '.join(missing)}")
    try:
        init_db()
    except Exception as e:
        logger.error(f"DB init failed: {e}")
    logger.info("Forge Agent v22 started successfully")
    yield
    logger.info("Forge Agent shutting down")


app = FastAPI(
    title="Forge Agent API",
    description="AI-powered code generation, GitHub publishing, and Vercel deployment pipeline.",
    version="22.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


@app.get("/health", response_model=dict)
def health():
    return {"ok": True, "version": "22.0.0"}


app.include_router(jobs_router, prefix="/api/jobs", tags=["jobs"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
app.include_router(webhooks_router, prefix="/api/webhooks", tags=["webhooks"])
