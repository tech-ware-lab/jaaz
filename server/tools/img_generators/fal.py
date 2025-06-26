from typing import Optional, Tuple
import os
import asyncio
import traceback
from .base import ImageGenerator, get_image_info_and_save, generate_image_id
from services.config_service import config_service, FILES_DIR
import fal_client


class FalAIGenerator(ImageGenerator):
    """Fal AI image generator implementation"""

    def __init__(self):
        """Initialize Fal AI generator with configuration"""
        self.client = fal_client
        self.base_url = "https://fal.run/"
        
    def _get_api_key(self):
        """Get API key from configuration"""
        return config_service.app_config.get('fal', {}).get('api_key', '')
    
    def _get_size_from_aspect_ratio(self, aspect_ratio: str, model: str = ""):
        """Convert aspect ratio to Fal AI size format"""
        # High-resolution models (Pro Ultra, etc.)
        if 'ultra' in model.lower():
            aspect_map = {
                "1:1": "square_hd",      # 1024x1024
                "16:9": "landscape_16_9", # 1920x1080
                "9:16": "portrait_9_16",  # 1080x1920
                "4:3": "landscape_4_3",
                "3:4": "portrait_3_4"
            }
        else:
            # Standard resolution models
            aspect_map = {
                "1:1": "square_hd",
                "16:9": "landscape_16_9", 
                "9:16": "portrait_9_16",
                "4:3": "landscape_4_3",
                "3:4": "portrait_3_4"
            }
        return aspect_map.get(aspect_ratio, "square_hd")
    
    def _prepare_model_specific_args(self, model: str, **kwargs):
        """Prepare model-specific arguments"""
        args = {}
        
        # FLUX models support
        if 'flux' in model.lower():
            if 'num_inference_steps' in kwargs:
                args['num_inference_steps'] = kwargs['num_inference_steps']
            if 'guidance_scale' in kwargs:
                args['guidance_scale'] = kwargs['guidance_scale']
            if 'lora_path' in kwargs:
                args['lora_path'] = kwargs['lora_path']
                
        # Recraft V3 specific parameters
        elif 'recraft' in model.lower():
            if 'style' in kwargs:
                args['style'] = kwargs['style']
            if 'substyle' in kwargs:
                args['substyle'] = kwargs['substyle']
                
        return args

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image: Optional[str] = None,
        **kwargs
    ) -> Tuple[str, int, int, str]:
        """Generate image using Fal AI API"""
        
        try:
            api_key = self._get_api_key()
            if not api_key:
                raise Exception("Fal AI API key not configured")
            
            # Set environment variable for fal_client
            os.environ['FAL_KEY'] = api_key
            
            # Prepare base arguments
            arguments = {
                "prompt": prompt,
                "image_size": self._get_size_from_aspect_ratio(aspect_ratio, model),
            }
            
            # Add model-specific parameters
            model_args = self._prepare_model_specific_args(model, **kwargs)
            arguments.update(model_args)
            
            # Add input image if provided
            if input_image:
                arguments["image_url"] = input_image
            
            # Prepare endpoint - remove fal/ prefix if present
            model_clean = model.replace('fal/', '')
            endpoint = f"fal-ai/{model_clean}"
            
            # Make API call with asyncio executor to handle blocking call
            result = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: self.client.subscribe(endpoint, arguments=arguments)
            )
            
            # Process result - handle different response formats
            image_url = None
            if 'images' in result and result['images']:
                image_url = result['images'][0]['url']
            elif 'image' in result:
                image_url = result['image']['url']
            else:
                raise Exception("No image URL in response")
            
            # Download and save image
            image_id = generate_image_id()
            mime_type, width, height, extension = await get_image_info_and_save(
                image_url, 
                os.path.join(FILES_DIR, f'{image_id}')
            )
            
            filename = f'{image_id}.{extension}'
            return mime_type, width, height, filename
            
        except Exception as e:
            print(f"Fal AI generation error: {str(e)}")
            traceback.print_exc()
            raise Exception(f"Fal AI generation failed: {str(e)}")