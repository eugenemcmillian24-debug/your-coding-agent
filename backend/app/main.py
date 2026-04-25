from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .services.db import init_db
from .services.env_validation import validate_env
from .routes.jobs import router as jobs_router
from .routes.admin import router as admin_router
from .routes.webhooks import router as webhooks_router
app = FastAPI(title='Forge Agent v17 Real Integrations API')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
@app.on_event('startup')
def startup():
    missing = validate_env()
    if missing:
        raise RuntimeError('Missing required environment variables: ' + ', '.join(missing))
    init_db()
@app.get('/health')
def health():
    return {'ok': True}
app.include_router(jobs_router, prefix='/api/jobs', tags=['jobs'])
app.include_router(admin_router, prefix='/api/admin', tags=['admin'])
app.include_router(webhooks_router, prefix='/api/webhooks', tags=['webhooks'])
