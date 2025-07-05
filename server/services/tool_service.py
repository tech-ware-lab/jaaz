import traceback
from typing import Dict
from langchain_core.tools import BaseTool
from models.tool_model import ToolInfo
from tools.comfy_dynamic import build_tool
from tools.write_plan import write_plan_tool
from tools.generate_image_by_gpt_image_1 import generate_image_by_gpt_image_1
from tools.generate_image_by_imagen_4 import generate_image_by_imagen_4
from tools.generate_image_by_recraft_v3 import generate_image_by_recraft_v3
# from tools.generate_image_by_flux_1_1_pro import generate_image_by_flux_1_1_pro
from tools.generate_image_by_flux_kontext_pro import generate_image_by_flux_kontext_pro
from tools.generate_image_by_flux_kontext_max import generate_image_by_flux_kontext_max
from tools.generate_image_by_doubao_seedream_3 import generate_image_by_doubao_seedream_3
from tools.generate_video_by_seedance_v1 import generate_video_by_seedance_v1
from services.config_service import config_service
from services.db_service import db_service

TOOL_MAPPING: Dict[str, ToolInfo] = {
    "generate_image_by_gpt_image_1_jaaz": {
        "display_name": "GPT Image 1",
        "type": "image",
        "provider": "jaaz",
        "tool_function": generate_image_by_gpt_image_1,
    },
    "generate_image_by_imagen_4_jaaz": {
        "display_name": "Imagen 4",
        "type": "image",
        "provider": "jaaz",
        "tool_function": generate_image_by_imagen_4,
    },
    "generate_image_by_recraft_v3_jaaz": {
        "display_name": "Recraft v3",
        "type": "image",
        "provider": "jaaz",
        "tool_function": generate_image_by_recraft_v3,
    },
    # "generate_image_by_flux_1_1_pro_jaaz": {
    #     "display_name": "Flux 1.1 Pro",
    #     "type": "image",
    #     "provider": "jaaz",
    #     "tool_function": generate_image_by_flux_1_1_pro,
    # },
    "generate_image_by_flux_kontext_pro_jaaz": {
        "display_name": "Flux Kontext Pro",
        "type": "image",
        "provider": "jaaz",
        "tool_function": generate_image_by_flux_kontext_pro,
    },
    "generate_image_by_flux_kontext_max_jaaz": {
        "display_name": "Flux Kontext Max",
        "type": "image",
        "provider": "jaaz",
        "tool_function": generate_image_by_flux_kontext_max,
    },
    "generate_image_by_doubao_seedream_3_jaaz": {
        "display_name": "Doubao Seedream 3",
        "type": "image",
        "provider": "jaaz",
        "tool_function": generate_image_by_doubao_seedream_3,
    },
    "generate_video_by_seedance_v1_jaaz": {
        "display_name": "Doubao Seedance v1",
        "type": "video",
        "provider": "jaaz",
        "tool_function": generate_video_by_seedance_v1,
    },
}

class ToolService:
    def __init__(self):
        self.tools: Dict[str, ToolInfo] = {}
        self._register_required_tools()

    def _register_required_tools(self):
        """注册必须的工具"""
        try:
            self.tools['write_plan'] = {
                'provider': 'system',
                'tool_function': write_plan_tool,
            }
        except ImportError as e:
            print(f"❌ 注册必须工具失败 write_plan: {e}")

    def register_tool(self, tool_id: str, tool_info: ToolInfo):
        """注册单个工具"""
        if tool_id in self.tools:
            print(f"🔄 TOOL ALREADY REGISTERED: {tool_id}")
            return

        self.tools[tool_id] = tool_info

    # TODO: Check if there will be racing conditions when server just starting up but tools are not ready yet.
    async def initialize(self):
        self.clear_tools()
        try:
            for provider_name, provider_config in config_service.app_config.items():
                # register all tools by api provider with api key
                if provider_config.get('api_key', ''):
                    for tool_id, tool_info in TOOL_MAPPING.items():
                        if tool_info.get('provider') == provider_name:
                            self.register_tool(tool_id, tool_info)
            # Register comfyui workflow tools
            if config_service.app_config.get('comfyui', {}).get('url', ''):
                await register_comfy_tools()
        except Exception as e:
            print(f"❌ Failed to initialize tool service: {e}")
            traceback.print_stack()

    def get_tool(self, tool_name: str) -> BaseTool | None:
        tool_info = self.tools.get(tool_name)
        return tool_info.get('tool_function') if tool_info else None
    
    def remove_tool(self, tool_id: str):
        self.tools.pop(tool_id)

    def get_all_tools(self) -> Dict[str, ToolInfo]:
        return self.tools.copy()

    def clear_tools(self):
        self.tools.clear()
        # 重新注册必须的工具
        self._register_required_tools()

tool_service = ToolService()


async def register_comfy_tools() -> Dict[str, BaseTool]:
    """
    Fetch all workflows from DB and build tool callables.
    Run inside the current event loop.
    """
    dynamic_comfy_tools: Dict[str, BaseTool] = {}
    try:
        workflows = await db_service.list_comfy_workflows()
    except Exception as exc:  # pragma: no cover
        print("[comfy_dynamic] Failed to list comfy workflows:", exc)
        traceback.print_stack()
        return {}

    for wf in workflows:
        try:
            tool_fn = build_tool(wf)
            # Export with a unique python identifier so that `dir(module)` works
            unique_name = f"comfyui_{wf['name']}"
            dynamic_comfy_tools[unique_name] = tool_fn
            tool_service.register_tool(unique_name, {
                'provider': 'comfyui',
                'tool_function': tool_fn,
                'display_name': wf['name'],
            })
        except Exception as exc:  # pragma: no cover
            print(
                f"[comfy_dynamic] Failed to create tool for workflow {wf.get('id')}: {exc}"
            )
            print(traceback.print_stack())

    return dynamic_comfy_tools

