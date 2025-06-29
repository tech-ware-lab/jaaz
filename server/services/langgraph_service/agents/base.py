from typing import Annotated, List, Optional
from langgraph.types import Command
from langgraph.prebuilt import InjectedState
from langchain_core.messages import ToolMessage
from langchain_core.tools import BaseTool, InjectedToolCallId, tool
from langgraph_swarm.handoff import _normalize_agent_name, METADATA_KEY_HANDOFF_DESTINATION


def create_handoff_tool(
    *, agent_name: str, name: str | None = None, description: str | None = None
) -> BaseTool:
    """Create a tool that can handoff control to the requested agent.

    Args:
        agent_name: The name of the agent to handoff control to, i.e.
            the name of the agent node in the multi-agent graph.
            Agent names should be simple, clear and unique, preferably in snake_case,
            although you are only limited to the names accepted by LangGraph
            nodes as well as the tool names accepted by LLM providers
            (the tool name will look like this: `transfer_to_<agent_name>`).
        name: Optional name of the tool to use for the handoff.
            If not provided, the tool name will be `transfer_to_<agent_name>`.
        description: Optional description for the handoff tool.
            If not provided, the tool description will be `Ask agent <agent_name> for help`.
    """
    if name is None:
        name = f"transfer_to_{_normalize_agent_name(agent_name)}"

    if description is None:
        description = f"Ask agent '{agent_name}' for help"

    @tool(name, description=description+"""
    \nIMPORTANT RULES:
            1. You MUST complete the other tool calls and wait for their result BEFORE attempting to transfer to another agent
            2. Do NOT call this handoff tool with other tools simultaneously
            3. Always wait for the result of other tool calls before making this handoff call
    """)
    def handoff_to_agent(
        state: Annotated[dict, InjectedState],
        tool_call_id: Annotated[str, InjectedToolCallId],
    ):
        tool_message = ToolMessage(
            content=f"<hide_in_user_ui> Successfully transferred to {agent_name}",
            name=name,
            tool_call_id=tool_call_id,
        )
        return Command(
            goto=agent_name,
            graph=Command.PARENT,
            update={"messages": state["messages"] +
                    [tool_message], "active_agent": agent_name},
        )

    handoff_to_agent.metadata = {METADATA_KEY_HANDOFF_DESTINATION: agent_name}
    return handoff_to_agent


class BaseAgent:
    """智能体基类"""

    def __init__(self, name: str, tools: List, system_prompt: str, handoffs: Optional[List] = None):
        self.name = name
        self.tools = tools
        self.system_prompt = system_prompt
        self.handoffs = handoffs or []

    def get_config(self):
        """获取智能体配置"""
        return {
            'name': self.name,
            'tools': self.tools,
            'system_prompt': self.system_prompt,
            'handoffs': self.handoffs
        }
