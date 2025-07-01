# server/routers/video_tools.py

# langchain & langgraph
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool, InjectedToolCallId
from typing import Annotated, Any, Dict, List, Optional

# standard libs
import json
import time

# import os
import random
import traceback
# from io import BytesIO

# third party
# import aiofiles
from nanoid import generate

# project utils/services
# from utils.http_client import HttpClient
from services.db_service import db_service
from services.websocket_service import send_to_websocket, broadcast_session_update
from common import DEFAULT_PORT
from pydantic import BaseModel, Field
from tools.vid_generators import (
    generate_video_replicate,
    generate_video_volces,
    generate_video_google,
)

PROMPTING_GUIDE = """
### Video Description Generation Prompting Guide

**Role Definition**
You are a creative specialist in a video production team. Your primary function is to collaborate with a video generation AI that creates visual content from bracketed text descriptions. For example: if you output "[sunlight filtering through trees in a misty forest]", the system will generate corresponding video footage.

**Core Responsibilities**
- Transform concise user prompts into rich, cinematic video descriptions
- Maintain strict adherence to output specifications
- Collaborate seamlessly with the video generation system

**Input-Output Workflow**
1. Users provide short video concepts (1-3 words)
2. You generate a single, detailed video description (60-90 words)
3. The system produces video based on your description

**Quality Standards**
✔ **Cinematic Detail**: Include lighting, atmosphere, character details, and motion
✔ **Emotional Resonance**: Convey mood and narrative through sensory details
✔ **Technical Precision**: Stay within strict word count limits
✔ **Organic Flow**: Ensure smooth transitions between described elements

**Revision Protocol**
- For modifications: Completely rewrite the description to incorporate changes naturally
- For new concepts: Reset completely and ignore previous context
- Never simply add new elements to existing descriptions

**Formatting Rules**
- Always output exactly one description per request
- Descriptions must be self-contained (no references to previous versions)
- Maintain consistent paragraph structure

**Exemplar Outputs**

**Example 1: Beach Scene**
"At golden hour, a woman in flowing linen stands at the water's edge, bare feet sinking slightly into wet sand. Her auburn hair catches the low sunlight as she turns toward the horizon, arms outstretched. Gentle waves foam around her ankles as seabirds circle overhead. She begins to run along the shoreline, her sundress and hair streaming behind her, leaving faint footprints that quickly vanish in the advancing tide."

**Example 2: Urban Scene**
"A cyclist in reflective gear navigates rain-slicked city streets at night, neon signs reflecting in puddles. Their breath forms visible clouds in the cold air as they lean into a turn, bike tires sending up fine sprays. Passing car headlights create dynamic shadows across weathered brick buildings, while distant traffic lights cycle through colors in the foggy distance."

**Example 3: Nature Scene**
"Time-lapse of storm clouds rolling over mountain peaks at dawn, with intermittent lightning illuminating the valley below. As the front passes, shafts of sunlight break through, creating visible rainbows that span the newly green slopes. A lone eagle rides the thermals, wings barely moving as it surveys the dramatic landscape transformation below."

**Performance Notes**
- Prioritize vivid sensory language (textures, sounds implied through visuals)
- Include 3-4 distinct visual phases/movements per description
- Balance character details with environmental context
- Suggest but don't over-specify camera movements

"""

# fastapi exception
from fastapi import HTTPException


class VolcesGenerateVideoInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for image generation. Here's prompting guide: "
        + PROMPTING_GUIDE
    )

    resolution: Optional[str] = Field(
        default="480p",
        description="Optional. The resolution of the video, only these values are allowed: 480p, 720p, 1080p.",
    )
    duration: Optional[int] = Field(
        default=5,
        description="Optional. The duration of the video in seconds, only these values are allowed: 5, 10.",
    )
    camerafixed: Optional[bool] = Field(
        default=False, description="Optional. Whether to control the camera not moved."
    )
    image_name: Optional[str | None] = Field(
        default=None,
        description="Optional; The name of the image to control as the first frame.",
    )
    aspect_ratio: Optional[str] = Field(
        default="16:9",
        description="Optional. The aspect ratio of the video, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16.",
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


def generate_video_file_id():
    return "vi_" + generate(size=8)


@tool(
    "generate_video",
    description="Generate a video using text prompt or image.",
    args_schema=VolcesGenerateVideoInputSchema,
)
async def generate_video(
    prompt,
    tool_call_id: Annotated[str, InjectedToolCallId],
    config: RunnableConfig,
    resolution="480p",
    duration=5,
    camerafixed=True,
    image_name=None,
    aspect_ratio="16:9",
):
    print("🛠️ Video tool_call_id", tool_call_id)
    ctx = config.get("configurable", {})
    canvas_id = ctx.get("canvas_id", "")
    session_id = ctx.get("session_id", "")
    print("🛠️canvas_id", canvas_id, "session_id", session_id)
    # Inject the tool call id into the context
    ctx["tool_call_id"] = tool_call_id

    model = ctx.get("model_info", {}).get("video", {})
    if model is None:
        raise ValueError("Video model is not selected")
    video_model = model.get("model", {})
    video_provider = model.get("provider", "volces")

    if video_provider == "volces":
        mime_type, width, height, filename = await generate_video_volces(
            prompt,
            video_model,
            resolution,
            duration,
            camerafixed,
            image_name,
            aspect_ratio,
        )
    elif video_provider == "replicate":
        mime_type, width, height, filename = await generate_video_replicate(
            prompt,
            video_model,
            aspect_ratio,
        )
    elif video_provider == "google":
        mime_type, width, height, filename = await generate_video_google(
            prompt,
            video_model,
            resolution,
            image_name,
        )
    else:
        raise ValueError("Video provider is not supported")

    try:
        file_id = generate_video_file_id()
        url = f"/api/file/{filename}"

        file_data = {
            "mimeType": mime_type,
            "id": file_id,
            "dataURL": url,
            "created": int(time.time() * 1000),
        }

        new_video_element = await generate_new_video_element(
            canvas_id,
            file_id,
            {
                "width": width,
                "height": height,
            },
        )

        # update the canvas data, add the new video element
        canvas_data = await db_service.get_canvas_data(canvas_id)
        if "data" not in canvas_data:
            canvas_data["data"] = {}
        if "elements" not in canvas_data["data"]:
            canvas_data["data"]["elements"] = []
        if "files" not in canvas_data["data"]:
            canvas_data["data"]["files"] = {}

        canvas_data["data"]["elements"].append(new_video_element)
        canvas_data["data"]["files"][file_id] = file_data

        # print("🛠️canvas_data", canvas_data)

        await db_service.save_canvas_data(canvas_id, json.dumps(canvas_data["data"]))

        await broadcast_session_update(
            session_id,
            canvas_id,
            {
                "type": "video_generated",
                "element": new_video_element,
                "file": file_data,
                "video_url": url,
            },
        )

        return f"video generated successfully ![video_id: {filename}](http://localhost:{DEFAULT_PORT}/api/file/{filename})"
    except Exception as e:
        print(f"Error generating video: {str(e)}")
        traceback.print_exc()
        await send_to_websocket(session_id, {"type": "error", "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


async def generate_new_video_element(canvas_id: str, fileid: str, video_data: dict):
    canvas = await db_service.get_canvas_data(canvas_id)
    canvas_data = canvas.get("data", {})
    elements = canvas_data.get("elements", [])

    # find the last video element
    last_x = 0
    last_y = 0
    last_width = 0
    # last_height = 0
    video_elements = [
        element for element in elements if element.get("type") in ("image", "video")
    ]
    last_video_element = video_elements[-1] if len(video_elements) > 0 else None
    if last_video_element is not None:
        last_x = last_video_element.get("x", 0)
        last_y = last_video_element.get("y", 0)
        last_width = last_video_element.get("width", 0)
        # last_height = last_video_element.get("height", 0)

    new_x = last_x + last_width + 20

    return {
        "type": "video",
        "id": fileid,
        "x": new_x,
        "y": last_y,
        "width": video_data.get("width", 0),
        "height": video_data.get("height", 0),
        "angle": 0,
        "fileId": fileid,
        "strokeColor": "#000000",
        "fillStyle": "solid",
        "strokeStyle": "solid",
        "boundElements": None,
        "roundness": None,
        "frameId": None,
        "backgroundColor": "transparent",
        "strokeWidth": 1,
        "roughness": 0,
        "opacity": 100,
        "groupIds": [],
        "seed": int(random.random() * 1000000),
        "version": 1,
        "versionNonce": int(random.random() * 1000000),
        "isDeleted": False,
        "index": None,
        "updated": int(time.time() * 1000),
        "link": None,
        "locked": False,
        "status": "saved",
        "scale": [1, 1],
        "crop": None,
    }
