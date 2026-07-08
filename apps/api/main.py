from apps.api.env import load_env_file

load_env_file()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.routers import drafts, projects

app = FastAPI(title="Rankforge API", version="0.1.0")

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
