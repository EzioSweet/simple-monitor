"""FastAPI application for system monitoring dashboard."""

import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from database import DatabaseService
from metrics_collector import MetricsCollector, SystemMetrics, ProcessInfo
from models import MetricsRecord
from sse_handler import SSEHandler


# Global instances
db_service: Optional[DatabaseService] = None
metrics_collector: Optional[MetricsCollector] = None
sse_handler: Optional[SSEHandler] = None



class ErrorResponse(BaseModel):
    """Error response model."""
    detail: str


async def cleanup_task():
    """Background task to cleanup old metrics every hour."""
    while True:
        await asyncio.sleep(3600)  # Wait 1 hour
        if db_service:
            try:
                deleted = await db_service.cleanup_old_metrics(retention_hours=72)
                print(f"Cleanup task: deleted {deleted} old metrics records")
            except Exception as e:
                print(f"Cleanup task error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    global db_service, metrics_collector, sse_handler
    
    # Startup: Initialize database and metrics collector
    db_service = DatabaseService()
    metrics_collector = MetricsCollector()
    sse_handler = SSEHandler(metrics_collector, interval=1.0)
    print("Database, metrics collector, and SSE handler initialized")
    
    # Start background cleanup task
    cleanup_task_handle = asyncio.create_task(cleanup_task())
    print("Background cleanup task started (every 1 hour, retain 72 hours)")
    
    yield
    
    # Shutdown: Cancel cleanup task and close database
    cleanup_task_handle.cancel()
    try:
        await cleanup_task_handle
    except asyncio.CancelledError:
        pass
    
    if db_service:
        db_service.close()
        print("Database connection closed")


# Create FastAPI application
app = FastAPI(
    title="System Monitoring Dashboard API",
    description="Real-time system metrics monitoring API",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get(
    "/api/metrics/current",
    response_model=SystemMetrics,
    responses={
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def get_current_metrics():
    """
    Get current system metrics.
    
    Returns current CPU, memory, disk, and network metrics.
    """
    if metrics_collector is None:
        raise HTTPException(
            status_code=500,
            detail="Metrics collector not initialized"
        )
    
    try:
        metrics = metrics_collector.collect_all_metrics()
        return metrics
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to collect metrics: {str(e)}"
        )


@app.get(
    "/api/metrics/history",
    response_model=List[dict],
    responses={
        400: {"model": ErrorResponse, "description": "Invalid parameters"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def get_historical_metrics(
    start_time: Optional[datetime] = Query(
        default=None,
        description="Start time for historical data (ISO format). Defaults to 1 hour ago."
    ),
    end_time: Optional[datetime] = Query(
        default=None,
        description="End time for historical data (ISO format). Defaults to now."
    )
):
    """
    Get historical system metrics within a time range.
    
    Returns metrics stored in the database for the specified time range.
    """
    if db_service is None:
        raise HTTPException(
            status_code=500,
            detail="Database service not initialized"
        )
    
    # Set default time range if not provided
    now = datetime.now(timezone.utc)
    if end_time is None:
        end_time = now
    if start_time is None:
        start_time = now - timedelta(hours=1)
    
    # Validate time range
    if start_time > end_time:
        raise HTTPException(
            status_code=400,
            detail="start_time must be before end_time"
        )
    
    try:
        records = await db_service.get_metrics_by_time_range(start_time, end_time)
        
        # Convert records to dictionaries for JSON response
        result = []
        for record in records:
            result.append({
                "id": record.id,
                "timestamp": record.timestamp.isoformat(),
                "cpu_percent": record.cpu_percent,
                "cpu_per_core": record.cpu_per_core,
                "memory_total": record.memory_total,
                "memory_used": record.memory_used,
                "memory_available": record.memory_available,
                "memory_percent": record.memory_percent,
                "disk_partitions": record.disk_partitions,
                "network_bytes_sent": record.network_bytes_sent,
                "network_bytes_recv": record.network_bytes_recv,
                "network_upload_rate": record.network_upload_rate,
                "network_download_rate": record.network_download_rate
            })
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve historical metrics: {str(e)}"
        )


async def stream_metrics_with_storage(request: Request):
    """
    Generate SSE events with metrics and store them to database.
    
    This generator yields metrics every 2 seconds and persists them
    to the database for historical data access.
    
    Args:
        request: FastAPI Request object to detect client disconnection
        
    Yields:
        dict: SSE event data with metrics
    """
    try:
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break
            
            # Collect current metrics
            if metrics_collector is None:
                break
                
            metrics = metrics_collector.collect_all_metrics()
            
            # Store metrics to database
            if db_service is not None:
                metrics_record = MetricsRecord(
                    timestamp=metrics.timestamp,
                    cpu_percent=metrics.cpu.overall_percent,
                    cpu_per_core=json.dumps(metrics.cpu.per_core_percent),
                    memory_total=metrics.memory.total,
                    memory_used=metrics.memory.used,
                    memory_available=metrics.memory.available,
                    memory_percent=metrics.memory.percent,
                    disk_partitions=json.dumps([
                        {
                            "device": d.device,
                            "mountpoint": d.mountpoint,
                            "total": d.total,
                            "used": d.used,
                            "free": d.free,
                            "percent": d.percent
                        }
                        for d in metrics.disk
                    ]),
                    network_bytes_sent=metrics.network.bytes_sent,
                    network_bytes_recv=metrics.network.bytes_recv,
                    network_upload_rate=metrics.network.upload_rate,
                    network_download_rate=metrics.network.download_rate
                )
                await db_service.save_metrics(metrics_record)
            
            # Format metrics for SSE (using camelCase for frontend)
            event_data = {
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
            
            yield {"event": "metrics", "data": json.dumps(event_data)}
            
            # Wait for next interval (1 second)
            await asyncio.sleep(1)
            
    except asyncio.CancelledError:
        # Handle client disconnection gracefully
        pass


@app.get(
    "/api/metrics/stream",
    responses={
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def stream_metrics(request: Request):
    """
    SSE endpoint for real-time metric streaming.
    
    Establishes a Server-Sent Events connection that pushes
    updated metrics every 2 seconds. Metrics are also stored
    to the database during streaming.
    """
    if metrics_collector is None or sse_handler is None:
        raise HTTPException(
            status_code=500,
            detail="Metrics collector or SSE handler not initialized"
        )
    
    return EventSourceResponse(stream_metrics_with_storage(request))


@app.get(
    "/api/processes",
    response_model=List[dict],
    responses={
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def get_processes(
    limit: int = Query(default=20, ge=1, le=100, description="Number of processes to return"),
    sort_by: str = Query(default="cpu", regex="^(cpu|memory)$", description="Sort by 'cpu' or 'memory'")
):
    """
    Get top processes sorted by CPU or memory usage (similar to top command).
    """
    if metrics_collector is None:
        raise HTTPException(
            status_code=500,
            detail="Metrics collector not initialized"
        )
    
    try:
        processes = metrics_collector.collect_process_metrics(limit=limit, sort_by=sort_by)
        return [
            {
                "pid": p.pid,
                "name": p.name,
                "username": p.username,
                "cpuPercent": p.cpu_percent,
                "memoryPercent": p.memory_percent,
                "memoryRss": p.memory_rss,
                "status": p.status,
                "numThreads": p.num_threads,
                "createTime": p.create_time
            }
            for p in processes
        ]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to collect process metrics: {str(e)}"
        )


# Static files for frontend
# Put frontend build output in backend/static directory
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.exists(STATIC_DIR):
    # Serve static assets (js, css, images, etc.)
    app.mount("/static", StaticFiles(directory=os.path.join(STATIC_DIR, "static")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve SPA - return index.html for all non-API routes."""
        # Skip API routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        
        # Try to serve the exact file first
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # Fall back to index.html for SPA routing
        index_path = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        
        raise HTTPException(status_code=404, detail="Not found")
