import asyncio
import logging
import state
from utils import get_connected_devices, broadcast_event

logger = logging.getLogger(__name__)

async def monitor_devices_task():
    """Background task to monitor connected devices"""
    logger.info("Starting device monitor...")
    
    while True:
        try:
            new_devices = await get_connected_devices()
            
            # Check if anything changed
            if new_devices != state.current_devices:
                
                # Log only if the count changed (to avoid spamming logs for battery updates)
                current_ids = set(d["id"] for d in state.current_devices)
                new_ids = set(d["id"] for d in new_devices)
                
                if current_ids != new_ids:
                    logger.info(f"Devices changed: {len(new_devices)} connected")
                
                # Update state
                state.current_devices = new_devices
                
                # Broadcast new state to all clients
                await broadcast_event("device_update", state.current_devices)
            
        except Exception as e:
            logger.error(f"Error in device monitor: {e}")
            
        await asyncio.sleep(2)
