from .config_service import config_service
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from ollama import Client

llm_config = config_service.get_config()
print('llm_config', llm_config)


class OpenAILLM:
    tools: list[dict] = []
    max_tokens: int = llm_config.get("openai", {}).get("max_tokens", 6140)
    client: AsyncOpenAI =  AsyncOpenAI(
        api_key=llm_config.get("openai", {}).get("api_key", ""),
    )

class AnthropicLLM:
    tools: list[dict] = []
    max_tokens: int = llm_config.get("anthropic", {}).get("max_tokens", 6140)
    client: AsyncAnthropic = AsyncAnthropic(
        api_key=llm_config.get("anthropic", {}).get("api_key", ""),
    )

class OllamaLLM:
    tools: list[dict] = []
    max_tokens: int = llm_config.get("ollama", {}).get("max_tokens", 6140)
    # client: AsyncOpenAI = AsyncOpenAI(
    #     base_url = llm_config.get("ollama", {}).get("url", "http://localhost:11434").rstrip('/') + '/v1',
    #     api_key='ollama', # required, but unused
    # )
    client: Client = Client(
        host='http://localhost:11434', 
    )
    
openai_client = OpenAILLM()
anthropic_client = AnthropicLLM()
ollama_client = OllamaLLM()

def llm_reload_clients():
    global llm_config
    # refresh llm_config value
    llm_config = config_service.get_config()
    global openai_client
    global anthropic_client
    global ollama_client
    openai_client = OpenAILLM()
    anthropic_client = AnthropicLLM()
    ollama_client = OllamaLLM()

# class AgentService:
#     def __init__(self):
#         self.cancel_event = asyncio.Event()
#         self.reload_agent()

#     def reload_agent(self):
#         self.agent = Manus()
#         self.agent.max_steps = 10
#         original_think = self.agent.think
#         async def new_think():
#             if self.cancel_event.is_set():
#                 raise Exception("Cancel event set")
#                 # return False
#             return await original_think()
#         self.agent.think = new_think

#     async def run_prompt(self, prompt_text: str):
#         self.cancel_event.clear()
#         self.agent.memory.messages = []
#         await self.agent.run(prompt_text)
#         return {"success": True}
        
#     async def get_state_data(self):
#         return {
#             'agent_state': self.agent.state,
#             'messages': [message.to_dict() for message in self.agent.memory.messages] if self.agent.memory.messages else [],
#             'current_step': self.agent.current_step,
#             'max_steps': self.agent.max_steps,
#             'total_tokens': self.agent.llm.total_input_tokens + self.agent.llm.total_completion_tokens,
#         }     

# agent_service = AgentService()
