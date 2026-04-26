import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import jobs, webhooks, admin
from .routes.stripe_routes import router as stripe_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(title="Forge Agent", version="23.0.0")

allowed_origins = [
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", ""),
    "https://your-coding-agent.pages.dev",
]
allowed_origins = [o for o in allowed_origins if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(stripe_router, prefix="/api/stripe", tags=["stripe"])


@app.get("/api/health")
def health():
    return {"ok": True, "version": "23.0.0"}
