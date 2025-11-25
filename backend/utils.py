def get_size_format(b, factor=1024, suffix="B"):
    """Scale bytes to its proper format"""
    for unit in ["", "K", "M", "G", "T", "P", "E", "Z"]:
        if b < factor:
            return f"{b:.2f}{unit}{suffix}"
        b /= factor
    return f"{b:.2f}Y{suffix}"

import json
from state import event_clients

async def broadcast_event(event_type: str, data: dict):
    """Broadcast event to all connected clients"""
    if not event_clients:
        return
        
    message = json.dumps({"type": event_type, "data": data})
    disconnected_clients = set()
    
    for queue in event_clients:
        try:
            await queue.put(message)
        except Exception as e:
            print(f"DEBUG: Queue error: {e}")
            disconnected_clients.add(queue)
            
    for client in disconnected_clients:
        event_clients.remove(client)

import asyncio

async def get_device_details(udid: str):
    """Fetch detailed info for an iOS device asynchronously"""
    device_info = {
        "id": udid,
        "udid": udid,
        "name": "iOS Device",
        "type": "ios",
        "status": "online",
        "connection": "usb",
        "battery": 100,
        "is_encrypted": False
    }

    try:
        # Run ideviceinfo -x (XML) or simple key lookups
        # We'll do key lookups as they are simpler to parse without xmltodict
        
        # Get Device Name
        proc_name = await asyncio.create_subprocess_exec(
            "ideviceinfo", "-u", udid, "-k", "DeviceName",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout_name, _ = await proc_name.communicate()
        if proc_name.returncode == 0:
            device_info["name"] = stdout_name.decode().strip()

        # Get Product Type
        proc_type = await asyncio.create_subprocess_exec(
            "ideviceinfo", "-u", udid, "-k", "ProductType",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout_type, _ = await proc_type.communicate()
        if proc_type.returncode == 0:
            device_info["type"] = stdout_type.decode().strip()

        # Check Encryption (com.apple.mobile.backup Domain)
        proc_enc = await asyncio.create_subprocess_exec(
            "ideviceinfo", "-u", udid, "-q", "com.apple.mobile.backup",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout_enc, _ = await proc_enc.communicate()
        if proc_enc.returncode == 0:
            output = stdout_enc.decode()
            if "WillEncrypt: true" in output or "RequiresEncryption: 1" in output:
                device_info["is_encrypted"] = True
                
    except Exception as e:
        print(f"Error fetching details for {udid}: {e}")
        
    return device_info

async def get_connected_devices():
    """Helper to get list of connected devices with details"""
    devices = []
    
    # Check for iOS devices using idevice_id
    try:
        proc = await asyncio.create_subprocess_exec(
            "idevice_id", "-l",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await proc.communicate()
        
        if proc.returncode == 0:
            udids = stdout.decode().strip().splitlines()
            for udid in udids:
                if udid:
                    # Get details for each device
                    details = await get_device_details(udid)
                    devices.append(details)
                    
    except FileNotFoundError:
        print("idevice_id not found. Make sure libimobiledevice is installed.")
    except Exception as e:
        print(f"Error checking for devices: {e}")
        
    return devices
