import os
import asyncio
import logging
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()
from logger import setup_logging
from database import init_database
from config import TOOLS_CONFIG, REPORTS_DIR
from monitor import monitor_devices_task
from plugin_manager import load_plugins
from routers import cases, reports, profiles, tasks, processing, backups, system, timeline

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize all configured forensic tool plugins on startup"""
    # Init database
    init_database()
    logger.info("Database initialized")

    # Init each tool
    load_plugins()
    
    asyncio.create_task(monitor_devices_task())
    yield

app = FastAPI(lifespan=lifespan)

# Include Routers
app.include_router(system.router)
app.include_router(cases.router)
app.include_router(reports.router)
app.include_router(profiles.router)
app.include_router(tasks.router)
app.include_router(processing.router)
app.include_router(backups.router)
app.include_router(timeline.router)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure reports directory exists
if not os.path.exists(REPORTS_DIR):
    os.makedirs(REPORTS_DIR)

# Mount the root reports directory to serve report files
app.mount("/reports", StaticFiles(directory=REPORTS_DIR), name="reports")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)