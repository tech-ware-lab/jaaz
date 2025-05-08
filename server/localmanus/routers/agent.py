import asyncio
import json
import os
from pathlib import Path
import traceback
from fastapi import APIRouter, Request, WebSocket, Query, HTTPException
from fastapi.responses import FileResponse
import asyncio

from openai import AsyncOpenAI, OpenAI
from localmanus.services.agent_service import openai_client, anthropic_client, ollama_client
from localmanus.services.mcp import MCPClient
from itertools import chain
from localmanus.services.config_service import config_service
from starlette.websockets import WebSocketDisconnect

llm_config = config_service.get_config()

wsrouter = APIRouter()
active_websockets = {}  # Changed to dictionary to store session_id -> websocket mapping

@wsrouter.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session_id: str = Query(...)):
    await websocket.accept()
    active_websockets[session_id] = websocket
    try:
        # Keep the connection alive
        while True:
            # Wait for messages (optional, if you need to receive from client)
            data = await websocket.receive_text()
            # Process the message if needed
    except WebSocketDisconnect as e:
        print(f"WebSocket disconnected: {e.code}, {e.reason}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        traceback.print_exc()
    finally:
        if session_id in active_websockets:
            del active_websockets[session_id]

async def chat_openai(messages: list[dict], session_id: str):
    stream = openai_client.responses.create(
            model="gpt-4o",
            input=messages,
            stream=True,
        )

    for event in stream:
        print(event)

async def chat_ollama(messages: list[dict], session_id: str):
    print('👇chat_ollama', messages)
    client = OpenAI(
        base_url = 'http://localhost:11434/v1',
        api_key='ollama', # required, but unused
    )

    response = client.chat.completions.create(
        model="qwen3:8b",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Who won the world series in 2020?"},
            {"role": "assistant", "content": "The LA Dodgers won in 2020."},
            {"role": "user", "content": "Where was it played?"}
        ],
        stream=True
    )
    for event in response:
        print(event)

async def chat_anthropic(messages: list[dict], session_id: str):
    # Create a copy of the list to avoid modification during iteration
    websockets_to_remove = []
    try:
        stream = await anthropic_client.messages.create(
            max_tokens=llm_config.get("anthropic", {}).get("max_tokens", 6140),
            messages=messages,
            model="claude-3-7-sonnet-latest",
            tools=list(chain.from_iterable(mcp_client.tools for mcp_client in mcp_clients.values())),
            stream=True,
        )
        final_content = []
        cur_block = {}
        content_block_text = ''
        # cur_block_dict = None # 'text', 'tool_use'
        async for event in stream:
            print(event)
            if event.type == 'content_block_start' and event.content_block:
                cur_block = event.content_block.dict()
                print('cur_block', cur_block)
                content_block_text = ''
            if hasattr(event, 'delta') and hasattr(event.delta, 'text'):
                text = event.delta.text
                content_block_text += text
                # Send text to current ws session
                ws = active_websockets.get(session_id)
                if ws:
                    try:
                        await ws.send_text(json.dumps({
                            'type': 'delta',
                            'delta': text
                        }))
                    except Exception as e:
                        print(f"Error sending to websocket: {e}")
                        websockets_to_remove.append(ws)
            if hasattr(event, 'delta') and hasattr(event.delta, 'partial_json'):
                content_block_text += event.delta.partial_json
            if event.type == 'content_block_stop':
                print('👇✋cur_block', cur_block)
                if cur_block.get('type') == 'text':
                    cur_block['text'] = content_block_text
                    if cur_block.get('citations') is None:
                        del cur_block['citations']
                    final_content.append(cur_block)
                # tool use type
                elif cur_block.get('type') == 'tool_use':
                    print('🔨tool use content_block_text', content_block_text)
                    cur_block['input'] = json.loads(content_block_text)
                    tool_name = cur_block['name']
                    tool_args = cur_block['input']
                    final_content.append(cur_block)
                    await send_to_websocket(session_id, cur_block)
                    try:
                        mcp_client = mcp_tool_to_server_mapping[tool_name]
                        result = await mcp_client.session.call_tool(tool_name, tool_args)
                        
                        await send_to_websocket(session_id, {
                            'type': 'text',
                            'text': f'👇tool result {result.content}'
                        })
                    except Exception as e:
                        print(f"Error calling tool {tool_name}: {e}")
                        traceback.print_exc()
                        await send_to_websocket(session_id, {
                            'type': 'error',
                            'error': str(e)
                        })
                content_block_text = ''
                final_content.append(cur_block)
            for ws in websockets_to_remove:
                del active_websockets[ws]
        print('final_content', final_content)
        return {"status": "1", "message": {
            'role': 'assistant',
            'content': final_content
        }}
    except Exception as e:
        traceback.print_exc()
        error_message = f"An unexpected error occurred: {str(e)}"
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': error_message
        })
        
        raise HTTPException(
            status_code=500,
            detail=error_message
        )
