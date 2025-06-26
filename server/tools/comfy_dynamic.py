"""
Dynamic registration of ComfyUI workflows as LangChain tools.

Importing this module will:
1. Query the local database for all stored ComfyUI workflows.
2. For each workflow, generate:
   • A Pydantic input schema reflecting its `inputs` definition.
   • An async LangChain `@tool` function that forwards the call to
     `db_service.run_comfy_workflow(...)`.
3. Expose all generated tool callables in `DYNAMIC_COMFY_TOOLS`
   so the agent can do:

       from server.tools.comfy_dynamic import DYNAMIC_COMFY_TOOLS
       tools = [..., *DYNAMIC_COMFY_TOOLS]

If `run_comfy_workflow` is not yet implemented it will still work
(actually return a stub dict) so callers won’t crash.
"""
from __future__ import annotations

import os
import random
import traceback
from io import BytesIO
import asyncio
import json
import time
from typing import Annotated, Any, Dict, List, Optional

from pydantic import BaseModel, Field, create_model
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.runnables import RunnableConfig
from routers.comfyui_execution import upload_image
from services.config_service import config_service, FILES_DIR
from .img_generators import ComfyUIWorkflowRunner

from common import DEFAULT_PORT
from services.db_service import db_service
from services.websocket_service import send_to_websocket, broadcast_session_update
from .image_generators import generate_file_id, generate_new_image_element


def _python_type(param_type: str, default: Any):
    """Map simple param types to Python types."""
    if param_type == "number":
        # choose int vs float based on default value presence
        if isinstance(default, int):
            return int
        return float
    if param_type == "boolean" or param_type == "bool":
        return bool
    # Treat unknown / string / image / file / path all as str
    return str


def _build_input_schema(wf: Dict[str, Any]) -> type[BaseModel]:
    """
    Build a Pydantic model named '<WorkflowName>Input' from workflow['inputs'].
    The `inputs` column is stored in DB as JSON text -> parse first.
    """
    try:
        input_defs: List[Dict[str, Any]] = (
            wf["inputs"] if isinstance(wf["inputs"], list) else json.loads(wf["inputs"])
        )
    except Exception:
        # fall back to empty model if bad schema
        input_defs = []

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
    # add a tool_call_id
    fields['tool_call_id'] = (
        Annotated[str, InjectedToolCallId]
    )

    model_name = f"{wf['name'].title().replace(' ', '')}InputSchema"
    return create_model(model_name, __base__=BaseModel, **fields)


