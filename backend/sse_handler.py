"""SSE handler for real-time metric streaming."""

import asyncio
import json
from typing import AsyncGenerator

from metrics_collector import MetricsCollector, SystemMetrics


class SSEHandler:
    """Handles SSE connections and metric streaming."""
    
    def __init__(self, metrics_collector: MetricsCollector, interval: float = 2.0):
        """
        Initialize SSE handler.
        
        Args:
            metrics_collector: MetricsCollector instance for gathering metrics
            interval: Time interval between metric updates in seconds (default: 2.0)
        """
        self.metrics_collector = metrics_collector
        self.interval = interval
    
    async def stream_generator(self) -> AsyncGenerator[str, None]:
        """
        Generate SSE events with metrics at regular intervals.
        
        Yields:
            JSON-formatted metric events every `interval` seconds
        """
        try:
            while True:
                # Collect current metrics
                metrics = self.metrics_collector.collect_all_metrics()
                
                # Format as SSE event
                event_data = self.format_sse_event(metrics)
                yield event_data
                
                # Wait for next interval
                await asyncio.sleep(self.interval)
        except asyncio.CancelledError:
            # Handle client disconnection gracefully
            pass
    
    def format_sse_event(self, metrics: SystemMetrics) -> str:
        """
        Format metrics data as SSE event.
        
        Args:
            metrics: SystemMetrics instance to format
            
        Returns:
            SSE-formatted string with JSON data
        """
        # Convert metrics to dictionary
        metrics_dict = {
            "timestamp": metrics.timestamp.isoformat(),
            "cpu": {
                "overallPercent": metrics.cpu.overall_percent,
                "perCorePercent": metrics.cpu.per_core_percent
            },
            "memory": {
                "total": metrics.memory.total,
                "used": metrics.memory.used,
                "available": metrics.memory.available,
                "percent": metrics.memory.percent
            },
            "disk": [
                {
                    "device": d.device,
                    "mountpoint": d.mountpoint,
                    "total": d.total,
                    "used": d.used,
                    "free": d.free,
                    "percent": d.percent
                }
                for d in metrics.disk
            ],
            "network": {
                "bytesSent": metrics.network.bytes_sent,
                "bytesRecv": metrics.network.bytes_recv,
                "uploadRate": metrics.network.upload_rate,
                "downloadRate": metrics.network.download_rate
            }
        }
        
        # Return JSON string (sse-starlette handles the SSE formatting)
        return json.dumps(metrics_dict)
