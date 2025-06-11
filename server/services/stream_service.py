# services/stream_service.py

stream_tasks = {}

def add_stream_task(session_id, task):
    stream_tasks[session_id] = task

def remove_stream_task(session_id):
    stream_tasks.pop(session_id, None)

def get_stream_task(session_id):
    return stream_tasks.get(session_id)

# 你也可以加一个 list_stream_tasks() 返回所有 session_id
