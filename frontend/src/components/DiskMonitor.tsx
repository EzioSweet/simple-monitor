import { For } from 'solid-js';
import type { DiskMetrics } from '../types';

interface DiskMonitorProps {
  diskData: DiskMetrics[] | null;
}

const formatBytes = (bytes: number): string => {
  const tb = bytes / (1024 * 1024 * 1024 * 1024);
  if (tb >= 1) {
    return `${tb.toFixed(2)} TB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
};

// Critical threshold: Disk > 90%
const CRITICAL_THRESHOLD = 90;

const getStatusColor = (percent: number) => {
  if (percent > CRITICAL_THRESHOLD) return 'text-red-400';
  if (percent > 80) return 'text-yellow-400';
  return 'text-green-400';
};

const getProgressColor = (percent: number) => {
  if (percent > CRITICAL_THRESHOLD) return 'bg-red-500';
  if (percent > 80) return 'bg-yellow-500';
  return 'bg-green-500';
};

const DiskMonitor = (props: DiskMonitorProps) => {
  const hasCritical = () => {
    return props.diskData?.some(disk => disk.percent > CRITICAL_THRESHOLD) ?? false;
  };

  return (
    <div class={`rounded-lg p-4 ${hasCritical() ? 'bg-red-900/30 border border-red-500' : 'bg-gray-800'}`}>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-white flex items-center gap-2">
          <span class="i-carbon-hard-drive text-xl" />
          Disk Usage
        </h2>
        {hasCritical() && (
          <span class="px-2 py-1 text-xs font-medium bg-red-500 text-white rounded">
            Critical
          </span>
        )}
      </div>

      {props.diskData && props.diskData.length > 0 ? (
        <div class="space-y-4">
          <For each={props.diskData}>
            {(disk) => {
              const isCritical = disk.percent > CRITICAL_THRESHOLD;
              return (
                <div class={`p-3 rounded ${isCritical ? 'bg-red-900/20' : 'bg-gray-700/50'}`}>
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <div class="text-white font-medium text-sm">{disk.mountpoint}</div>
                      <div class="text-gray-400 text-xs">{disk.device}</div>
                    </div>
                    <div class="text-right">
                      <div class={`font-bold ${getStatusColor(disk.percent)}`}>
                        {disk.percent.toFixed(1)}%
                      </div>
                      {isCritical && (
                        <span class="text-xs text-red-400">Critical</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div class="h-2 bg-gray-600 rounded-full overflow-hidden mb-2">
                    <div 
                      class={`h-full ${getProgressColor(disk.percent)} transition-all duration-300`}
                      style={{ width: `${disk.percent}%` }}
                    />
                  </div>
                  
                  {/* Space details */}
                  <div class="flex justify-between text-xs text-gray-400">
                    <span>Used: {formatBytes(disk.used)}</span>
                    <span>Free: {formatBytes(disk.free)}</span>
                    <span>Total: {formatBytes(disk.total)}</span>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      ) : (
        <div class="text-gray-400 text-center py-8">Loading disk data...</div>
      )}
    </div>
  );
};

export default DiskMonitor;
