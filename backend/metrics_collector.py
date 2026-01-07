"""Metrics collector for system monitoring using psutil."""

import time
from datetime import datetime, timezone
from typing import List
import psutil
from pydantic import BaseModel


class CPUMetrics(BaseModel):
    """CPU usage metrics."""
    overall_percent: float
    per_core_percent: List[float]


class MemoryMetrics(BaseModel):
    """Memory usage metrics."""
    total: int  # bytes
    used: int  # bytes
    available: int  # bytes
    percent: float


class DiskMetrics(BaseModel):
    """Disk usage metrics for a partition."""
    device: str
    mountpoint: str
    total: int  # bytes
    used: int  # bytes
    free: int  # bytes
    percent: float


class NetworkMetrics(BaseModel):
    """Network I/O metrics."""
    bytes_sent: int
    bytes_recv: int
    upload_rate: float  # bytes per second
    download_rate: float  # bytes per second


class ProcessInfo(BaseModel):
    """Process information similar to top command."""
    pid: int
    name: str
    username: str
    cpu_percent: float
    memory_percent: float
    memory_rss: int  # bytes
    status: str
    num_threads: int
    create_time: float


class SystemMetrics(BaseModel):
    """Complete system metrics snapshot."""
    timestamp: datetime
    cpu: CPUMetrics
    memory: MemoryMetrics
    disk: List[DiskMetrics]
    network: NetworkMetrics


class MetricsCollector:
    """Collects system metrics using psutil."""
    
    def __init__(self):
        """Initialize metrics collector."""
        # Store previous network counters for rate calculation
        self._prev_network_counters = None
        self._prev_network_time = None
    
    def collect_cpu_metrics(self) -> CPUMetrics:
        """
        Collect CPU usage metrics.
        
        Returns:
            CPUMetrics with overall and per-core usage
        """
        # Get overall CPU percentage (blocking call with interval)
        overall_percent = psutil.cpu_percent(interval=0.1)
        
        # Get per-core CPU percentages
        per_core_percent = psutil.cpu_percent(interval=0.1, percpu=True)
        
        return CPUMetrics(
            overall_percent=overall_percent,
            per_core_percent=per_core_percent
        )
    
    def collect_memory_metrics(self) -> MemoryMetrics:
        """
        Collect memory usage metrics.
        
        Returns:
            MemoryMetrics with total, used, available, and percentage
        """
        memory = psutil.virtual_memory()
        
        return MemoryMetrics(
            total=memory.total,
            used=memory.used,
            available=memory.available,
            percent=memory.percent
        )
    
    def collect_disk_metrics(self) -> List[DiskMetrics]:
        """
        Collect disk usage for all partitions.
        
        Returns:
            List of DiskMetrics for each partition
        """
        disk_metrics = []
        
        # Get all disk partitions
        partitions = psutil.disk_partitions(all=False)
        
        for partition in partitions:
            # Skip loop devices
            if partition.device.startswith('/dev/loop'):
                continue
            
            try:
                # Get usage statistics for this partition
                usage = psutil.disk_usage(partition.mountpoint)
                
                disk_metrics.append(DiskMetrics(
                    device=partition.device,
                    mountpoint=partition.mountpoint,
                    total=usage.total,
                    used=usage.used,
                    free=usage.free,
                    percent=usage.percent
                ))
            except (PermissionError, OSError):
                # Skip partitions we can't access
                continue
        
        return disk_metrics
    
    def collect_network_metrics(self) -> NetworkMetrics:
        """
        Collect network I/O statistics.
        
        Returns:
            NetworkMetrics with bytes sent/received and rates
        """
        # Get current network I/O counters
        net_io = psutil.net_io_counters()
        current_time = time.time()
        
        bytes_sent = net_io.bytes_sent
        bytes_recv = net_io.bytes_recv
        
        # Calculate rates if we have previous data
        upload_rate = 0.0
        download_rate = 0.0
        
        if self._prev_network_counters is not None and self._prev_network_time is not None:
            time_delta = current_time - self._prev_network_time
            
            if time_delta > 0:
                bytes_sent_delta = bytes_sent - self._prev_network_counters.bytes_sent
                bytes_recv_delta = bytes_recv - self._prev_network_counters.bytes_recv
                
                upload_rate = bytes_sent_delta / time_delta
                download_rate = bytes_recv_delta / time_delta
        
        # Store current counters for next calculation
        self._prev_network_counters = net_io
        self._prev_network_time = current_time
        
        return NetworkMetrics(
            bytes_sent=bytes_sent,
            bytes_recv=bytes_recv,
            upload_rate=upload_rate,
            download_rate=download_rate
        )
    
    def collect_process_metrics(self, limit: int = 20, sort_by: str = 'cpu') -> List[ProcessInfo]:
        """
        Collect top processes sorted by CPU or memory usage.
        
        Args:
            limit: Maximum number of processes to return
            sort_by: Sort criteria ('cpu' or 'memory')
            
        Returns:
            List of ProcessInfo for top processes
        """
        processes = []
        
        for proc in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 
                                          'memory_percent', 'memory_info', 'status', 
                                          'num_threads', 'create_time']):
            try:
                info = proc.info
                processes.append(ProcessInfo(
                    pid=info['pid'],
                    name=info['name'] or 'Unknown',
                    username=info['username'] or 'Unknown',
                    cpu_percent=info['cpu_percent'] or 0.0,
                    memory_percent=info['memory_percent'] or 0.0,
                    memory_rss=info['memory_info'].rss if info['memory_info'] else 0,
                    status=info['status'] or 'unknown',
                    num_threads=info['num_threads'] or 0,
                    create_time=info['create_time'] or 0.0
                ))
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
        
        # Sort by specified criteria
        if sort_by == 'memory':
            processes.sort(key=lambda p: p.memory_percent, reverse=True)
        else:
            processes.sort(key=lambda p: p.cpu_percent, reverse=True)
        
        return processes[:limit]

    def collect_all_metrics(self) -> SystemMetrics:
        """
        Collect all system metrics in one call.
        
        Returns:
            SystemMetrics containing all metric types
        """
        timestamp = datetime.now(timezone.utc)
        
        cpu = self.collect_cpu_metrics()
        memory = self.collect_memory_metrics()
        disk = self.collect_disk_metrics()
        network = self.collect_network_metrics()
        
        return SystemMetrics(
            timestamp=timestamp,
            cpu=cpu,
            memory=memory,
            disk=disk,
            network=network
        )
