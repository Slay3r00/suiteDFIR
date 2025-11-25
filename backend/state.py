# Global state
plugin_loaders = {}
available_modules = {}
tasks = {}
backup_tasks = {}
active_backups = {}
processing_tasks = {}

# Event Broadcasting State
current_devices = []
event_clients = set()
