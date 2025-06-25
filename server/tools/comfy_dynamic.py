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

import asyncio
import json
from typing import Annotated, Any, Dict, List

from pydantic import BaseModel, Field, create_model
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.runnables import RunnableConfig

from services.db_service import db_service

# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #


def _python_type(param_type: str, default: Any):
    """Map simple param types to Python types."""
    if param_type == "number":
        # choose int vs float based on default value presence
        if isinstance(default, int):
            return int
        return float
    if param_type == "boolean":
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
        fields[name] = (
            py_t,
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
        Forward the call to db_service.run_comfy_workflow and
        return its JSON-serialised response.
        """
        ctx = dict(config.get("configurable", {}))
        ctx["tool_call_id"] = tool_call_id
        result = await db_service.run_comfy_workflow(
            workflow_id=wf["id"],
            inputs=kwargs,
            ctx=ctx,
        )
        # LangChain tools must return string-serialisable values.
        return json.dumps(result, ensure_ascii=False)

    return _run


# --------------------------------------------------------------------------- #
# registration
# --------------------------------------------------------------------------- #

DYNAMIC_COMFY_TOOLS: Dict = {}  # populated at runtime

DYNAMIC_COMFY_TOOLS_DESCRIPTIONS: list = []

async def _register_all():
    """
    Fetch all workflows from DB and build tool callables.
    Run inside the current event loop.
    """
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
    Schedule _register_all() in the current (or newly created) event loop.
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
        loop.create_task(_register_all())
    else:
        # For synchronous contexts (e.g. CLI startup), run until complete
        loop.run_until_complete(_register_all())


# trigger registration at import
_ensure_async_registration()
