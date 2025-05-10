import asyncio
import subprocess
import json
import os
from pathlib import Path
import traceback
from typing import Optional
from fastapi import APIRouter, Request, WebSocket, Query, HTTPException
from fastapi.responses import FileResponse
import asyncio
import aiohttp
from openai import AsyncOpenAI, OpenAI
import requests
from localmanus.services.agent_service import openai_client, anthropic_client, ollama_client
from localmanus.services.mcp import MCPClient
from itertools import chain
from localmanus.services.config_service import config_service, app_config
from starlette.websockets import WebSocketDisconnect
from ollama import ChatResponse

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

class ToolCall:
    def __init__(self, id: str, name: str, arguments: str):
        self.id = id
        self.name = name
        self.arguments = arguments

SYSTEM_TOOLS_MAPPING = {
    'finish': ""
}
SYSTEM_TOOLS = [
        {
            "type": "function",
            "function": {
                "name": "finish",
                "description": "You MUST call this tool when you think the task is finished or you think you can't do anything more. Otherwise, you will be continuously asked to do more about this task indefinitely. Calling this tool will end your turn on this task and hand it over to the user for further instructions.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "summary": {
                            "type": "string",
                            "description": "A optional summary of the task that you have finished. Or some note to inform the user about the task."
                        }
                    },
                    "required": [],
                },
            }
        }
    ]

async def chat_openai(messages: list, session_id: str, model: str, provider: str) -> list:
    await send_to_websocket(session_id, {
        'type': 'log',
        'messages': messages
    })
    payload = {
        "model": model,
        "messages": messages,
        "tools": SYSTEM_TOOLS + openai_client.tools,
        "stream": True
    }
    url = app_config.get(provider, {}).get("url", "")
    if provider == 'ollama':
        url = app_config.get('ollama', {}).get('url', os.getenv('OLLAMA_HOST', 'http://localhost:11434')).rstrip("/") + "/v1"
    url = url.rstrip("/") + "/chat/completions"
    print('start chat session', model, provider, url)
    try:
        async with aiohttp.ClientSession() as session:
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {app_config.get(provider, {}).get("api_key", "")}'
            }
            async with session.post(url, json=payload, headers=headers) as response:
                combine = ''
                cur_tool_calls:list[ToolCall] = []
                content_combine = ''
                async for line in response.content:
                    if line:
                        # Parse the JSON response
                        try:
                            # Decode bytes to string and strip whitespace
                            line_str = line.decode('utf-8').strip()
                            if not line_str:  # Skip empty lines
                                continue
                            print('👇raw line:', line_str)
                            # Handle SSE updates
                            if line_str.startswith('data: {'):
                                line_str = line_str[6:]  # Remove "data: " prefix
                                chunk = json.loads(line_str) # Parse the JSON
                                
                                # Extract content from the choices array
                                if 'choices' in chunk and len(chunk['choices']) > 0:
                                    delta = chunk['choices'][0].get('delta', {})
                                    # print('👇delta', delta)
                                    content = delta.get('content', '')
                                    # text delta
                                    if content:
                                        content_combine += content
                                        await send_to_websocket(session_id, {
                                            'type': 'delta',
                                            'text': content
                                        })
                                    # tool calls
                                    tool_calls = delta.get('tool_calls', [])
                                    for tool_call in tool_calls:
                                        tool_call_id = tool_call.get('id')
                                        tool_call_name = tool_call.get('function', {}).get('name')
                                        if tool_call_id and tool_call_name:
                                            # tool call start
                                            cur_tool_calls.append(ToolCall(tool_call_id, tool_call_name, ''))
                                            print('🦄tool_call', tool_call_id, tool_call_name)

                                            await send_to_websocket(session_id, {
                                                'type': 'tool_call',
                                                'id': tool_call_id,
                                                'name': tool_call_name
                                            })
                                        elif tool_call.get('function', {}).get('arguments', '') and len(cur_tool_calls) > 0:
                                            delta = tool_call.get('function', {}).get('arguments', '')
                                            cur_tool_calls[-1].arguments += delta
                                            await send_to_websocket(session_id, {
                                                'type': 'tool_call_arguments',
                                                'id': cur_tool_calls[-1].id,
                                                'text': delta # delta
                                            })
                                elif chunk.get('error'):
                                    raise Exception(chunk.get('error').get('message'))

                            # Handle [DONE] marker in SSE
                            elif line_str == 'data: [DONE]':
                                continue
                            else:
                                combine += line_str
                                

                        except Exception as e:
                            traceback.print_exc()
                print('👇combine', combine)
                print('👇content_combine', content_combine)
                if content_combine != '':
                    messages.append({
                        'role': 'assistant',
                        'content': [{
                            'type': 'text',
                            'text': content_combine
                        }]
                    })
                if len(cur_tool_calls) > 0:
                    for tool_call in cur_tool_calls:
                        # append tool call to messages of assistant
                        print('messages[-1]', messages[-1])
                        if messages[-1].get('tool_calls') is not None:
                            messages[-1]['tool_calls'].append({
                                'type': 'function',
                                'id': tool_call.id,
                                'function': {
                                    'name': tool_call.name,
                                    'arguments': tool_call.arguments
                                }
                            })
                        else:
                            messages.append({
                                'role': 'assistant',
                                'tool_calls': [{
                                'type': 'function',
                                'id': tool_call.id,
                                'function': {
                                    'name': tool_call.name,
                                    'arguments': tool_call.arguments
                                    }
                                }]
                            })
                        # tool call args complete, execute tool call
                        tool_result = await execute_tool(tool_call.id, tool_call.name, tool_call.arguments, session_id)
                        # append tool call result to messages of user
                        if tool_result is not None:
                            for r in tool_result:
                                messages.append(r)
                        await send_to_websocket(session_id, {
                            'type': 'all_messages',
                            'messages': messages
                        })
                # Has Error
                if combine != '':
                        data = None
                        try:
                            data = json.loads(combine)
                        except Exception as e:
                            pass
                        if data and data.get('error') and data.get('error').get('message'):
                            if data['error'].get('code') == 'rate_limit_error':
                                print('👇rate_limit_error, sleeping 10 seconds')
                                await send_to_websocket(session_id, {
                                    'type': 'info', 
                                    'info': f'Hit rate limit, waiting 10 seconds before continue. {data.get("error").get("message")} Please wait for 10 seconds...'
                                })
                                await asyncio.sleep(10)
                            else:
                                raise Exception(data.get('error').get('message'))
                        else:
                            # alert info
                            await send_to_websocket(session_id, {
                                'type': 'info', 
                                'info': combine
                            })
                if messages[-1].get('role') == 'assistant' and messages[-1].get('tool_calls') and messages[-1]['tool_calls'][-1].get('function', {}).get('name') == 'finish':
                    print('👇finish', messages[-1])
                else:
                    await chat_openai(messages, session_id, model, provider)
    except Exception as e:
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': str(e)
        })
    return messages

