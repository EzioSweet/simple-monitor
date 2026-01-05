"""Database service for metrics storage and retrieval."""

from datetime import datetime, timedelta
from typing import List, Optional
from sqlmodel import Session, SQLModel, create_engine, select
from models import MetricsRecord


class DatabaseService:
    """Manages database operations for metrics storage."""
    
    def __init__(self, database_url: str = "sqlite:///./simple-monitor.db"):
        """
        Initialize database service.
        
        Args:
            database_url: SQLAlchemy database URL
        """
        self.engine = create_engine(
            database_url,
            connect_args={"check_same_thread": False},  # Needed for SQLite
            echo=False
        )
        self._create_tables()
    
    def _create_tables(self) -> None:
        """Create database tables if they don't exist."""
        SQLModel.metadata.create_all(self.engine)
    
    async def save_metrics(self, metrics_record: MetricsRecord) -> None:
        """
        Save metrics to database.
        
        Args:
            metrics_record: MetricsRecord instance to save
        """
        with Session(self.engine) as session:
            session.add(metrics_record)
            session.commit()
    
    async def get_metrics_by_time_range(
        self,
        start: datetime,
        end: datetime
    ) -> List[MetricsRecord]:
        """
        Retrieve metrics within time range.
        
        Args:
            start: Start time (inclusive)
            end: End time (inclusive)
            
        Returns:
            List of MetricsRecord within the time range
        """
        with Session(self.engine) as session:
            statement = select(MetricsRecord).where(
                MetricsRecord.timestamp >= start,
                MetricsRecord.timestamp <= end
            ).order_by(MetricsRecord.timestamp.asc())  # type: ignore[union-attr]
            results = session.exec(statement).all()
            return list(results)
    
    async def cleanup_old_metrics(self, retention_hours: int = 24) -> int:
        """
        Remove metrics older than retention period.
        
        Args:
            retention_hours: Number of hours to retain metrics (default: 24)
            
        Returns:
            Number of records deleted
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=retention_hours)
        
        with Session(self.engine) as session:
            statement = select(MetricsRecord).where(
                MetricsRecord.timestamp < cutoff_time
            )
            old_records = session.exec(statement).all()
            count = len(old_records)
            
            for record in old_records:
                session.delete(record)
            
            session.commit()
            return count
    
    def close(self) -> None:
        """Close database connection."""
        self.engine.dispose()
