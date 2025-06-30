# from engineio import payload
from utils.http_client import HttpClient

import aiofiles

# import httpx
import mimetypes
from pymediainfo import MediaInfo


async def get_video_info_and_save(
    url: str, file_path_without_extension: str
) -> tuple[str, int, int, str]:
    # Fetch the video asynchronously
    async with HttpClient.create(url=None) as client:
        response = await client.get(url)
        video_content = response.content

    # Save to temporary mp4 file first
    temp_path = f"{file_path_without_extension}.mp4"
    async with aiofiles.open(temp_path, "wb") as out_file:
        await out_file.write(video_content)
    print("🎥 Video saved to", temp_path)

    try:
        media_info = MediaInfo.parse(temp_path)
        for track in media_info.tracks:  # type: ignore
            if track.track_type == "Video":
                width = track.width
                height = track.height
                print(f"Width: {width}, Height: {height}")

        extension = "mp4"  # 默认使用 mp4，实际情况可以根据 codec_name 灵活判断

        # Get mime type
        mime_type = mimetypes.types_map.get(".mp4", "video/mp4")

        print(
            f"🎥 Video info - width: {width}, height: {height}, mime_type: {mime_type}, extension: {extension}"
        )

        return mime_type, width, height, extension
    except Exception as e:
        print(f"Error probing video file {temp_path}: {str(e)}")
        raise e
