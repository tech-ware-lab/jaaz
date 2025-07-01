from typing import List, Dict, Any, Optional
from langgraph.prebuilt import create_react_agent  # type: ignore
from langchain_core.tools import BaseTool

from .configs import PlannerAgentConfig, ImageDesignerAgentConfig, VideoDesignerAgentConfig, create_handoff_tool
from services.tool_service import tool_service


class AgentManager:
    """智能体管理器 - 负责创建和管理所有智能体

    此类负责协调智能体配置的获取和实际 LangGraph 智能体的创建。
    """

    @staticmethod
    def create_agents(
        model: Any,
        tool_name: str,
        system_prompt: str = ""
    ) -> List[Any]:
        """创建所有智能体

        Args:
            model: 语言模型实例
            tool_name: 图像生成工具名称
            system_prompt: 系统提示词

        Returns:
            List[Any]: 创建好的智能体列表
        """
        planner_config = PlannerAgentConfig().get_config()
        planner_agent = AgentManager._create_langgraph_agent(
            model, planner_config)

        image_designer_config = ImageDesignerAgentConfig(
            tool_name, system_prompt).get_config()
        image_designer_agent = AgentManager._create_langgraph_agent(
            model, image_designer_config)

        video_designer_config = VideoDesignerAgentConfig(
            "generate_video", system_prompt).get_config()
        video_designer_agent = AgentManager._create_langgraph_agent(
            model, video_designer_config)

        return [planner_agent, image_designer_agent, video_designer_agent]

    @staticmethod
    def _create_langgraph_agent(
        model: Any,
        config: Dict[str, Any]
    ) -> Any:
        """根据配置创建单个 LangGraph 智能体

        Args:
            model: 语言模型实例
            config: 智能体配置字典

        Returns:
            Any: 创建好的 LangGraph 智能体实例
        """
        # 创建智能体间切换工具
        handoff_tools: List[BaseTool] = []
        for handoff in config.get('handoffs', []):
            handoff_tool = create_handoff_tool(
                agent_name=handoff['agent_name'],
                description=handoff['description'],
            )
            if handoff_tool:
                handoff_tools.append(handoff_tool)

        # 获取业务工具
        business_tools: List[BaseTool] = []
        for tool_json in config.get('tools', []):
            tool = tool_service.get_tool(tool_json.get('tool', ''))
            if tool:
                business_tools.append(tool)

        # 创建并返回 LangGraph 智能体
        return create_react_agent(
            name=config.get('name'),
            model=model,
            tools=[*business_tools, *handoff_tools],
            prompt=config.get('system_prompt', '')
        )

    @staticmethod
    def get_last_active_agent(
        messages: List[Dict[str, Any]],
        agent_names: List[str]
    ) -> Optional[str]:
        """获取最后活跃的智能体

        Args:
            messages: 消息历史
            agent_names: 智能体名称列表

        Returns:
            Optional[str]: 最后活跃的智能体名称，如果没有则返回 None
        """
        for message in reversed(messages):
            if message.get('role') == 'assistant':
                message_name = message.get('name')
                if message_name and message_name in agent_names:
                    return message_name
        return None
