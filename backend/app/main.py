from fastapi import FastAPI

from app.api.routes import health

app = FastAPI(title="Resume Intelligence API")
app.include_router(health.router)