async def execute_tool(tool_call_id: str, tool_name: str, args_str: str, session_id: str):
    res = []
    try:
        if tool_name in SYSTEM_TOOLS_MAPPING:
            return res
        args_json = {}
        try:
            args_json = json.loads(args_str)
        except Exception as e:
            pass
        print('🦄executing tool', tool_name, args_json)
        mcp_client = mcp_tool_to_server_mapping[tool_name]
        if mcp_client.session is None:
            raise Exception(f"MCP client not found for tool {tool_name}")
        result = await mcp_client.session.call_tool(tool_name, args_json)
        content_dict = [content.model_dump() for content in result.content]
        await send_to_websocket(session_id, {
            'type': 'tool_call_result',
            'id': tool_call_id,
            'content': content_dict
        })

        text_contents = [c.text if c.type == 'text' else "Image result, view user attached image below for detailed result" if c.type == 'image' else json.dumps(c.model_dump()) for c in result.content ]
        text_contents = ''.join(text_contents)
        print('👇tool result text_content length', len(text_contents))
        if len(text_contents) > 8000:
            text_contents = text_contents[:8000] + "...Content truncated to 8000 characters due to length limit"

        res.append({
            'role': 'tool',
            'tool_call_id': tool_call_id,
            'content': text_contents # here only accept text string in anthropic, otherwise will throw error
        })
        for content in result.content:
            if content.type == 'image':
                res.append({
                    'role': 'user',
                    # 'is_tool': True,
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{content.data}",
                            },
                        },
                    ],
                })
        return res

    except Exception as e:
        print(f"Error calling tool {tool_name}: {e}")
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': f'Error calling tool {tool_name} with inputs {args_str} - {e}'
        })
    return res

