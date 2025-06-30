"""
langgraph_service.py

本模块封装了 langgraph_agent 异步函数，用于执行 LangGraph + LangChain 构建的 React 风格语言 Agent。
功能包括：
- 初始化对应的语言模型客户端（OpenAI / Ollama 等）
- 创建并运行带工具链的 React Agent
- 处理 Agent 流式返回结果（消息、工具调用、工具调用参数）
- 将更新通过 websocket 推送给前端
- 持久化聊天记录到数据库

依赖模块：
- langgraph, langchain_core, langchain_openai, langchain_ollama
- services.db_service
- services.config_service
- routers.websocket
- routers.image_tools
"""
from pydantic import BaseModel, Field
from models.config_model import ModelInfo
from services.tool_service import tool_service
from utils.http_client import HttpClient

import asyncio
import json
import traceback
from langchain_core.messages import AIMessageChunk, ToolCall, convert_to_openai_messages, ToolMessage
from langgraph.prebuilt import create_react_agent
from services.db_service import db_service
from services.config_service import config_service
from services.websocket_service import send_to_websocket
from tools.image_generators import generate_image
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langgraph_swarm import create_swarm
from langchain_core.tools import BaseTool, InjectedToolCallId, tool
from tools.generate_image_by_gpt import generate_image_by_gpt
from langchain_core.runnables import RunnableConfig

class InputParam(BaseModel):
    type: str
    description: str
    required: bool
    default: str

from langgraph_swarm.handoff import _normalize_agent_name, METADATA_KEY_HANDOFF_DESTINATION
from langchain_core.messages import ToolMessage
from langchain_core.tools import BaseTool, InjectedToolCallId, tool
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import InjectedState, ToolNode
from langgraph.types import Command
from typing import Annotated, List, Optional

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
            update={"messages": state["messages"] + [tool_message], "active_agent": agent_name},
        )

    handoff_to_agent.metadata = {METADATA_KEY_HANDOFF_DESTINATION: agent_name}
    return handoff_to_agent

