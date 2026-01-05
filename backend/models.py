"""Database models for system metrics storage."""

from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class MetricsRecord(SQLModel, table=True):
    """Database model for storing system metrics."""
    
    __tablename__ = "metrics"  # type: ignore[assignment]
    
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(index=True)
    
    # CPU metrics
    cpu_percent: float
    cpu_per_core: str  # JSON string of per-core usage
    
    # Memory metrics
    memory_total: int
    memory_used: int
    memory_available: int
    memory_percent: float
    
    # Disk metrics
    disk_partitions: str  # JSON string of partition data
    
    # Network metrics
    network_bytes_sent: int
    network_bytes_recv: int
    network_upload_rate: float
    network_download_rate: float
