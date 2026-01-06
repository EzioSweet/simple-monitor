# 系统监控仪表盘

一个实时系统监控仪表盘应用，用于展示 CPU、内存、磁盘和网络等关键系统指标。

## 功能特性

- **实时监控**：通过 SSE (Server-Sent Events) 实现每秒更新的实时数据推送
- **CPU 监控**：显示整体 CPU 使用率和各核心使用情况，超过 80% 时显示警告
- **内存监控**：显示总内存、已用内存、可用内存及使用百分比，超过 85% 时显示警告
- **磁盘监控**：显示所有分区的使用情况，超过 90% 时显示严重警告
- **网络监控**：显示实时上传/下载速率和累计流量
- **进程监控**：按 CPU 或内存使用率排序显示 Top 进程
- **历史数据**：支持 1 小时、6 小时、24 小时时间范围的历史数据图表
- **自动重连**：连接断开时自动使用指数退避策略重连

## 技术栈

### 后端
- FastAPI - Web 框架
- psutil - 系统指标采集
- SQLModel - ORM 数据库操作
- sse-starlette - SSE 支持
- uvicorn + uvloop - ASGI 服务器

### 前端
- SolidJS - 响应式 UI 框架
- TypeScript - 类型安全
- ApexCharts - 图表可视化
- UnoCSS - 原子化 CSS 框架
- Rsbuild - 构建工具

## 快速开始

### 环境要求
- Python 3.10+
- Node.js 18+
- Poetry (Python 包管理)

### 启动后端

```bash
cd backend
poetry install
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 启动前端（开发模式）

```bash
cd frontend
npm install
npm run dev
```

### 构建生产版本

```bash
cd frontend
npm run build
```

构建产物会输出到 `backend/static` 目录，由后端服务直接提供静态文件服务。

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/metrics/current` | GET | 获取当前系统指标 |
| `/api/metrics/history` | GET | 获取历史指标数据（支持时间范围参数） |
| `/api/metrics/stream` | GET | SSE 实时指标流 |
| `/api/processes/stream` | GET | SSE 实时进程流 |
| `/health` | GET | 健康检查 |

## 项目结构

```
├── backend/
│   ├── main.py              # FastAPI 应用入口
│   ├── models.py            # 数据库模型
│   ├── database.py          # 数据库服务层
│   ├── metrics_collector.py # 系统指标采集器
│   ├── sse_handler.py       # SSE 处理器
│   └── static/              # 前端构建产物
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # 主应用组件
│   │   ├── components/      # UI 组件
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── types/           # TypeScript 类型定义
│   │   └── config/          # 配置文件
│   └── package.json
└── .kiro/specs/             # 功能规格文档
```

## 数据存储

- 使用 SQLite 数据库存储历史指标数据
- 每小时自动清理过期数据
- 数据保留周期：72 小时

## 截图预览

仪表盘包含以下视图：
- **实时视图**：四宫格展示 CPU、内存、磁盘、网络实时数据
- **进程视图**：类似 top 命令的进程列表
- **历史视图**：时间序列图表展示历史趋势

## 许可证

BSD 3-Clause License
