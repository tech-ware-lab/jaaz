from .base import BaseAgent


class ImageDesignerAgent(BaseAgent):
    """图像设计智能体 - 专门负责图像生成"""

    def __init__(self, tool_name: str, system_prompt: str = ""):
        tools = [{'tool': tool_name}]

        error_handling_prompt = """

ERROR HANDLING INSTRUCTIONS:
When image generation fails, you MUST:
1. Acknowledge the failure and explain the specific reason to the user
2. If the error mentions "sensitive content" or "flagged content", advise the user to:
   - Use more appropriate and less sensitive descriptions
   - Avoid potentially controversial, violent, or inappropriate content
   - Try rephrasing with more neutral language
3. If it's an API error (HTTP 500, etc.), suggest:
   - Trying again in a moment
   - Using different wording in the prompt
   - Checking if the service is temporarily unavailable
4. Always provide helpful suggestions for alternative approaches
5. Maintain a supportive and professional tone

IMPORTANT: Never ignore tool errors. Always respond to failed tool calls with helpful guidance for the user.
"""

        full_system_prompt = system_prompt + error_handling_prompt

        super().__init__(
            name='image_designer',
            tools=tools,
            system_prompt=full_system_prompt,
            handoffs=[]  # 图像设计智能体不需要切换到其他智能体
        )
