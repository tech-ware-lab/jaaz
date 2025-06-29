from typing import Optional, List, Dict, Any, cast
from models.config_model import ModelInfo
from services.db_service import db_service
from services.config_service import config_service
from services.websocket_service import send_to_websocket  # type: ignore
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langgraph_swarm import create_swarm  # type: ignore
from utils.http_client import HttpClient

import traceback

from .agents import AgentManager
from .handlers import StreamProcessor


async def langgraph_multi_agent(
    messages: List[Dict[str, Any]],
    canvas_id: str,
    session_id: str,
    text_model: ModelInfo,
    image_model: ModelInfo,
    system_prompt: Optional[str] = None
) -> None:
    """多智能体处理函数

    Args:
        messages: 消息历史
        canvas_id: 画布ID
        session_id: 会话ID
        text_model: 文本模型配置
        image_model: 图像模型配置
        system_prompt: 系统提示词
    """
    try:
        # 1. 模型配置
        model = _create_model(text_model)
        tool_name = _determine_tool_name(
            image_model, text_model.get('provider'))

        # 2. 创建智能体
        agents = AgentManager.create_agents(
            model, tool_name, system_prompt or "")
        agent_names = ['planner', 'image_designer']
        last_agent = AgentManager.get_last_active_agent(messages, agent_names)

        print('👇last_agent', last_agent)

        # 3. 创建智能体群组
        swarm = create_swarm(
            agents=agents,
            default_active_agent=last_agent if last_agent else agent_names[0]
        ).compile()  # type: ignore

        # 4. 创建上下文
        context = _create_context(canvas_id, session_id, image_model)

        # 5. 流处理
        processor = StreamProcessor(
            session_id, db_service, send_to_websocket)  # type: ignore
        await processor.process_stream(swarm, messages, context)

    except Exception as e:
        await _handle_error(e, session_id)


def _create_model(text_model: ModelInfo):
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
            api_key=api_key, # type: ignore
            timeout=15,
            base_url=url,
            temperature=0,
            # max_tokens=max_tokens, # TODO: 暂时注释掉有问题的参数
            http_client=http_client,
            http_async_client=http_async_client
        )


def _determine_tool_name(image_model: ModelInfo, provider: str) -> str:
    """确定图像生成工具名称"""
    image_model_name = image_model.get('model', '')
    tool_name = 'generate_image'

    is_jaaz_gpt_model = image_model_name.startswith(
        'openai') and provider == 'jaaz'
    if is_jaaz_gpt_model:
        tool_name = 'generate_image_by_gpt'
    if image_model.get('type') == 'tool':
        tool_name = image_model.get('model')

    return tool_name


def _create_context(canvas_id: str, session_id: str, image_model: ModelInfo) -> Dict[str, Any]:
    """创建上下文信息"""
    return {
        'canvas_id': canvas_id,
        'session_id': session_id,
        'model_info': {
            'image': image_model
        },
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
