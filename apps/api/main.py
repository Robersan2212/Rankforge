from contextlib import asynccontextmanager

from apps.api.env import load_env_file

load_env_file()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.jobs.keyword_ranking_scheduler import (
    shutdown_keyword_ranking_scheduler,
    start_keyword_ranking_scheduler,
)
from apps.api.routers import drafts, projects


@asynccontextmanager
async def lifespan(_app: FastAPI):
    start_keyword_ranking_scheduler()
    try:
        yield
    finally:
        shutdown_keyword_ranking_scheduler()


app = FastAPI(title="Rankforge API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(drafts.router)


@app.get("/health")
def health():
    return {"status": "ok"}
