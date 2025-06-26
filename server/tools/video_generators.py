from abc import ABC, abstractmethod
from typing import Tuple, Optional
import base64
import os
import asyncio
import traceback
from nanoid import generate
import aiofiles
from services.config_service import config_service, FILES_DIR
from utils.http_client import HttpClient
import fal_client


class VideoGenerator(ABC):
    """Abstract base class for video generators"""

    @abstractmethod
    async def generate_video(
        self,
        prompt: str,
        image_url: str,
        duration: str = "6",
        **kwargs
    ) -> Tuple[str, str, int]:
        """
        Generate a video and return metadata
        
        Args:
            prompt: Text prompt for video generation
            image_url: Input image URL for image-to-video generation
            duration: Video duration in seconds (e.g., "6", "10")
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Tuple of (mime_type, filename, duration_seconds)
        """
        pass


async def download_and_save_video(video_url: str, file_path: str) -> Tuple[str, str]:
    """Download video from URL and save to local file"""
    async with HttpClient.create() as client:
        response = await client.get(video_url)
        video_content = response.content
    
    # Save the video file
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(video_content)
    
    print(f'🎬 Video saved to {file_path}')
    
    # Return mime type and filename
    filename = os.path.basename(file_path)
    return 'video/mp4', filename


def generate_video_id():
    """Generate unique video ID"""
    return 'vid_' + generate(size=8)


class FalAIVideoGenerator(VideoGenerator):
    """Fal AI video generator implementation"""

    def __init__(self):
        """Initialize Fal AI video generator"""
        self.client = fal_client
        self.base_url = "https://fal.run/"
        
    def _get_api_key(self):
        """Get API key from configuration"""
        return config_service.app_config.get('fal', {}).get('api_key', '')

    async def generate_video(
        self,
        prompt: str,
        image_url: str,
        duration: str = "6",
        **kwargs
    ) -> Tuple[str, str, int]:
        """Generate video using Fal AI Hailuo model"""
        
        try:
            api_key = self._get_api_key()
            if not api_key:
                raise Exception("Fal AI API key not configured")
            
            # Set environment variable for fal_client
            os.environ['FAL_KEY'] = api_key
            
            # Prepare arguments for Hailuo model
            arguments = {
                "prompt": prompt,
                "image_url": image_url,
                "duration": duration,
                "prompt_optimizer": kwargs.get('prompt_optimizer', True),
            }
            
            # Make API call
            endpoint = "fal-ai/minimax/hailuo-02/standard/image-to-video"
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.subscribe(endpoint, arguments=arguments)
            )
            
            # Extract video URL from response
            if 'video' not in result or 'url' not in result['video']:
                raise Exception("No video URL in response")
            
            video_url = result['video']['url']
            video_id = generate_video_id()
            
            # Download and save video
            file_path = os.path.join(FILES_DIR, f'{video_id}.mp4')
            mime_type, filename = await download_and_save_video(video_url, file_path)
            
            return mime_type, filename, int(duration)
            
        except Exception as e:
            print(f"Fal AI video generation error: {str(e)}")
            traceback.print_exc()
            raise Exception(f"Video generation failed: {str(e)}")


# Initialize video provider instances
VIDEO_PROVIDERS = {
    'fal': FalAIVideoGenerator(),
}