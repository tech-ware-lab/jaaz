import asyncio
import json
import os
from pathlib import Path
import traceback
from fastapi import APIRouter, Request, WebSocket, Query, HTTPException
from fastapi.responses import FileResponse
import asyncio
from localmanus.services.agent_service import llm
from localmanus.services.mcp import MCPClient
from itertools import chain

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
    except Exception as e:
        print(f"WebSocket error: {e}")
        traceback.print_exc()
    finally:
        if session_id in active_websockets:
            del active_websockets[session_id]


router = APIRouter(prefix="/api")
@router.post("/chat")
async def chat(request: Request):
    data = await request.json()
    messages = data.get('messages')
    session_id = data.get('session_id')
    if session_id is None:
        raise HTTPException(
            status_code=400,  # Bad Request
            detail="session_id is required"
        )
    
    # Create a copy of the list to avoid modification during iteration
    websockets_to_remove = []
    
    stream = await llm.client.messages.create(
        max_tokens=1024,
        messages=messages,
        model="claude-3-5-sonnet-latest",
        tools=list(chain.from_iterable(mcp_client.tools for mcp_client in mcp_clients.values())),
        stream=True,
    )
    final_message = ''
    async for event in stream:
        print(event)
        if hasattr(event, 'delta') and hasattr(event.delta, 'text'):
            text = event.delta.text
            final_message += text
            # Send text to all active WebSocket connections
            ws = active_websockets.get(session_id)
            if ws:
                try:
                    await ws.send_text(text)
                except Exception as e:
                    print(f"Error sending to websocket: {e}")
                    websockets_to_remove.append(ws)
        for ws in websockets_to_remove:
            del active_websockets[ws]
    print('final_message', final_message)
    return {"status": "completed", "messages": messages.append(final_message)}

    
    # try:
    #     message = await stream.get_final_message()
    #     final_message = message.to_json()
    #     final_content = []
    #     # handle tool_use content type
    #     for c in final_message.content:
    #         if c.type == 'text':
    #             final_content.append(c)
    #         elif c.type == 'tool_use':
    #             tool_name = c.name
    #             tool_args = c.input
    #             final_content.append(c)
    #             result = await mcp_clients[tool_name].session.call_tool(tool_name, tool_args)
    #             final_content.append({
    #                 'type': 'tool_result',
    #                 # 'tool_use_id': tool.id,
    #                 'content': result.content
    #             })
    #     final_message.content = final_content
    #     return {"status": "completed", "messages": messages.append(message)}
    # except Exception as e:
    #     traceback.print_exc()
    #     print('final message', message)
    #     return {"status": "completed", "messages": messages}

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
async def initialize_mcp():
    print('👇initializing mcp')
    mcp_config_path = os.path.join(USER_DATA_DIR, "mcp.json")
    if not os.path.exists(mcp_config_path):
        return {}
    with open(mcp_config_path, "r") as f:
        json_data = json.load(f)
    global mcp_clients
    global mcp_clients_status
    mcp_clients = json_data.get('mcpServers', {})
    
    for server_name, server in list(mcp_clients.items()):
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
