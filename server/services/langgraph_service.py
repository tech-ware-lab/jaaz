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
from utils.ssl_config import create_aiohttp_session, create_httpx_client

import asyncio
import json
import traceback
from langchain_core.messages import AIMessageChunk, ToolCall, convert_to_openai_messages, ToolMessage
from langgraph.prebuilt import create_react_agent
from services.db_service import db_service
from services.config_service import config_service, app_config
from services.websocket_service import send_to_websocket

from routers.image_tools import generate_image_tool
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

async def langgraph_agent(messages, canvas_id, session_id, text_model, image_model):
    try:
        model = text_model.get('model')
        provider = text_model.get('provider')
        url = text_model.get('url')
        api_key = app_config.get(provider, {}).get("api_key", "")
        print('👇model', model, provider, url, api_key)
        # TODO: Verify if max token is working
        max_tokens = text_model.get('max_tokens', 8148)
        if provider == 'ollama':
            model = ChatOllama(
                model=model,
                base_url=url,
            )
        else:
            # Create httpx client with SSL configuration for ChatOpenAI
            http_client = create_httpx_client(timeout=15)
            model = ChatOpenAI(
                model=model,
                api_key=api_key,
                timeout=15,
                base_url=url,
                temperature=0,
                max_tokens=max_tokens,
                http_client=http_client
            )
        agent = create_react_agent(
            model=model,
            tools=[generate_image_tool],
            prompt='You are a profession design agent, specializing in visual design.'
        )
        ctx = {
            'canvas_id': canvas_id,
            'session_id': session_id,
            'model_info': {
                'image': image_model
            },
        }
        tool_calls: list[ToolCall] = []
        async for chunk in agent.astream(
            {"messages": messages},
            config=ctx,
            stream_mode=["updates", "messages", "custom"]
        ):
            chunk_type = chunk[0]

            if chunk_type == 'updates':
                all_messages = chunk[1].get(
                    'agent', chunk[1].get('tools')).get('messages', [])
                oai_messages = convert_to_openai_messages(all_messages)
                # new_message = oai_messages[-1]

                messages.extend(oai_messages)
                await send_to_websocket(session_id, {
                    'type': 'all_messages',
                    'messages': messages
                })
                for new_message in oai_messages:
                    await db_service.create_message(session_id, new_message.get('role', 'user'), json.dumps(new_message)) if len(messages) > 0 else None
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
                    for index, tool_call in enumerate(ai_message_chunk.tool_calls):
                        if tool_call.get('name'):
                            tool_calls.append(tool_call)
                            print('😘tool_call', tool_call, tool_call.get(
                                'name'), tool_call.get('id'))
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
                            await send_to_websocket(session_id, {
                                'type': 'tool_call_arguments',
                                'id': for_tool_call.get('id'),
                                'text': tool_call_chunk.get('args')
                            })
                else:
                    print('👇no tool_call_chunks', chunk)
    except Exception as e:
        print('Error in langgraph_agent', e)
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': str(e)
        })