def _build_tool(wf: Dict[str, Any]):
    """Return an @tool function for the given workflow record."""
    InputSchema = _build_input_schema(wf)

    @tool(
        wf["name"],
        description=wf.get("description") or f"Run ComfyUI workflow {wf['id']}",
        args_schema=InputSchema,
    )
    async def _run(
        config: RunnableConfig,
        tool_call_id: Annotated[str, InjectedToolCallId],
        **kwargs,
    ) -> str:
        """
        code to call comfyui generating image.
        """
        print('🛠️ tool_call_id', tool_call_id)
        ctx = config.get('configurable', {})
        canvas_id = ctx.get('canvas_id', '')
        session_id = ctx.get('session_id', '')
        print('🛠️canvas_id', canvas_id, 'session_id', session_id)
        # Inject the tool call id into the context
        ctx['tool_call_id'] = tool_call_id
        api_url = (
            config_service.app_config.get("comfyui", {})
            .get("url", "")
            .replace("http://", "")
            .replace("https://", "")
        )
        host, port = map(str, api_url.split(":"))

        # if there's image, upload it!
        # First, let's fliter all values endswith .jpg .png etc
        image_format = (
            ".png", ".jpg", ".jpeg", ".webp",  # 基础格式
            ".bmp", ".tiff", ".tif"   # 其他常见格式
        )
        required_data = dict(kwargs)
        for key, value in required_data.items():
            if isinstance(value, str) and value.lower().endswith(image_format):
                # Image!
                image_path = os.path.join(FILES_DIR, value)
                if not os.path.exists(image_path):
                    continue
                with open(image_path, "rb") as image_file:
                    image_bytes = image_file.read()
                image_stream = BytesIO(image_bytes)
                image_name = await upload_image(image_stream, host, port)
                required_data[key] = image_name

        workflow_dict = await db_service.get_comfy_workflow(wf["id"])

        try:
            input_defs: List[Dict[str, Any]] = (
                wf["inputs"] if isinstance(wf["inputs"], list) else json.loads(wf["inputs"])
            )
        except Exception:
            input_defs = []

        for param in input_defs:
            param_name = param.get("name")
            node_id = param.get("node_id")
            node_input_name = param.get("node_input_name")

            if not (param_name and node_id and node_input_name):
                continue

            if param_name in required_data:
                value = required_data[param_name]
                if node_id in workflow_dict:
                    node_inputs = workflow_dict[node_id].get("inputs", {})
                    if node_input_name in node_inputs:
                        node_inputs[node_input_name] = value

        # Process seed if has seed
        if 'seed' in str(required_data):
            # index the node which has seed
            seed_nodes = [] # If the workflow has multi KSampler Nodes
            for node_id, node in workflow_dict.items():
                if 'seed' in node.get('inputs', {}):
                    seed_nodes.append(node_id)
                    break

            for node_id in seed_nodes:
                workflow_dict[node_id]['inputs']['seed'] = random.randint(1, 2 ** 32)

        try:
            generator = ComfyUIWorkflowRunner(workflow_dict)
            extra_kwargs = {}
            extra_kwargs['ctx'] = ctx

            mime_type, width, height, filename = await generator.generate(
                **extra_kwargs
            )
            file_id = generate_file_id()

            url = f'/api/file/{filename}'

            file_data = {
                'mimeType': mime_type,
                'id': file_id,
                'dataURL': url,
                'created': int(time.time() * 1000),
            }

            new_image_element = await generate_new_image_element(canvas_id, file_id, {
                'width': width,
                'height': height,
            })

            # update the canvas data, add the new image element
            canvas_data = await db_service.get_canvas_data(canvas_id)
            if 'data' not in canvas_data:
                canvas_data['data'] = {}
            if 'elements' not in canvas_data['data']:
                canvas_data['data']['elements'] = []
            if 'files' not in canvas_data['data']:
                canvas_data['data']['files'] = {}

            canvas_data['data']['elements'].append(new_image_element)
            canvas_data['data']['files'][file_id] = file_data

            image_url = f"http://localhost:{DEFAULT_PORT}/api/file/{filename}"

            # print('🛠️canvas_data', canvas_data)

            await db_service.save_canvas_data(canvas_id, json.dumps(canvas_data['data']))

            await broadcast_session_update(session_id, canvas_id, {
                'type': 'image_generated',
                'element': new_image_element,
                'file': file_data,
                'image_url': image_url,
            })

            return f"image generated successfully ![image_id: {filename}]({image_url})"

        except Exception as e:
            print(f"Error generating image: {str(e)}") 
            traceback.print_exc()
            await send_to_websocket(session_id, {
                'type': 'error',
                'error': str(e)
            })
            return f"image generation failed: {str(e)}"


    return _run


# --------------------------------------------------------------------------- #
# registration
# --------------------------------------------------------------------------- #

DYNAMIC_COMFY_TOOLS: Dict = {}  # populated at runtime

DYNAMIC_COMFY_TOOLS_DESCRIPTIONS: list = []

async def register_comfy_tools():
    """
    Fetch all workflows from DB and build tool callables.
    Run inside the current event loop.
    """
    DYNAMIC_COMFY_TOOLS.clear()
    DYNAMIC_COMFY_TOOLS_DESCRIPTIONS.clear()
    try:
        workflows = await db_service.list_comfy_workflows()
    except Exception as exc:  # pragma: no cover
        print("[comfy_dynamic] Failed to list comfy workflows:", exc)
        return

    for wf in workflows:
        try:
            tool_fn = _build_tool(wf)
            # Export with a unique python identifier so that `dir(module)` works
            unique_name = f"comfyui_tool_{wf['id']}_{wf['name']}"
            DYNAMIC_COMFY_TOOLS[unique_name] = tool_fn
            DYNAMIC_COMFY_TOOLS_DESCRIPTIONS.append({
                'name': wf['name'],
                'description': wf.get('description') or f"Run ComfyUI workflow {wf['id']}",
                'tool': unique_name
            })
            print('🛠️', tool_fn.args_schema.model_json_schema())
        except Exception as exc:  # pragma: no cover
            print(f"[comfy_dynamic] Failed to create tool for workflow {wf.get('id')}: {exc}")


def _ensure_async_registration():
    """
    Schedule register_comfy_tools() in the current (or newly created) event loop.
    Top-level awaits are not allowed in import time, so we create a task.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        # No loop yet; create one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    # if loop already running, just create a task
    if loop.is_running():
        loop.create_task(register_comfy_tools())
    else:
        # For synchronous contexts (e.g. CLI startup), run until complete
        loop.run_until_complete(register_comfy_tools())


# trigger registration at import
_ensure_async_registration()
