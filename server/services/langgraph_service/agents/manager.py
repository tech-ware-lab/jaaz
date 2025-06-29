from typing import List, Dict, Any, Optional
from langgraph.prebuilt import create_react_agent  # type: ignore
from langchain_core.tools import BaseTool
from .planner import PlannerAgent
from .image_designer import ImageDesignerAgent
from .base import create_handoff_tool
from services.tool_service import tool_service


class AgentManager:
    """智能体管理器 - 负责创建和管理所有智能体"""

    @staticmethod
    def create_agents(model: Any, tool_name: str, system_prompt: str = "") -> List[Any]:
        """创建所有智能体

        Args:
            model: 语言模型实例
            tool_name: 图像生成工具名称
            system_prompt: 系统提示词

        Returns:
            List[Any]: 创建好的智能体列表
        """
        # 创建智能体实例
        planner = PlannerAgent()
        image_designer = ImageDesignerAgent(tool_name, system_prompt)

        agent_configs = [planner.get_config(), image_designer.get_config()]

        # 创建实际的 LangGraph agents
        agents: List[Any] = []
        for config in agent_configs:
            # 创建切换工具
            handoff_tools: List[Any] = []
            for handoff in config.get('handoffs', []):
                hf = create_handoff_tool(
                    agent_name=handoff['agent_name'],
                    description=handoff['description'],
                )
                if hf:
                    handoff_tools.append(hf)

            # 获取业务工具
            tools: List[BaseTool] = []
            for tool_json in config.get('tools', []):
                tool = tool_service.get_tool(tool_json.get('tool', ''))
                if tool:
                    tools.append(tool)

            # 创建智能体
            agent = create_react_agent(
                name=config.get('name'),
                model=model,
                tools=[*tools, *handoff_tools],
                prompt=config.get('system_prompt', '')
            )
            agents.append(agent)

        return agents

    @staticmethod
    def get_last_active_agent(messages: List[Dict[str, Any]], agent_names: List[str]) -> Optional[str]:
        """获取最后活跃的智能体

        Args:
            messages: 消息历史
            agent_names: 智能体名称列表

        Returns:
            Optional[str]: 最后活跃的智能体名称，如果没有则返回 None
        """
        for message in messages[::-1]:
            if message.get('role') == 'assistant':
                message_name = message.get('name')
                if message_name and message_name in agent_names:
                    return message_name
        return None
