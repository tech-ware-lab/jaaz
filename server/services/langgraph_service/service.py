from typing import Optional, List, Dict, Any, cast, Set
from models.config_model import ModelInfo
from services.db_service import db_service
from services.config_service import config_service
from services.websocket_service import send_to_websocket  # type: ignore
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langgraph_swarm import create_swarm  # type: ignore
from utils.http_client import HttpClient

import traceback

from .agent_manager import AgentManager
from .handlers import StreamProcessor


def _fix_chat_history(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """修复聊天历史中不完整的工具调用

    根据LangGraph文档建议，移除没有对应ToolMessage的tool_calls
    参考: https://langchain-ai.github.io/langgraph/troubleshooting/errors/INVALID_CHAT_HISTORY/
    """
    if not messages:
        return messages

    fixed_messages: List[Dict[str, Any]] = []
    tool_call_ids: Set[str] = set()

    # 第一遍：收集所有ToolMessage的tool_call_id
    for msg in messages:
        if msg.get('role') == 'tool' and msg.get('tool_call_id'):
            tool_call_id = msg.get('tool_call_id')
            if tool_call_id:
                tool_call_ids.add(tool_call_id)

    # 第二遍：修复AIMessage中的tool_calls
    for msg in messages:
        if msg.get('role') == 'assistant' and msg.get('tool_calls'):
            # 过滤掉没有对应ToolMessage的tool_calls
            valid_tool_calls: List[Dict[str, Any]] = []
            removed_calls: List[str] = []

            for tool_call in msg.get('tool_calls', []):
                tool_call_id = tool_call.get('id')
                if tool_call_id in tool_call_ids:
                    valid_tool_calls.append(tool_call)
                elif tool_call_id:
                    removed_calls.append(tool_call_id)

            # 记录修复信息
            if removed_calls:
                print(
                    f"🔧 修复消息历史：移除了 {len(removed_calls)} 个不完整的工具调用: {removed_calls}")

            # 更新消息
            if valid_tool_calls:
                msg_copy = msg.copy()
                msg_copy['tool_calls'] = valid_tool_calls
                fixed_messages.append(msg_copy)
            elif msg.get('content'):  # 如果没有有效的tool_calls但有content，保留消息
                msg_copy = msg.copy()
                msg_copy.pop('tool_calls', None)  # 移除空的tool_calls
                fixed_messages.append(msg_copy)
            # 如果既没有有效tool_calls也没有content，跳过这条消息
        else:
            # 非assistant消息或没有tool_calls的消息直接保留
            fixed_messages.append(msg)

    return fixed_messages


async def langgraph_multi_agent(
    messages: List[Dict[str, Any]],
    canvas_id: str,
    session_id: str,
    text_model: ModelInfo,
    media_model: ModelInfo,  # 更名为media_model，支持图像和视频模型
    system_prompt: Optional[str] = None
) -> None:
    """多智能体处理函数

    Args:
        messages: 消息历史
        canvas_id: 画布ID
        session_id: 会话ID
        text_model: 文本模型配置
        media_model: 媒体模型配置（图像或视频模型）
        system_prompt: 系统提示词
    """
    try:
        # 0. 修复消息历史
        fixed_messages = _fix_chat_history(messages)

        # 1. 模型配置
        model = _create_model(text_model)
        tool_name = _determine_tool_name(
            media_model, text_model.get('provider'))

        # 2. 创建智能体
        agents = AgentManager.create_agents(
            model, tool_name, system_prompt or "")
        agent_names = ['planner', 'image_video_creator',
                       'image_designer', 'video_designer']
        last_agent = AgentManager.get_last_active_agent(
            fixed_messages, agent_names)

        print('👇last_agent', last_agent)

        # 3. 创建智能体群组
        swarm = create_swarm(
            agents=agents,
            default_active_agent=last_agent if last_agent else agent_names[0]
        ).compile()  # type: ignore

        # 4. 创建上下文
        context = _create_context(canvas_id, session_id, media_model)

        # 5. 流处理
        processor = StreamProcessor(
            session_id, db_service, send_to_websocket)  # type: ignore
        await processor.process_stream(swarm, fixed_messages, context)

    except Exception as e:
        await _handle_error(e, session_id)


def _create_model(text_model: ModelInfo) -> Any:
    """创建语言模型实例"""
    model = text_model.get('model')
    provider = text_model.get('provider')
    url = text_model.get('url')
    api_key = config_service.app_config.get(  # type: ignore
        provider, {}).get("api_key", "")

    # TODO: Verify if max token is working
    # max_tokens = text_model.get('max_tokens', 8148)

    if provider == 'ollama':
        return ChatOllama(
            model=model,
            base_url=url,
        )
    else:
        # Create httpx client with SSL configuration for ChatOpenAI
        http_client = HttpClient.create_sync_client(timeout=15)
        http_async_client = HttpClient.create_async_client(timeout=15)
        return ChatOpenAI(
            model=model,
            api_key=api_key,  # type: ignore
            timeout=15,
            base_url=url,
            temperature=0,
            # max_tokens=max_tokens, # TODO: 暂时注释掉有问题的参数
            http_client=http_client,
            http_async_client=http_async_client
        )


def _determine_tool_name(media_model: ModelInfo, provider: str) -> str:
    """确定工具名称（支持图像和视频模型）"""
    model_name = media_model.get('model', '')
    model_type = media_model.get('type', '')

    # 视频模型工具选择
    if model_type == 'video':
        if model_name in ['doubao-seedance-1-0-pro-250528']:
            return 'generate_video_doubao_seedance_1_0_pro'
        # 其他视频模型可以在这里添加
        return 'generate_video'  # 默认视频工具

    # 图像模型工具选择（原有逻辑）
    tool_name = 'generate_image'
    is_jaaz_gpt_model = model_name.startswith('openai') and provider == 'jaaz'
    if is_jaaz_gpt_model:
        tool_name = 'generate_image_by_gpt'
    if media_model.get('type') == 'tool':
        tool_name = media_model.get('model')

    return tool_name


def _create_context(canvas_id: str, session_id: str, media_model: ModelInfo) -> Dict[str, Any]:
    """创建上下文信息"""
    model_info = {
        'image': media_model,  # 保持向后兼容，这里仍使用'image'键名
    }

    return {
        'canvas_id': canvas_id,
        'session_id': session_id,
        'model_info': model_info,
    }


async def _handle_error(error: Exception, session_id: str) -> None:
    """处理错误"""
    print('Error in langgraph_agent', error)
    tb_str = traceback.format_exc()
    print(f"Full traceback:\n{tb_str}")
    traceback.print_exc()

    await send_to_websocket(session_id, cast(Dict[str, Any], {
        'type': 'error',
        'error': str(error)
    }))
