import asyncio
from localmanus.services.config_service import config_service
from anthropic import AsyncAnthropic

class LLMClient:
    def __init__(self):
        self.init_client()

    def init_client(self):
        config = config_service.get_config()
        self.client = AsyncAnthropic(
            api_key=config.get("anthropic", {}).get("api_key"), 
        )
        self.max_tokens = config.get("anthropic", {}).get("max_tokens", 6140)

    def reload_client(self):
        self.init_client()
    
llm = LLMClient()

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
