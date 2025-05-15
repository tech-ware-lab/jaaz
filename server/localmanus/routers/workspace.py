from fastapi import APIRouter, Request


router = APIRouter(prefix="/api/workspace")

@router.post("/write_file")
async def write_workspace(request: Request):
    data = await request.json()
    path = data["path"]
    content = data["content"]
    with open(path, "w") as f:
        f.write(content)
    return {"success": True}

@router.get("/read_file")
async def read_workspace(request: Request):
    data = await request.json()
    path = data["path"]
    with open(path, "r") as f:
        return f.read()