router = APIRouter(prefix="/api")
@router.post("/chat")
async def chat(request: Request):
    data = await request.json()
    messages = data.get('messages')
    session_id = data.get('session_id')
    provider = data.get('provider', 'ollama')
    if session_id is None:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail="session_id is required"
        )
    if provider == 'openai':
        await chat_openai(messages, session_id)
    elif provider == 'anthropic':
        await chat_anthropic(messages, session_id)
    elif provider == 'ollama':
        await chat_ollama(messages, session_id)
    


async def send_to_websocket(session_id: str, event:dict):
    ws = active_websockets.get(session_id)
    if ws:
        try:
            await ws.send_text(json.dumps(event))
        except Exception as e:
            print(f"Error sending to websocket: {e}")
            traceback.print_exc()
# @router.get("/cancel")
# async def cancel():
#     agent_service.cancel_event.set()
#     return "Cancel event set"

# @router.get("/workspace_list")
# async def workspace_list():
#     return [{"name": entry.name, "is_dir": entry.is_dir(), "path": str(entry)} for entry in Path(WORKSPACE_ROOT).iterdir()]

@router.get("/workspace_download")
async def workspace_download(path: str):
    file_path = Path(path)
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    return {"error": "File not found"}

USER_DATA_DIR = os.getenv("USER_DATA_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "user_data"))

mcp_clients: dict[str, MCPClient] = {}
mcp_clients_status = {}
mcp_tool_to_server_mapping: dict[str, MCPClient] = {}
async def initialize_mcp():
    print('👇initializing mcp')
    mcp_config_path = os.path.join(USER_DATA_DIR, "mcp.json")
    if not os.path.exists(mcp_config_path):
        return {}
    with open(mcp_config_path, "r") as f:
        json_data = json.load(f)
    global mcp_clients
    global mcp_clients_status
    global mcp_tool_to_server_mapping
    mcp_clients_json: dict[str, dict] = json_data.get('mcpServers', {})
    
    for server_name, server in list(mcp_clients_json.items()):
        if server.get('command') is None:
            continue
        if server.get('args') is None:
            server['args'] = []
        
        mcp_client = MCPClient()
        mcp_clients_status[server_name] = {
            'status': 'initializing'
        }
        try:
            await mcp_client.connect_to_server(server["command"], server["args"], server.get('env'))
            mcp_clients_status[server_name] = {
                'status': 'connected',
                'tools': mcp_client.tools
            }
            print('👇mcp_client connected', server_name, 'tools', len(mcp_client.tools))
            for tool in mcp_client.tools:
                mcp_tool_to_server_mapping[tool['name']] = mcp_client
            mcp_clients[server_name] = mcp_client
        except Exception as e:
            print(f"Error connecting to MCP server {server_name}: {e}")
            traceback.print_exc()
            mcp_clients_status[server_name] = {
                'status': 'error',
                'error': str(e)
            }

@router.get("/list_mcp_servers")
async def list_mcp_servers():
    if mcp_clients is None:
        return {}
    mcp_config_path = os.path.join(USER_DATA_DIR, "mcpServers.json")
    if not os.path.exists(mcp_config_path):
        return {}
    with open(mcp_config_path, "r") as f:
        json_data = json.load(f)
    mcp_servers = json_data.get('mcpServers', {})
    for server_name, server in mcp_servers.items():
        mcp_servers[server_name]['tools'] = mcp_clients_status[server_name].get('tools', [])
        mcp_servers[server_name]['status'] = mcp_clients_status[server_name].get('status', 'error')
    return mcp_servers
