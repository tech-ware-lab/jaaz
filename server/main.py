import asyncio
import os
import sys
import argparse
from contextlib import asynccontextmanager

if getattr(sys, 'frozen', False):
    # If running in a PyInstaller bundle, __file__ will point inside the bundle,
    # so you have to handle that carefully. Typically you use sys._MEIPASS
    # to find the "extracted" folder. For example:
    root_dir = os.path.join(sys._MEIPASS)
else:
    root_dir = os.path.dirname(__file__)

sys.path.append(root_dir)  # Add the server directory to Python path

# Add the openmanus directory to Python path
openmanus_dir = os.path.join(root_dir, "openmanus")
sys.path.append(openmanus_dir)

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from localmanus.routers import config, agent

    
@asynccontextmanager
async def lifespan(app: FastAPI):
    # onstartup
    await agent.initialize_mcp()
    yield
    # onshutdown

app = FastAPI(lifespan=lifespan)

# Include routers
app.include_router(config.router)
app.include_router(agent.router)
app.include_router(agent.wsrouter)

# Mount the React build directory
react_build_dir = os.environ.get('UI_DIST_DIR', os.path.join(os.path.dirname(root_dir), "react", "dist"))

app.mount("/assets", StaticFiles(directory=os.path.join(react_build_dir, "assets")), name="assets")

@app.get("/")
async def serve_react_app():
    return FileResponse(os.path.join(react_build_dir, "index.html"))



if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000, help='Port to run the server on')
    args = parser.parse_args()
    import uvicorn
    print("🌟Starting server, UI_DIST_DIR:", os.environ.get('UI_DIST_DIR'))
    uvicorn.run(app, host="127.0.0.1", port=args.port)
