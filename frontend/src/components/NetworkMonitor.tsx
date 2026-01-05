import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import ApexCharts from 'apexcharts';
import type { NetworkMetrics } from '../types';

interface NetworkMonitorProps {
  networkData: NetworkMetrics | null;
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

// Convert bytes/sec to human-readable rate
const formatRate = (bytesPerSec: number): string => {
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
  }
  if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(2)} KB/s`;
  }
  return `${bytesPerSec.toFixed(0)} B/s`;
};

const MAX_HISTORY_POINTS = 30;

const NetworkMonitor = (props: NetworkMonitorProps) => {
  let chartRef: HTMLDivElement | undefined;
  let chart: ApexCharts | null = null;
  
  const [uploadHistory, setUploadHistory] = createSignal<number[]>([]);
  const [downloadHistory, setDownloadHistory] = createSignal<number[]>([]);

  createEffect(() => {
    const data = props.networkData;
    if (data) {
      setUploadHistory(prev => {
        const newHistory = [...prev, data.uploadRate];
        return newHistory.slice(-MAX_HISTORY_POINTS);
      });
      setDownloadHistory(prev => {
        const newHistory = [...prev, data.downloadRate];
        return newHistory.slice(-MAX_HISTORY_POINTS);
      });
    }
  });

  createEffect(() => {
    if (!chartRef) return;

    const upload = uploadHistory();
    const download = downloadHistory();

    // Don't render chart until we have data
    if (upload.length === 0 && download.length === 0) return;

    if (chart) {
      chart.updateSeries([
        { name: 'Upload', data: upload },
        { name: 'Download', data: download },
      ]);
    } else {
      const options: ApexCharts.ApexOptions = {
        chart: {
          type: 'area',
          height: 180,
          toolbar: { show: false },
          background: 'transparent',
          animations: {
            enabled: true,
            dynamicAnimation: { speed: 1000 },
          },
        },
        series: [
          { name: 'Upload', data: upload },
          { name: 'Download', data: download },
        ],
        xaxis: {
          labels: { show: false },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        yaxis: {
          labels: {
            style: { colors: '#9ca3af' },
            formatter: (val: number) => formatRate(val),
          },
        },
        colors: ['#f59e0b', '#3b82f6'],
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.4,
            opacityTo: 0.1,
          },
        },
        stroke: { curve: 'smooth', width: 2 },
        dataLabels: { enabled: false },
        grid: { borderColor: '#374151', strokeDashArray: 3 },
        legend: {
          position: 'top',
          horizontalAlign: 'right',
          labels: { colors: '#9ca3af' },
        },
        tooltip: {
          theme: 'dark',
          y: { formatter: (val: number) => formatRate(val) },
        },
      };
      chart = new ApexCharts(chartRef, options);
      chart.render();
    }
  });

  onCleanup(() => {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  });

  return (
    <div class="rounded-lg p-4 bg-gray-800">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-white flex items-center gap-2">
          <span class="i-carbon-network-2 text-xl" />
          Network Traffic
        </h2>
      </div>

      {props.networkData ? (
        <>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="bg-gray-700/50 rounded p-3">
              <div class="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <span class="i-carbon-arrow-up text-amber-500" />
                Upload
              </div>
              <div class="text-xl font-bold text-amber-400">
                {formatRate(props.networkData.uploadRate)}
              </div>
            </div>
            <div class="bg-gray-700/50 rounded p-3">
              <div class="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <span class="i-carbon-arrow-down text-blue-500" />
                Download
              </div>
              <div class="text-xl font-bold text-blue-400">
                {formatRate(props.networkData.downloadRate)}
              </div>
            </div>
          </div>

          <div class="mb-4">
            <div class="text-sm text-gray-400 mb-2">Traffic Over Time</div>
            <div ref={chartRef} />
          </div>

          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div class="text-gray-400">Total Sent</div>
              <div class="text-white font-medium">
                {formatBytes(props.networkData.bytesSent)}
              </div>
            </div>
            <div>
              <div class="text-gray-400">Total Received</div>
              <div class="text-white font-medium">
                {formatBytes(props.networkData.bytesRecv)}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div class="text-gray-400 text-center py-8">Loading network data...</div>
      )}
    </div>
  );
};

export default NetworkMonitor;
