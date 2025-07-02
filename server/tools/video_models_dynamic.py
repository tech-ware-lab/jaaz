from __future__ import annotations

import asyncio
import json
import os
import random
import time
import traceback
from io import BytesIO
from types import NoneType
from typing import Annotated, Any, Dict, List, Optional, Required

from common import DEFAULT_PORT
from services.tool_service import tool_service
from .image_generation_utils import (
    generate_file_id,
    generate_new_image_element,
    generate_new_video_element,
)
from .video_generation_utils import generate_video_file_id  # Add this import
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import InjectedToolCallId, tool, BaseTool
from pydantic import BaseModel, Field, create_model
from routers.comfyui_execution import upload_image
from services.config_service import SERVER_DIR
from services.db_service import db_service
from services.websocket_service import broadcast_session_update, send_to_websocket
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
    generate_video_volces,
)
# Remove the circular import - we'll pass models as parameter instead
# from routers.agent import get_models


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

PROVIDERS = {
    "volces": generate_video_volces,
}

def _get_video_model_type(provider:str, model:str) -> str | list[str]:
    with open(os.path.join(SERVER_DIR, "tools", "vid_generators", "config", "video.json"), 'r') as f:
        video_model_types = json.load(f)
    return video_model_types[provider]["model_type"][model]

def _get_provider_options(provider:str) -> dict[str, dict[str, str]]:
    with open(os.path.join(SERVER_DIR, "tools", "vid_generators", "config", "video.json"), 'r') as f:
        provider_options = json.load(f)
    return provider_options[provider]["input_types"]

def _guess_type(input_type:str, required:bool) -> type:
    if required:
        if input_type == "int":
            return int
        elif input_type == "float":
            return float
        elif input_type == "str":
            return str
        elif input_type == "bool":
            return bool
        else:
            return NoneType
    else:
        if input_type == "int":
            return Optional[int]
        elif input_type == "float":
            return Optional[float]
        elif input_type == "str":
            return Optional[str]
        elif input_type == "bool":
            return Optional[bool]
        else:
            return NoneType

def _build_video_input_schema(provider:str, model:str) -> type[BaseModel]:
    """
    Build a Pydantic model named '<provider><model>InputSchema'.

    The `inputs` column is stored in DB as JSON text -> parse first.
    """
    try:
        video_type = _get_video_model_type(provider, model)
    except Exception:
        # fall back to empty model if bad schema
        raise TypeError("The model selected is not supported.")

    pydantic_options = _get_provider_options(provider)
    
    if type(video_type) != list and video_type != "i2v":
        # t2v, remove image in pydantic_options.keys()
        del pydantic_options["image"]
    # TODO:process to pydantic options

    fields: Dict[str, tuple] = {}

    for value_name, value_cond in pydantic_options.items():
        required = value_cond.get("value_cond", None) is None
        py_t = _guess_type(value_cond["type"], required)
        if required:
            default_val = value_cond.get("default")
        desc = value_cond.get("description", "")
        if required:
            desc = f"Required. {desc}"
            fields[value_name] = (py_t, Field(description=desc))
        else:
            desc = f"Optional. {desc}"
            fields[value_name] = (
                Optional[py_t],
                Field(default=default_val, description=desc),
            )
    fields["tool_call_id"] = (
        Annotated[str, InjectedToolCallId],
        Field(description="Tool call identifier"),
    )
    model_name = f"{provider}{model.replace("-", "")}InputSchema"
    return create_model(model_name, __base__=BaseModel, **fields)

def _build_video_generator(provider:str, model:str) -> type[BaseModel]:
    """
    Return an @tool function for the video model.
    """
    model_input_schema = _build_video_input_schema(provider, model)

    @tool(
        provider + "_" + model.replace("_", ""),
        description=f"Generate video by calling {model} by {provider}",
        args_schema=model_input_schema,
    )
    async def _run(
        config: RunnableConfig,
        tool_call_id: Annotated[str, InjectedToolCallId],
        **kwargs,
    ) -> str:
        """
        Generate a video based on the input parameters.
        """
        print("🛠️ Video tool_call_id", tool_call_id)
        ctx = config.get("configurable", {})
        canvas_id = ctx.get("canvas_id", "")
        session_id = ctx.get("session_id", "")
        print("🛠️canvas_id", canvas_id, "session_id", session_id)
        # Inject the tool call id into the context
        ctx["tool_call_id"] = tool_call_id

        model = ctx.get("model_info", {}).get("image", {})
        if model is None:
            raise ValueError("Video model is not selected")
        video_model = model.get("model", {})
        kwargs["model"] = video_model
        video_provider = model.get("provider", "volces")
        try:
            fn = PROVIDERS[video_provider]
        except KeyError:
            raise NotImplementedError(f"Video provider {video_provider} is not supported")
        try:
            mime_type, width, height, filename = await fn(
                **kwargs,
            )

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
    return _run

async def register_video_models(available_models: List[dict] = None) -> Dict[str, BaseTool]:
    """
    Fetch all available video models from provided list and build tool callables.
    Run inside the current event loop.
    """
    dynamic_video_models: Dict[str, BaseTool] = {}
    try:
        if available_models is None:
            # If no models provided, return empty dict to avoid circular import
            return {}
            
        video_models: list[dict[str, str]] = []
        for model in available_models:
            if model.get("type", None) == "video":
                model_name = model.get("model")
                model_provider = model.get("provider")
                video_models.append({
                    "model": model_name,
                    "provider": model_provider,
                })
            else:
                continue
    except Exception as exc:  # pragma: no cover
        print("❌Failed to get video models:", exc)
        traceback.print_stack()
        return {}

    for video_model in video_models:
        try:
            tool_fn = _build_video_generator(video_model["provider"], video_model["model"])
            # Export with a unique python identifier so that `dir(module)` works
            unique_name = f"{video_model['model']}_by_{video_model['provider']}"
            dynamic_video_models[unique_name] = tool_fn
            tool_service.register_tool(unique_name, tool_fn)
        except Exception as exc:  # pragma: no cover
            print(
                f"Failed to create tool for video model {video_model['model']}: {exc}"
            )
            print(traceback.print_stack())

    return dynamic_video_models

# Remove the automatic registration at import time
# def _ensure_async_registration():
#     """
#     Schedule register_video_models() in the current (or newly created) event loop.
#     Top-level awaits are not allowed in import time, so we create a task.
#     """
#     try:
#         loop = asyncio.get_event_loop()
#     except RuntimeError:
#         # No loop yet; create one
#         loop = asyncio.new_event_loop()
#         asyncio.set_event_loop(loop)

#     # if loop already running, just create a task
#     if loop.is_running():
#         loop.create_task(register_video_models())
#     else:
#         # For synchronous contexts (e.g. CLI startup), run until complete
#         loop.run_until_complete(register_video_models())

# # trigger registration at import
# _ensure_async_registration()
