from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os, sys

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
sys.path.append(os.path.dirname(__file__))

from database import engine, Base
import models

from routers import sales, cheques, inventory, cashflow, assistant, importer

# Create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="1st Choice Bathco — Business Management",
    description="Custom business management software for 1st Choice Bathco (Pvt) Ltd, Thihariya, Sri Lanka",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sales.router)
app.include_router(cheques.router)
app.include_router(inventory.router)
app.include_router(cashflow.router)
app.include_router(assistant.router)
app.include_router(importer.router)

# Serve frontend
frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "static")), name="static")

    @app.get("/", include_in_schema=False)
    def serve_frontend():
        return FileResponse(os.path.join(frontend_path, "index.html"))


@app.get("/health")
def health():
    return {"status": "running", "app": "1st Choice Bathco Business Management"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
