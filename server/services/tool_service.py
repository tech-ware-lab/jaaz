from typing import Dict
from langchain_core.tools import BaseTool
from tools.generate_image_by_gpt import generate_image_by_gpt
from tools.image_generators import generate_image
from tools.write_plan import write_plan_tool
from tools.vid_generators.generate_video_seedance_v1 import generate_video_seedance_v1


class ToolService:
    def __init__(self):
        self.tools: Dict[str, BaseTool] = {
            'generate_image': generate_image,
            'generate_image_by_gpt': generate_image_by_gpt,
            'write_plan': write_plan_tool,
            'generate_video_seedance_v1': generate_video_seedance_v1,
        }

    def register_tool(self, tool_name: str, tool_function: BaseTool):
        if tool_name in self.tools:
            raise ValueError(
                f"Tool {tool_name} already registered, please use a unique name")
        self.tools[tool_name] = tool_function

    def get_tool(self, tool_name: str) -> BaseTool | None:
        return self.tools.get(tool_name)


tool_service = ToolService()
