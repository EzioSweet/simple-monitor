# AGENTS.md

## Project Overview

This is a real-time system monitoring dashboard application that displays key system metrics including CPU, memory, disk, and network statistics. The system consists of a FastAPI backend and a SolidJS frontend.

## Tech Stack

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.10+
- **Metrics Collection**: psutil
- **Database**: SQLite with SQLModel ORM
- **Real-time**: Server-Sent Events (sse-starlette)
- **Server**: uvicorn with uvloop

### Frontend
- **Framework**: SolidJS
- **Language**: TypeScript
- **Build Tool**: Rsbuild
- **Charts**: ApexCharts
- **Styling**: UnoCSS

## Project Structure

```
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── models.py            # SQLModel database models
│   ├── database.py          # Database service layer
│   ├── metrics_collector.py # System metrics collection using psutil
│   ├── sse_handler.py       # SSE stream handler
│   └── static/              # Frontend build output (served by backend)
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main dashboard component
│   │   ├── components/      # UI components (CPU, Memory, Disk, Network monitors)
│   │   ├── hooks/           # Custom hooks (useSSEMetrics)
│   │   ├── types/           # TypeScript type definitions
│   │   └── config/          # API configuration
│   └── package.json
└── .kiro/specs/             # Feature specifications
```

## Key Features

1. **Real-time Monitoring**: SSE-based live updates every 1-2 seconds
2. **CPU Monitoring**: Overall and per-core usage with warning indicators (>80%)
3. **Memory Monitoring**: Total/used/available with warning indicators (>85%)
4. **Disk Monitoring**: All partitions with critical warnings (>90%)
5. **Network Monitoring**: Upload/download rates and cumulative traffic
6. **Process Monitoring**: Top processes sorted by CPU/memory usage
7. **Historical Data**: Time-series charts with 1h/6h/24h range selection
8. **Auto-reconnection**: Exponential backoff for connection recovery

## API Endpoints

- `GET /api/metrics/current` - Current system metrics
- `GET /api/metrics/history` - Historical metrics with time range
- `GET /api/metrics/stream` - SSE endpoint for real-time updates
- `GET /api/processes/stream` - SSE endpoint for process monitoring
- `GET /health` - Health check endpoint

## Development Guidelines

### Backend
- Use Pydantic models for request/response validation
- Store metrics with timestamps for historical queries
- Implement automatic cleanup of data older than 72 hours
- Handle psutil exceptions gracefully without breaking other metrics

### Frontend
- Use SolidJS reactive primitives (createSignal, createEffect)
- Format bytes to human-readable units (KB/MB/GB)
- Apply color coding: green (normal), yellow (warning), red (critical)
- Show loading states during initial connection

### Code Style
- Backend: Follow PEP 8, use type hints
- Frontend: Follow TypeScript strict mode, use functional components
- Use camelCase for frontend, snake_case for backend
- API responses use camelCase for frontend compatibility

## Running the Project

### Backend
```bash
cd backend
poetry install
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
vlt i
vlt r dev      # Development
vlt r build    # Production build (output to backend/static)
```

## Data Retention

- Metrics are stored in SQLite database
- Automatic cleanup runs every hour
- Data retention period: 72 hours
