from typing import List, Dict, Any
from .base_config import BaseAgentConfig, ToolConfig


class ImageVideoCreatorAgentConfig(BaseAgentConfig):
    """图像视频创建智能体 - 专门负责协调图像和视频生成
    """

    def __init__(self, system_prompt: str = "") -> None:
        # 这个智能体不需要业务工具，只负责协调
        tools: List[ToolConfig] = []

        # 简洁的系统提示词，专注于快速决策
        coordination_prompt = """
You are a media creation coordinator. Your job is to quickly decide and delegate:

- For IMAGE requests: Transfer to image_designer immediately
- For VIDEO requests: Transfer to video_designer immediately  


Be fast and direct. No explanations needed.
"""

        full_system_prompt = system_prompt + coordination_prompt

        # 可以切换到图像和视频设计智能体
        handoffs: List[Dict[str, Any]] = [
            {
                'agent_name': 'image_designer',
                'description': """
                        Transfer user to the image_designer. About this agent: Specialize in generating and editing images.
                        """
            },
            {
                'agent_name': 'video_designer',
                'description': """
                        Transfer user to the video_designer. About this agent: Specialize in generating videos from text prompts or images.
                        """
            }
            
        ]

        super().__init__(
            name='image_video_creator',
            tools=tools,
            system_prompt=full_system_prompt,
            handoffs=handoffs
        )