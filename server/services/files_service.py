from pathlib import Path
from fastapi.responses import FileResponse

def download_file(path: str):
    file_path = Path(path)
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    return {"error": "File not found"}
