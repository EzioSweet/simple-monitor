/**
 * TypeScript interfaces for system monitoring metrics
 * Based on the design document data models
 */

export interface CPUMetrics {
  overallPercent: number;
  perCorePercent: number[];
}

export interface MemoryMetrics {
  total: number;  // bytes
  used: number;   // bytes
  available: number;  // bytes
  percent: number;
}

export interface DiskMetrics {
  device: string;
  mountpoint: string;
  total: number;  // bytes
  used: number;   // bytes
  free: number;   // bytes
  percent: number;
}

export interface NetworkMetrics {
  bytesSent: number;
  bytesRecv: number;
  uploadRate: number;   // bytes per second
  downloadRate: number; // bytes per second
}

export interface SystemMetrics {
  timestamp: string;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics[];
  network: NetworkMetrics;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type TimeRange = '1h' | '6h' | '24h';

export interface ProcessInfo {
  pid: number;
  name: string;
  username: string;
  cpuPercent: number;
  memoryPercent: number;
  memoryRss: number;  // bytes
  status: string;
  numThreads: number;
  createTime: number;
}
