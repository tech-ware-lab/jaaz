from typing import Dict, List, Tuple, Optional
from langchain_core.tools import BaseTool
from models.config_model import ModelInfo
from tools.write_plan import write_plan_tool


class ToolService:
    def __init__(self):
        self.tools: Dict[str, BaseTool] = {}
        self._register_required_tools()
        # model_name -> tool_name mapping
        self._registered_models: Dict[str, str] = {}

    def _register_required_tools(self):
        """注册必须的工具"""
        try:
            self.tools['write_plan'] = write_plan_tool
        except ImportError as e:
            print(f"❌ 注册必须工具失败 write_plan: {e}")

    def register_tool(self, tool_name: str, tool_function: BaseTool):
        """注册单个工具"""
        if tool_name in self.tools:
            # 跳过已注册的工具
            return

        self.tools[tool_name] = tool_function

    def register_tools_from_models(self, model_list: List[ModelInfo]) -> List[str]:
        """根据模型列表动态注册工具

        Args:
            model_list: 模型信息列表

        Returns:
            已注册的工具名称列表
        """
        registered_tools: List[str] = []

        for model in model_list:
            model_name = model.get('model', '')
            model_type = model.get('type', '')

            if not model_name:
                continue

            # 如果已经注册过这个模型，跳过
            if model_name in self._registered_models:
                registered_tools.append(self._registered_models[model_name])
                continue

            tool_result = self._import_tool_for_model(model_name, model_type)
            if tool_result:
                tool_name, tool_function = tool_result
                try:
                    self.register_tool(tool_name, tool_function)
                    self._registered_models[model_name] = tool_name
                    registered_tools.append(tool_name)
                    print(f"✅ 已注册工具: {tool_name} for model: {model_name}")
                except Exception as e:
                    print(f"❌ 注册工具失败 {tool_name} for model {model_name}: {e}")

        return registered_tools

    def _import_tool_for_model(self, model_name: str, model_type: str) -> Optional[Tuple[str, BaseTool]]:
        """根据模型名称和类型直接导入工具实例

        Args:
            model_name: 模型名称
            model_type: 模型类型

        Returns:
            (tool_name, tool_instance) 的元组，如果无法导入则返回 None
        """
        try:
            # 工具类型直接使用模型名称作为工具名称
            if model_type == 'tool':
                # TODO: 需要根据具体的工具模型名称实现动态导入
                print(f"⚠️ 工具类型模型暂未实现: {model_name}")
                return None

            # 图像模型的工具导入
            if model_type == 'image':
                if 'gpt-image-1' in model_name:
                    from tools.generate_image_by_gpt_image_1 import generate_image_by_gpt_image_1
                    return ('generate_image_by_gpt_image_1', generate_image_by_gpt_image_1)
                elif 'imagen-4' in model_name:
                    from tools.generate_image_by_imagen_4 import generate_image_by_imagen_4
                    return ('generate_image_by_imagen_4', generate_image_by_imagen_4)

            # 视频模型的工具导入
            if model_type == 'video':
                if 'doubao-seedance-1-0-pro' in model_name:
                    from tools.vid_generators.seedance_v1 import generate_video_doubao_seedance_1_0_pro
                    return ('generate_video_doubao_seedance_1_0_pro', generate_video_doubao_seedance_1_0_pro)

            print(
                f"⚠️ 未找到对应的工具: model_name={model_name}, model_type={model_type}")
            return None

        except ImportError as e:
            print(f"❌ 导入工具失败 for model {model_name}: {e}")
            return None

    def get_tool(self, tool_name: str) -> BaseTool | None:
        """获取已注册的工具"""
        return self.tools.get(tool_name)

    def get_all_tools(self) -> Dict[str, BaseTool]:
        """获取所有已注册的工具"""
        return self.tools.copy()

    def clear_tools(self):
        """清空所有已注册的工具"""
        self.tools.clear()
        self._registered_models.clear()
        # 重新注册必须的工具
        self._register_required_tools()


tool_service = ToolService()
