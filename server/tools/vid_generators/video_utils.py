import json
import time
import os
from typing import Dict, Any, Tuple
from services.config_service import FILES_DIR
from services.db_service import db_service
from services.websocket_service import send_to_websocket, broadcast_session_update
from tools.image_generation_utils import generate_new_video_element
from tools.video_generation_utils import generate_video_file_id, get_video_info_and_save
from common import DEFAULT_PORT


async def save_video_to_canvas(
    session_id: str,
    canvas_id: str,
    video_url: str
) -> Tuple[str, Dict[str, Any], Dict[str, Any]]:
    """
    Download video, save to files, create canvas element and return data

    Args:
        session_id: Session ID for notifications
        canvas_id: Canvas ID to add video element
        video_url: URL to download video from

    Returns:
        Tuple of (filename, file_data, new_video_element)
    """
    # Generate unique video ID
    video_id = generate_video_file_id()

    # Download and save video
    print(f"🎥 Downloading video from: {video_url}")
    mime_type, width, height, extension = await get_video_info_and_save(
        video_url, os.path.join(FILES_DIR, f"{video_id}")
    )
    filename = f"{video_id}.{extension}"

    print(f"🎥 Video saved as: {filename}, dimensions: {width}x{height}")

    # Create file data
    file_id = generate_video_file_id()
    file_url = f"/api/file/{filename}"

    file_data = {
        "mimeType": mime_type,
        "id": file_id,
        "dataURL": file_url,
        "created": int(time.time() * 1000),
    }

    # Create new video element for canvas
    new_video_element = await generate_new_video_element(
        canvas_id,
        file_id,
        {
            "width": width,
            "height": height,
        },
    )

    # Update canvas data
    canvas_data = await db_service.get_canvas_data(canvas_id)
    if canvas_data is None:
        canvas_data = {}
    if "data" not in canvas_data:
        canvas_data["data"] = {}
    if "elements" not in canvas_data["data"]:
        canvas_data["data"]["elements"] = []
    if "files" not in canvas_data["data"]:
        canvas_data["data"]["files"] = {}

    canvas_data["data"]["elements"].append(new_video_element)
    canvas_data["data"]["files"][file_id] = file_data

    # Save updated canvas data
    await db_service.save_canvas_data(canvas_id, json.dumps(canvas_data["data"]))

    return filename, file_data, new_video_element


async def send_video_start_notification(session_id: str, message: str):
    """Send WebSocket notification about video generation start"""
    await send_to_websocket(session_id, {
        "type": "video_generation_started",
        "message": message
    })


async def send_video_completion_notification(
    session_id: str,
    canvas_id: str,
    new_video_element: Dict[str, Any],
    file_data: Dict[str, Any],
    video_url: str
):
    """Send WebSocket notification about video generation completion"""
    await broadcast_session_update(
        session_id,
        canvas_id,
        {
            "type": "video_generated",
            "element": new_video_element,
            "file": file_data,
            "video_url": video_url,
        },
    )


async def send_video_error_notification(session_id: str, error_message: str):
    """Send WebSocket notification about video generation error"""
    print(f"🎥 Video generation error: {error_message}")
    await send_to_websocket(session_id, {
        "type": "error",
        "error": error_message
    })


def format_video_success_message(filename: str) -> str:
    """Format success message for video generation"""
    return f"video generated successfully ![video_id: {filename}](http://localhost:{DEFAULT_PORT}/api/file/{filename})"


async def process_video_result(
    video_url: str,
    session_id: str,
    canvas_id: str,
    provider_name: str = ""
) -> str:
    """
    Complete video processing pipeline: save, update canvas, notify

    Args:
        video_url: URL of the generated video
        session_id: Session ID for notifications
        canvas_id: Canvas ID to add video element
        provider_name: Name of the provider (for logging)

    Returns:
        Success message with video link
    """
    try:
        # Save video to canvas and get file info
        filename, file_data, new_video_element = await save_video_to_canvas(
            session_id=session_id,
            canvas_id=canvas_id,
            video_url=video_url
        )

        # Send completion notification
        await send_video_completion_notification(
            session_id=session_id,
            canvas_id=canvas_id,
            new_video_element=new_video_element,
            file_data=file_data,
            video_url=file_data["dataURL"]
        )

        provider_info = f" using {provider_name}" if provider_name else ""
        print(f"🎥 Video generation completed{provider_info}: {filename}")
        return format_video_success_message(filename)

    except Exception as e:
        error_message = str(e)
        await send_video_error_notification(session_id, error_message)
        raise e
