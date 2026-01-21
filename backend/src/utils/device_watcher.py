"""
iOS Device Watcher - Cross-platform device change detection.

This module periodically checks for connected iOS devices and broadcasts
SSE updates only when the device list changes. Works on Linux, macOS, and Windows.
"""

import asyncio
import logging
from typing import Optional, Set

from utils.helpers import get_connected_devices, broadcast_event

logger = logging.getLogger(__name__)

# Configuration
POLL_INTERVAL_SECONDS = 2.5  # Check every 2.5 seconds

# Global state
_watcher_task: Optional[asyncio.Task] = None
_previous_udids: Set[str] = set()


async def _run_device_watcher():
    """
    Background coroutine that monitors for iOS device state changes.
    Only broadcasts SSE events when devices are added or removed.
    """
    global _previous_udids
    
    logger.info(f"Device watcher started (poll interval: {POLL_INTERVAL_SECONDS}s)")
    
    # Initial device fetch
    try:
        initial_devices = await get_connected_devices()
        _previous_udids = {d.get('udid', '') for d in initial_devices if d.get('udid')}
        logger.info(f"Initial device state: {len(_previous_udids)} device(s)")
    except Exception as e:
        logger.error(f"Failed to get initial device list: {e}")
        _previous_udids = set()
    
    while True:
        try:
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            
            # Get current devices
            current_devices = await get_connected_devices()
            current_udids = {d.get('udid', '') for d in current_devices if d.get('udid')}
            
            # Check for changes
            if current_udids != _previous_udids:
                added = current_udids - _previous_udids
                removed = _previous_udids - current_udids
                
                if added:
                    logger.info(f"Device(s) connected: {added}")
                if removed:
                    logger.info(f"Device(s) disconnected: {removed}")
                
                # Update state
                _previous_udids = current_udids
                
                # Broadcast the full device list to all SSE clients
                await broadcast_event("device_update", current_devices)
                logger.debug(f"Broadcasted device_update: {len(current_devices)} device(s)")
                
        except asyncio.CancelledError:
            logger.info("Device watcher cancelled")
            raise
        except Exception as e:
            logger.error(f"Device watcher error: {e}")
            # Continue running despite errors
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def start_device_watcher():
    """Start the device watcher background task."""
    global _watcher_task
    
    if _watcher_task is not None and not _watcher_task.done():
        logger.warning("Device watcher already running")
        return
    
    _watcher_task = asyncio.create_task(_run_device_watcher())
    logger.info("Device watcher background task created")


async def stop_device_watcher():
    """Stop the device watcher background task."""
    global _watcher_task
    
    if _watcher_task is not None:
        _watcher_task.cancel()
        try:
            await _watcher_task
        except asyncio.CancelledError:
            pass
        _watcher_task = None
        logger.info("Device watcher stopped")

