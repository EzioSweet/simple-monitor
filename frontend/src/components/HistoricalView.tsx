import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import ApexCharts from 'apexcharts';
import type { TimeRange } from '../types';
import { API_ENDPOINTS } from '../config/api';

interface HistoricalViewProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}

interface HistoricalRecord {
  id: number;
  timestamp: string;
  cpu_percent: number;
  cpu_per_core: string;
  memory_total: number;
  memory_used: number;
  memory_available: number;
  memory_percent: number;
  disk_partitions: string;
  network_bytes_sent: number;
  network_bytes_recv: number;
  network_upload_rate: number;
  network_download_rate: number;
}

// Convert bytes to human-readable format
const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
};

// Get time range in hours
const getTimeRangeHours = (range: TimeRange): number => {
  switch (range) {
    case '1h': return 1;
    case '6h': return 6;
    case '24h': return 24;
    default: return 1;
  }
};

const HistoricalView = (props: HistoricalViewProps) => {
  const [data, setData] = createSignal<HistoricalRecord[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  let cpuChartRef: HTMLDivElement | undefined;
  let memoryChartRef: HTMLDivElement | undefined;
  let networkChartRef: HTMLDivElement | undefined;
  let diskChartRef: HTMLDivElement | undefined;

  let cpuChart: ApexCharts | null = null;
  let memoryChart: ApexCharts | null = null;
  let networkChart: ApexCharts | null = null;
  let diskChart: ApexCharts | null = null;

  const fetchHistoricalData = async () => {
    setLoading(true);
    setError(null);

    const hours = getTimeRangeHours(props.timeRange);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    try {
      const params = new URLSearchParams({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      });
      const url = `${API_ENDPOINTS.METRICS_HISTORY}?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const records: HistoricalRecord[] = await response.json();
      setData(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch historical data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when time range changes
  createEffect(() => {
    // Track timeRange dependency
    props.timeRange;
    fetchHistoricalData();
  });

  // Common chart options
  const getBaseChartOptions = (): Partial<ApexCharts.ApexOptions> => ({
    chart: {
      toolbar: { show: false },
      background: 'transparent',
      animations: { enabled: false },
    },
    grid: {
      borderColor: '#374151',
      strokeDashArray: 3,
    },
    tooltip: { theme: 'dark' },
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
  });

  // Render CPU chart
  const renderCPUChart = () => {
    if (!cpuChartRef) return;

    const records = data();
    if (records.length === 0) return;

    // Destroy existing chart before creating new one
    if (cpuChart) {
      cpuChart.destroy();
      cpuChart = null;
    }

    const timestamps = records.map(r => new Date(r.timestamp).getTime());
    const cpuData = records.map(r => r.cpu_percent);

    const options: ApexCharts.ApexOptions = {
      ...getBaseChartOptions(),
      chart: {
        ...getBaseChartOptions().chart,
        type: 'area',
        height: 200,
      },
      series: [{ name: 'CPU Usage', data: cpuData }],
      xaxis: {
        type: 'datetime',
        categories: timestamps,
        labels: { 
          style: { colors: '#9ca3af' },
          datetimeFormatter: { hour: 'HH:mm', minute: 'HH:mm' },
        },
      },
      yaxis: {
        min: 0,
        max: 100,
        labels: {
          style: { colors: '#9ca3af' },
          formatter: (val: number) => `${val.toFixed(0)}%`,
        },
      },
      colors: ['#3b82f6'],
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 },
      },
    };

    cpuChart = new ApexCharts(cpuChartRef, options);
    cpuChart.render();
  };

  // Render Memory chart
  const renderMemoryChart = () => {
    if (!memoryChartRef) return;

    const records = data();
    if (records.length === 0) return;

    // Destroy existing chart before creating new one
    if (memoryChart) {
      memoryChart.destroy();
      memoryChart = null;
    }

    const timestamps = records.map(r => new Date(r.timestamp).getTime());
    const memoryData = records.map(r => r.memory_percent);

    const options: ApexCharts.ApexOptions = {
      ...getBaseChartOptions(),
      chart: {
        ...getBaseChartOptions().chart,
        type: 'area',
        height: 200,
      },
      series: [{ name: 'Memory Usage', data: memoryData }],
      xaxis: {
        type: 'datetime',
        categories: timestamps,
        labels: {
          style: { colors: '#9ca3af' },
          datetimeFormatter: { hour: 'HH:mm', minute: 'HH:mm' },
        },
      },
      yaxis: {
        min: 0,
        max: 100,
        labels: {
          style: { colors: '#9ca3af' },
          formatter: (val: number) => `${val.toFixed(0)}%`,
        },
      },
      colors: ['#10b981'],
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 },
      },
    };

    memoryChart = new ApexCharts(memoryChartRef, options);
    memoryChart.render();
  };

  // Render Network chart
  const renderNetworkChart = () => {
    if (!networkChartRef) return;

    const records = data();
    if (records.length === 0) return;

    // Destroy existing chart before creating new one
    if (networkChart) {
      networkChart.destroy();
      networkChart = null;
    }

    const timestamps = records.map(r => new Date(r.timestamp).getTime());
    const uploadData = records.map(r => r.network_upload_rate);
    const downloadData = records.map(r => r.network_download_rate);

    const options: ApexCharts.ApexOptions = {
      ...getBaseChartOptions(),
      chart: {
        ...getBaseChartOptions().chart,
        type: 'area',
        height: 200,
      },
      series: [
        { name: 'Upload', data: uploadData },
        { name: 'Download', data: downloadData },
      ],
      xaxis: {
        type: 'datetime',
        categories: timestamps,
        labels: {
          style: { colors: '#9ca3af' },
          datetimeFormatter: { hour: 'HH:mm', minute: 'HH:mm' },
        },
      },
      yaxis: {
        labels: {
          style: { colors: '#9ca3af' },
          formatter: (val: number) => formatBytes(val) + '/s',
        },
      },
      colors: ['#f59e0b', '#3b82f6'],
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 },
      },
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        labels: { colors: '#9ca3af' },
      },
    };

    networkChart = new ApexCharts(networkChartRef, options);
    networkChart.render();
  };

  // Render Disk chart
  const renderDiskChart = () => {
    if (!diskChartRef) return;

    const records = data();
    if (records.length === 0) return;

    // Destroy existing chart before creating new one
    if (diskChart) {
      diskChart.destroy();
      diskChart = null;
    }

    // Get the latest disk partitions to determine series
    const latestRecord = records[records.length - 1];
    let partitions: Array<{ mountpoint: string }> = [];
    try {
      partitions = JSON.parse(latestRecord.disk_partitions);
    } catch {
      return;
    }

    const timestamps = records.map(r => new Date(r.timestamp).getTime());
    
    // Create series for each partition
    const series = partitions.map((partition) => {
      const partitionData = records.map(r => {
        try {
          const disks = JSON.parse(r.disk_partitions);
          const disk = disks.find((d: { mountpoint: string }) => d.mountpoint === partition.mountpoint);
          return disk ? disk.percent : 0;
        } catch {
          return 0;
        }
      });
      return { name: partition.mountpoint, data: partitionData };
    });

    const options: ApexCharts.ApexOptions = {
      ...getBaseChartOptions(),
      chart: {
        ...getBaseChartOptions().chart,
        type: 'line',
        height: 200,
      },
      series,
      xaxis: {
        type: 'datetime',
        categories: timestamps,
        labels: {
          style: { colors: '#9ca3af' },
          datetimeFormatter: { hour: 'HH:mm', minute: 'HH:mm' },
        },
      },
      yaxis: {
        min: 0,
        max: 100,
        labels: {
          style: { colors: '#9ca3af' },
          formatter: (val: number) => `${val.toFixed(0)}%`,
        },
      },
      colors: ['#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        labels: { colors: '#9ca3af' },
      },
    };

    diskChart = new ApexCharts(diskChartRef, options);
    diskChart.render();
  };

  // Update charts when data changes
  createEffect(() => {
    const records = data();
    if (records.length > 0) {
      // Use setTimeout to ensure DOM refs are available after render
      setTimeout(() => {
        renderCPUChart();
        renderMemoryChart();
        renderNetworkChart();
        renderDiskChart();
      }, 0);
    }
  });

  // Cleanup charts on unmount
  onCleanup(() => {
    cpuChart?.destroy();
    memoryChart?.destroy();
    networkChart?.destroy();
    diskChart?.destroy();
    cpuChart = null;
    memoryChart = null;
    networkChart = null;
    diskChart = null;
  });

  const timeRangeOptions: TimeRange[] = ['1h', '6h', '24h'];

  return (
    <div class="bg-gray-800 rounded-lg p-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-white flex items-center gap-2">
          <span class="i-carbon-chart-line text-xl" />
          Historical Data
        </h2>
        
        {/* Time Range Selector */}
        <div class="flex gap-2">
          <For each={timeRangeOptions}>
            {(range) => (
              <button
                onClick={() => props.onTimeRangeChange(range)}
                class={`px-3 py-1 text-sm rounded transition-colors ${
                  props.timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {range}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Loading State */}
      <Show when={loading()}>
        <div class="flex items-center justify-center py-12">
          <div class="flex items-center gap-3 text-gray-400">
            <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading historical data...</span>
          </div>
        </div>
      </Show>

      {/* Error State */}
      <Show when={error() && !loading()}>
        <div class="p-4 bg-red-900/30 border border-red-500 rounded-lg">
          <div class="flex items-center gap-3">
            <span class="i-carbon-warning-alt text-xl text-red-400" />
            <div>
              <p class="text-red-400 font-medium">Failed to load historical data</p>
              <p class="text-gray-400 text-sm">{error()}</p>
            </div>
          </div>
          <button
            onClick={fetchHistoricalData}
            class="mt-3 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </Show>

      {/* No Data State */}
      <Show when={!loading() && !error() && data().length === 0}>
        <div class="text-center py-12 text-gray-400">
          <span class="i-carbon-no-data text-4xl mb-3 block" />
          <p>No historical data available for the selected time range.</p>
          <p class="text-sm mt-1">Data is collected when the SSE stream is active.</p>
        </div>
      </Show>

      {/* Charts */}
      <Show when={!loading() && !error() && data().length > 0}>
        <div class="space-y-6">
          {/* CPU Chart */}
          <div class="bg-gray-700/50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <span class="i-carbon-cpu" />
              CPU Usage Over Time
            </h3>
            <div ref={cpuChartRef} />
          </div>

          {/* Memory Chart */}
          <div class="bg-gray-700/50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <span class="i-carbon-memory" />
              Memory Usage Over Time
            </h3>
            <div ref={memoryChartRef} />
          </div>

          {/* Network Chart */}
          <div class="bg-gray-700/50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <span class="i-carbon-network-2" />
              Network Traffic Over Time
            </h3>
            <div ref={networkChartRef} />
          </div>

          {/* Disk Chart */}
          <div class="bg-gray-700/50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <span class="i-carbon-data-volume" />
              Disk Usage Over Time
            </h3>
            <div ref={diskChartRef} />
          </div>

          {/* Data Summary */}
          <div class="text-center text-gray-500 text-sm">
            Showing {data().length} data points from the last {props.timeRange}
          </div>
        </div>
      </Show>
    </div>
  );
};

export default HistoricalView;
