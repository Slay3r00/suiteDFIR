import asyncio
import json
from typing import Any, AsyncGenerator, Optional
from fastapi.responses import StreamingResponse


# Standard SSE response headers
SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
}


async def create_task_sse_generator(
    task_id: Any,
    task_dict: dict,
    terminal_statuses: list[str],
    cleanup: bool = True
) -> AsyncGenerator[str, None]:
    """
    Create an SSE generator for task-based streams (backup, processing).
    
    Args:
        task_id: The task identifier
        task_dict: Dictionary containing task state (must have 'queue' and 'status' keys)
        terminal_statuses: List of status values that indicate task completion
        cleanup: Whether to delete task from dict on completion
    """
    if task_id not in task_dict:
        return
        
    queue = task_dict[task_id]["queue"]
    
    while True:
        if task_id not in task_dict:
            break
            
        current_status = task_dict[task_id].get("status")

        # Check if completed and queue is empty
        if current_status in terminal_statuses and queue.empty():
            yield f"event: close\ndata: Stream ended\n\n"
            break
            
        try:
            # Wait for message with timeout to check status periodically
            message = await asyncio.wait_for(queue.get(), timeout=1.0)
            yield f"data: {message}\n\n"
        except asyncio.TimeoutError:
            continue
        except Exception as e:
            yield f"data: Error reading log: {str(e)}\n\n"
            break
    
    # Cleanup if requested
    if cleanup and task_id in task_dict:
        await asyncio.sleep(0.5)  # Give client time to process close event
        if task_id in task_dict:
            del task_dict[task_id]


async def create_client_sse_generator(
    client_set: set[asyncio.Queue]
) -> AsyncGenerator[str, None]:
    """
    Create an SSE generator for continuous client event streams.
    
    Args:
        client_set: Set to register/unregister client queues
    """
    queue = asyncio.Queue()
    client_set.add(queue)
    
    try:
        while True:
            data = await queue.get()
            yield f"data: {data}\n\n"
    except asyncio.CancelledError:
        client_set.remove(queue)


def create_sse_response(generator: AsyncGenerator[str, None]) -> StreamingResponse:
    """Create a StreamingResponse with standard SSE configuration."""
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers=SSE_HEADERS
    )


def create_task_sse_response(
    task_id: Any,
    task_dict: dict,
    terminal_statuses: list[str],
    cleanup: bool = True
) -> StreamingResponse:
    """Combines generator creation and response for task-based streams."""
    generator = create_task_sse_generator(task_id, task_dict, terminal_statuses, cleanup)
    return create_sse_response(generator)


def create_client_sse_response(
    client_set: set[asyncio.Queue]
) -> StreamingResponse:
    """Combines client generator creation and response."""
    generator = create_client_sse_generator(client_set)
    return create_sse_response(generator)


async def wrapped_sse_generator(
    async_gen: AsyncGenerator[Any, None]
) -> AsyncGenerator[str, None]:
    """Wraps any async generator to format output as SSE data."""
    async for item in async_gen:
        if isinstance(item, (dict, list)):
            data = json.dumps(item)
        else:
            data = str(item)
        yield f"data: {data}\n\n"
