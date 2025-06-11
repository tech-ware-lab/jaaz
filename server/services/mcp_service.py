# services/mcp_service.py

import os
import json
import traceback
from services.agent_service import openai_client, anthropic_client, ollama_client
from services.mcp import MCPClient
from services.config_service import USER_DATA_DIR

#全局状态
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
            print('👇mcp_client connected', server_name,
                  'tools', len(mcp_client.tools))
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

def get_mcp_servers():
    if mcp_clients is None:
        return {}
    mcp_config_path = os.path.join(USER_DATA_DIR, "mcp.json")
    if not os.path.exists(mcp_config_path):
        return {}
    with open(mcp_config_path, "r") as f:
        json_data = json.load(f)
    mcp_servers = json_data.get('mcpServers', {})
    for server_name, server in mcp_servers.items():
        mcp_servers[server_name]['tools'] = mcp_clients_status[server_name].get(
            'tools', [])
        mcp_servers[server_name]['status'] = mcp_clients_status[server_name].get(
            'status', 'error')
    return mcp_servers
