from typing import List, Dict, Any
from .base_config import BaseAgentConfig, ToolConfig


class ImageDesignerAgentConfig(BaseAgentConfig):
    """图像设计智能体 - 专门负责图像生成
    """

    def __init__(self, tool_names: List[str], system_prompt: str = "") -> None:
        # 将工具名称列表转换为工具配置列表
        tools: List[ToolConfig] = [{'tool': tool_name}
                                   for tool_name in tool_names]

        batch_generation_prompt = """

BATCH GENERATION RULES:
- If user needs >10 images: Generate in batches of max 10 images each
- Complete each batch before starting next batch
- Example for 20 images: Batch 1 (1-10) → "Batch 1 done!" → Batch 2 (11-20) → "All 20 images completed!"

"""

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

        full_system_prompt = system_prompt + \
            batch_generation_prompt + error_handling_prompt

        # 图像设计智能体不需要切换到其他智能体
        handoffs: List[Dict[str, Any]] = [
            # {
            #     'agent_name': 'image_video_creator',
            #     'description': """
            #             Transfer user to the image_video_creator. About this agent: Coordinates image and video generation tasks efficiently.
            #             """
            # }
        ]

        super().__init__(
            name='image_designer',
            tools=tools,
            system_prompt=full_system_prompt,
            handoffs=handoffs
        )
