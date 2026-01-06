"""FastAPI application entry point for Daphne server.

Daphne doesn't support ASGI lifespan events, so we initialize at module load time.

Usage:
    daphne -b 0.0.0.0 -p 8000 daphne:app
"""

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from database import DatabaseService
from metrics_collector import MetricsCollector
from models import MetricsRecord
from sse_handler import SSEHandler


# Initialize immediately at module load time (Daphne doesn't trigger lifespan/on_event)
db_service = DatabaseService()
metrics_collector = MetricsCollector()
sse_handler = SSEHandler(metrics_collector, interval=1.0)
print("Database, metrics collector, and SSE handler initialized")


async def cleanup_task():
    """Background task to cleanup old metrics every hour."""
    while True:
        await asyncio.sleep(3600)
        try:
            deleted = await db_service.cleanup_old_metrics(retention_hours=72)
            print(f"Cleanup task: deleted {deleted} old metrics records")
        except Exception as e:
            print(f"Cleanup task error: {e}")


# Create FastAPI application
app = FastAPI(
    title="System Monitoring Dashboard API",
    description="Real-time system metrics monitoring API",
    version="1.0.0"
)

# Start cleanup task when first request comes in
_cleanup_started = False

@app.middleware("http")
async def start_cleanup_middleware(request: Request, call_next):
    global _cleanup_started
    if not _cleanup_started:
        asyncio.create_task(cleanup_task())
        print("Background cleanup task started (every 1 hour, retain 72 hours)")
        _cleanup_started = True
    return await call_next(request)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/metrics/current")
async def get_current_metrics():
    try:
        return metrics_collector.collect_all_metrics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to collect metrics: {str(e)}")


@app.get("/api/metrics/history", response_model=List[dict])
async def get_historical_metrics(
    start_time: Optional[datetime] = Query(default=None),
    end_time: Optional[datetime] = Query(default=None)
):
    now = datetime.now(timezone.utc)
    if end_time is None:
        end_time = now
    if start_time is None:
        start_time = now - timedelta(hours=1)
    
    if start_time > end_time:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")
    
    try:
        records = await db_service.get_metrics_by_time_range(start_time, end_time)
        return [
            {
                "id": r.id,
                "timestamp": r.timestamp.isoformat(),
                "cpu_percent": r.cpu_percent,
                "cpu_per_core": r.cpu_per_core,
                "memory_total": r.memory_total,
                "memory_used": r.memory_used,
                "memory_available": r.memory_available,
                "memory_percent": r.memory_percent,
                "disk_partitions": r.disk_partitions,
                "network_bytes_sent": r.network_bytes_sent,
                "network_bytes_recv": r.network_bytes_recv,
                "network_upload_rate": r.network_upload_rate,
                "network_download_rate": r.network_download_rate
            }
            for r in records
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve historical metrics: {str(e)}")


async def stream_metrics_with_storage(request: Request):
    try:
        while True:
            if await request.is_disconnected():
                break
                
            metrics = metrics_collector.collect_all_metrics()
            
            metrics_record = MetricsRecord(
                timestamp=metrics.timestamp,
                cpu_percent=metrics.cpu.overall_percent,
                cpu_per_core=json.dumps(metrics.cpu.per_core_percent),
                memory_total=metrics.memory.total,
                memory_used=metrics.memory.used,
                memory_available=metrics.memory.available,
                memory_percent=metrics.memory.percent,
                disk_partitions=json.dumps([
                    {"device": d.device, "mountpoint": d.mountpoint, "total": d.total,
                     "used": d.used, "free": d.free, "percent": d.percent}
                    for d in metrics.disk
                ]),
                network_bytes_sent=metrics.network.bytes_sent,
                network_bytes_recv=metrics.network.bytes_recv,
                network_upload_rate=metrics.network.upload_rate,
                network_download_rate=metrics.network.download_rate
            )
            await db_service.save_metrics(metrics_record)
            
            event_data = {
                "timestamp": metrics.timestamp.isoformat(),
                "cpu": {"overallPercent": metrics.cpu.overall_percent, "perCorePercent": metrics.cpu.per_core_percent},
                "memory": {"total": metrics.memory.total, "used": metrics.memory.used,
                          "available": metrics.memory.available, "percent": metrics.memory.percent},
                "disk": [{"device": d.device, "mountpoint": d.mountpoint, "total": d.total,
                         "used": d.used, "free": d.free, "percent": d.percent} for d in metrics.disk],
                "network": {"bytesSent": metrics.network.bytes_sent, "bytesRecv": metrics.network.bytes_recv,
                           "uploadRate": metrics.network.upload_rate, "downloadRate": metrics.network.download_rate}
            }
            
            yield {"event": "metrics", "data": json.dumps(event_data)}
            await asyncio.sleep(1)
            
    except asyncio.CancelledError:
        pass


@app.get("/api/metrics/stream")
async def stream_metrics(request: Request):
    return EventSourceResponse(stream_metrics_with_storage(request))


async def stream_processes(request: Request, limit: int, sort_by: str):
    try:
        while True:
            if await request.is_disconnected():
                break
            
            processes = metrics_collector.collect_process_metrics(limit=limit, sort_by=sort_by)
            event_data = [
                {"pid": p.pid, "name": p.name, "username": p.username, "cpuPercent": p.cpu_percent,
                 "memoryPercent": p.memory_percent, "memoryRss": p.memory_rss, "status": p.status,
                 "numThreads": p.num_threads, "createTime": p.create_time}
                for p in processes
            ]
            
            yield {"event": "processes", "data": json.dumps(event_data)}
            await asyncio.sleep(1)
            
    except asyncio.CancelledError:
        pass


@app.get("/api/processes/stream")
async def stream_processes_endpoint(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="cpu", pattern="^(cpu|memory)$")
):
    return EventSourceResponse(stream_processes(request, limit, sort_by))


# Static files for frontend
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(STATIC_DIR, "static")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        
        index_path = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        
        raise HTTPException(status_code=404, detail="Not found")
