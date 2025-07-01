from __future__ import annotations

import asyncio
import json
import os
import random
import time
import traceback
from io import BytesIO
from typing import Annotated, Any, Dict, List, Optional

from common import DEFAULT_PORT
from services.tool_service import tool_service
from .image_generation_utils import (
    generate_file_id,
    generate_new_image_element,
    generate_new_video_element,
)
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import InjectedToolCallId, tool, BaseTool
from pydantic import BaseModel, Field, create_model
from routers.comfyui_execution import upload_image
from services.config_service import FILES_DIR, config_service, IMAGE_FORMATS
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

def _get_video_model_type(provider:str, model:str) -> str | list[str]:
    with open(os.path.join(os.path.dirname(__file__), "vid_generators", "config", "video.json"), 'r') as f:
        video_model_types = json.load(f)
    return video_model_types[provider]["model_type"][model]

def _get_provider_options(provider:str) -> dict[str, dict[str, str]]:
    with open(os.path.join(os.path.dirname(__file__), "vid_generators", "config", "video_type.toml"), 'r') as f:
        provider_options = json.load(f)
    return provider_options[provider]["input_types"]


def _build_video_input_schema(provider, model) -> type[BaseModel]:
    """
    Build a Pydantic model named '<provider><model>InputSchema'.

    The `inputs` column is stored in DB as JSON text -> parse first.
    """
    try:
        video_type = _get_video_model_type(provider, model)
    except Exception:
        # fall back to empty model if bad schema
        raise TypeError("The model selected is not supported.")

    pydantic_model_name = f"{provider}{model}InputSchema"
    pydantic_options = _get_provider_options(provider)
    
    if type(video_type) != list and video_type != "i2v":
        # t2v, remove image in pydantic_options.keys()
        del pydantic_options["image"]
    # TODO:process to pydantic options


    fields: Dict[str, tuple] = {}
    for param in input_defs:
        name = param.get("name")
        if not name:
            continue
        py_t = _python_type(param.get("type"), param.get("default_value"))
        default_val = param.get("default_value")
        desc = param.get("description", "")
        is_required = param.get("required", False)

        if is_required:
            desc = f"Required. {desc}"
            fields[name] = (py_t, Field(description=desc))
        else:
            desc = f"Optional. {desc}"
            fields[name] = (
                Optional[py_t],
                Field(default=default_val, description=desc),
            )
    # add a tool_call_id - fix the field definition format
    fields["tool_call_id"] = (
        Annotated[str, InjectedToolCallId],
        Field(description="Tool call identifier"),
    )

    model_name = f"{wf['name'].title().replace(' ', '')}InputSchema"
    return create_model(model_name, __base__=BaseModel, **fields)
