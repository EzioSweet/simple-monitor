import { createEffect, createSignal } from 'solid-js';
import type { MemoryMetrics } from '../types';

interface MemoryMonitorProps {
  memoryData: MemoryMetrics | null;
}

// Convert bytes to GB with 2 decimal places
const bytesToGB = (bytes: number): string => {
  return (bytes / (1024 * 1024 * 1024)).toFixed(2);
};

const MemoryMonitor = (props: MemoryMonitorProps) => {
  const [isWarning, setIsWarning] = createSignal(false);

  // Warning threshold: Memory > 85%
  const WARNING_THRESHOLD = 85;

  createEffect(() => {
    const data = props.memoryData;
    if (data) {
      setIsWarning(data.percent > WARNING_THRESHOLD);
    }
  });

  const getProgressColor = () => {
    if (!props.memoryData) return 'bg-gray-600';
    if (props.memoryData.percent > WARNING_THRESHOLD) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div class={`rounded-lg p-4 ${isWarning() ? 'bg-yellow-900/30 border border-yellow-500' : 'bg-gray-800'}`}>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-white flex items-center gap-2">
          <span class="i-carbon-memory text-xl" />
          Memory Usage
        </h2>
        {isWarning() && (
          <span class="px-2 py-1 text-xs font-medium bg-yellow-500 text-yellow-900 rounded">
            Warning
          </span>
        )}
      </div>

      {props.memoryData ? (
        <>
          <div class="mb-4">
            <div class="flex items-baseline gap-2">
              <span class={`text-4xl font-bold ${isWarning() ? 'text-yellow-400' : 'text-green-400'}`}>
                {props.memoryData.percent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div class="mb-4">
            <div class="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                class={`h-full ${getProgressColor()} transition-all duration-300`}
                style={{ width: `${props.memoryData.percent}%` }}
              />
            </div>
          </div>

          {/* Memory details */}
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div class="text-gray-400">Used</div>
              <div class="text-white font-medium">
                {bytesToGB(props.memoryData.used)} GB
              </div>
            </div>
            <div>
              <div class="text-gray-400">Available</div>
              <div class="text-white font-medium">
                {bytesToGB(props.memoryData.available)} GB
              </div>
            </div>
            <div>
              <div class="text-gray-400">Total</div>
              <div class="text-white font-medium">
                {bytesToGB(props.memoryData.total)} GB
              </div>
            </div>
            <div>
              <div class="text-gray-400">Usage</div>
              <div class={`font-medium ${isWarning() ? 'text-yellow-400' : 'text-green-400'}`}>
                {bytesToGB(props.memoryData.used)} / {bytesToGB(props.memoryData.total)} GB
              </div>
            </div>
          </div>
        </>
      ) : (
        <div class="text-gray-400 text-center py-8">Loading memory data...</div>
      )}
    </div>
  );
};

export default MemoryMonitor;