async def chat_ollama(messages: list, session_id: str):
    print('👇chat_ollama', messages)
    url = ollama_client.url + "/v1/chat/completions"
    
    # Prepare the request payload
    payload = {
        "model": "qwen3:8b",
        "messages": messages,
        "tools": ollama_client.tools,
        "stream": True
    }
    try:
    
        async with aiohttp.ClientSession() as session:
            headers = {
                'Content-Type': 'application/json'
            }
            async with session.post(url, json=payload, headers=headers) as response:
                async for line in response.content:
                    if line:
                        # Parse the JSON response
                        try:
                            # Decode bytes to string and strip whitespace
                            line_str = line.decode('utf-8').strip()
                            if not line_str:  # Skip empty lines
                                continue
                                
                            print('👇raw line:', line_str)
                            
                            # Handle SSE format (remove the "data: " prefix)
                            if line_str.startswith('data: '):
                                line_str = line_str[6:]  # Remove "data: " prefix
                                
                            # Handle [DONE] marker in SSE
                            if line_str == '[DONE]':
                                continue
                                
                            # Parse the JSON
                            chunk = json.loads(line_str)
                            print('👇chunk', chunk)
                            
                            # Extract content from the choices array
                            if 'choices' in chunk and len(chunk['choices']) > 0:
                                delta = chunk['choices'][0].get('delta', {})
                                content = delta.get('content', '')
                                if content:
                                    await send_to_websocket(session_id, {
                                        'type': 'delta',
                                        'text': content
                                    })
                        except Exception as e:
                            print(f"Error parsing JSON: {e}")
    except Exception as e:
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': str(e)
        })

async def chat_anthropic(messages: list, session_id: str):
    # Create a copy of the list to avoid modification during iteration
    websockets_to_remove = []
    try:
        stream = await anthropic_client.client.messages.create(
            max_tokens=llm_config.get("anthropic", {}).get("max_tokens", 6140),
            messages=messages,
            model="claude-3-7-sonnet-latest",
            tools=anthropic_client.tools,
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
    provider = data.get('provider')
    model = data.get('model')
    if model is None:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail="model is required"
        )
    if provider is None:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail="provider is required"
        )
    if session_id is None:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail="session_id is required"
        )
    await chat_openai(messages, session_id, model, provider)

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

def get_ollama_model_list():
    base_url = config_service.get_config().get('ollama', {}).get('url', os.getenv('OLLAMA_HOST', 'http://localhost:11434'))
    try:
        response = requests.get(f'{base_url}/api/tags', timeout=5)
        response.raise_for_status()
        data = response.json()
        return [model['name'] for model in data.get('models', [])]
    except requests.RequestException as e:
        print(f"Error querying Ollama: {e}")
        return []

@router.get("/list_models")
async def get_models():
    config = app_config
    res = []
    ollama_models = get_ollama_model_list()
    print('👇ollama_models', ollama_models)
    for ollama_model in ollama_models:
        res.append({
            'provider': 'ollama',
            'model': ollama_model,
        })
    for provider in config.keys():
        models = config[provider].get('models', [])
        if not models and provider == 'openai':
            res.append({
                'provider': provider,
                'model': 'gpt-4o'
            })
        elif not models and provider == 'anthropic':    
            res.append({
                'provider': provider,
                'model': 'claude-3-7-sonnet-latest'
            })
        else:
            for model in models:
                res.append({
                    'provider': provider,
                    'model': model
                })
    return res

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
                print('tool', tool)
                openai_client.tools.append({
                    'type': 'function',
                    'function': {
                        'name': tool['name'],
                        'description': tool['description'],
                        'parameters': tool['input_schema']
                    }
                })
                anthropic_client.tools.append(tool)
                ollama_client.tools.append({
                    'type': 'function',
                    'function': {
                        'name': tool['name'],
                        'description': tool['description'],
                        'parameters': tool['input_schema']
                    }
                })

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
