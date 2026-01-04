import psutil

def get_system_info():
    """Retrieve basic system information."""
    cpu_usage = psutil.cpu_percent(interval=1)
    memory_info = psutil.virtual_memory()
    disk_info = psutil.disk_usage('/')

    system_info = {
        'cpu_usage_percent': cpu_usage,
        'memory_total_mb': memory_info.total / (1024 * 1024),
        'memory_used_mb': memory_info.used / (1024 * 1024),
        'memory_free_mb': memory_info.available / (1024 * 1024),
        'disk_total_gb': disk_info.total / (1024 * 1024 * 1024),
        'disk_used_gb': disk_info.used / (1024 * 1024 * 1024),
        'disk_free_gb': disk_info.free / (1024 * 1024 * 1024),
    }

    return system_info
if __name__ == "__main__":
    info = get_system_info()
    for key, value in info.items():
        print(f"{key}: {value:.2f}")