async def langgraph_multi_agent(messages, canvas_id, session_id, text_model: ModelInfo, image_model: ModelInfo, system_prompt: Optional[str] = None):
    try:
        model = text_model.get('model')
        provider = text_model.get('provider')
        url = text_model.get('url')
        api_key = config_service.app_config.get(provider, {}).get("api_key", "")
        image_model_name = image_model.get('model', '')
        
        tool_name = 'generate_image'

        is_jaaz_gpt_model = image_model_name.startswith('openai') and provider == 'jaaz'
        if is_jaaz_gpt_model:
            tool_name = 'generate_image_by_gpt'
        if image_model.get('type') == 'tool':
            tool_name = image_model.get('model')

        # TODO: Verify if max token is working
        max_tokens = text_model.get('max_tokens', 8148)
        if provider == 'ollama':
            model = ChatOllama(
                model=model,
                base_url=url,
            )
        else:
            # Create httpx client with SSL configuration for ChatOpenAI
            http_client = HttpClient.create_sync_client(timeout=15)
            http_async_client = HttpClient.create_async_client(timeout=15)
            model = ChatOpenAI(
                model=model,
                api_key=api_key,
                timeout=15,
                base_url=url,
                temperature=0,
                max_tokens=max_tokens,
                http_client=http_client,
                http_async_client=http_async_client
            )
        agent_schemas = [
            {
                'name': 'planner',
                'tools': [
                    {
                    'name': 'write_plan',
                    'description': "Write a execution plan for the user's request",
                    'type': 'system',
                    'tool': 'write_plan',
                }
                ],
                'system_prompt': """
            You are a design planning writing agent. You should do:
            - Step 1. write a execution plan for the user's request using the same language as the user's prompt. You should breakdown the task into high level steps for the other agents to execute.
            - Step 2. If it is a image generation task, transfer the task to image_designer agent to generate the image based on the plan IMMEDIATELY, no need to ask for user's approval.

            IMPORTANT RULES:
            1. You MUST complete the write_plan tool call and wait for its result BEFORE attempting to transfer to another agent
            2. Do NOT call multiple tools simultaneously
            3. Always wait for the result of one tool call before making another

            For example, if the user ask to 'Generate a ads video for a lipstick product', the example plan is :
            ```
            [{
                "title": "Design the video script",
                "description": "Design the video script for the ads video"
            }, {
                "title": "Generate the images",
                "description": "Design image prompts, generate the images for the story board"
            }, {
                "title": "Generate the video clips",
                "description": "Generate the video clips from the images"
            }]
            ```
            """,
                'knowledge': [],
                'handoffs': [
                    {
                        'agent_name': 'image_designer',
                        'description': """
                        Transfer user to the image_designer. About this agent: Specialize in generating images.
                        """
                    }
                ]
            },
            {
                'name': 'image_designer',
                'tools': [
                    {
                        'tool': tool_name,
                    },
                    {
                        'tool': 'volces_generate_video',
                    }
                ],
                'system_prompt': system_prompt,
                'knowledge': [],
                'handoffs': []
            }
        ]
        agents = []
        for ag_schema in agent_schemas:
            handoff_tools = []
            for handoff in ag_schema.get('handoffs', []):
                hf = create_handoff_tool(
                    agent_name=handoff['agent_name'],
                    description=handoff['description'],
                )
                if hf:
                    handoff_tools.append(hf)
            tools: List[BaseTool] = []
            for tool_json in ag_schema.get('tools', []):
                tool = tool_service.get_tool(tool_json.get('tool', ''))
                if tool:
                    tools.append(tool)
            print('👇tools', tools)
            print('👇tools', handoff_tools)


            agent = create_react_agent(
                name=ag_schema.get('name'),
                model=model,
                tools=[*tools, *handoff_tools],
                prompt=ag_schema.get('system_prompt', '')
            )
            agents.append(agent)
        agent_names = [ag.get('name') for ag in agent_schemas]
        last_agent = None
        for message in messages[::-1]:
            if message.get('role') == 'assistant':
                if message.get('name') in agent_names:
                    last_agent = message.get('name')
                break
        print('👇last_agent', last_agent)
        swarm = create_swarm(
            agents=agents,
            default_active_agent=last_agent if last_agent else agent_schemas[0]['name']
        ).compile()

        # swarm = create_swarm(
        #     agents=agents,
        #     default_active_agent=agent_schemas[0]['name']
        # ).compile()

        ctx = {
            'canvas_id': canvas_id,
            'session_id': session_id,
            'model_info': {
                'image': image_model
            },
        }
        tool_calls: list[ToolCall] = []
        last_saved_message_index = len(messages) - 1

        async for chunk in swarm.astream(
            {"messages": messages},
            config=ctx,
            stream_mode=["messages", "custom", 'values']
        ):
            chunk_type = chunk[0]
            if chunk_type == 'values':
                all_messages = chunk[1].get('messages', [])
                oai_messages = convert_to_openai_messages(all_messages)
                await send_to_websocket(session_id, {
                        'type': 'all_messages',
                        'messages': oai_messages
                    })
                for i in range(last_saved_message_index + 1, len(oai_messages)):
                    new_message = oai_messages[i]
                    await db_service.create_message(session_id, new_message.get('role', 'user'), json.dumps(new_message)) if len(messages) > 0 else None
                    last_saved_message_index = i
            else:
                # Access the AIMessageChunk
                ai_message_chunk: AIMessageChunk = chunk[1][0]
                # print('👇ai_message_chunk', ai_message_chunk)
                content = ai_message_chunk.content  # Get the content from the AIMessageChunk
                if isinstance(ai_message_chunk, ToolMessage):
                    print('👇tool_call_results', ai_message_chunk.content)
                elif content:
                    await send_to_websocket(session_id, {
                        'type': 'delta',
                        'text': content
                    })
                elif hasattr(ai_message_chunk, 'tool_calls') and ai_message_chunk.tool_calls and ai_message_chunk.tool_calls[0].get('name'):
                    tool_calls = [tc for tc in ai_message_chunk.tool_calls if tc.get('name')]
                    print('😘tool_call event', ai_message_chunk.tool_calls)
                    for tool_call in tool_calls:
                        await send_to_websocket(session_id, {
                            'type': 'tool_call',
                            'id': tool_call.get('id'),
                            'name': tool_call.get('name'),
                            'arguments': '{}'
                        })
                elif hasattr(ai_message_chunk, 'tool_call_chunks'):
                    tool_call_chunks = ai_message_chunk.tool_call_chunks
                    for tool_call_chunk in tool_call_chunks:
                        index: int = tool_call_chunk['index']
                        if index < len(tool_calls):
                            for_tool_call: ToolCall = tool_calls[index]
                            # print('👇tool_call_arguments event', for_tool_call, 'chunk', tool_call_chunk)
                            await send_to_websocket(session_id, {
                                'type': 'tool_call_arguments',
                                'id': for_tool_call.get('id'),
                                'text': tool_call_chunk.get('args')
                            })
                else:
                    print('👇no tool_call_chunks', chunk)

        # 发送完成事件
        await send_to_websocket(session_id, {
            'type': 'done'
        })

    except Exception as e:
        print('Error in langgraph_agent', e)
        tb_str = traceback.format_exc()
        print(f"Full traceback:\n{tb_str}")
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': str(e)
        })
