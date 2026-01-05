import { createEffect, createSignal, onCleanup } from 'solid-js';
import ApexCharts from 'apexcharts';
import type { CPUMetrics } from '../types';

interface CPUMonitorProps {
  cpuData: CPUMetrics | null;
}

const CPUMonitor = (props: CPUMonitorProps) => {
  let chartRef: HTMLDivElement | undefined;
  let chart: ApexCharts | null = null;
  const [isWarning, setIsWarning] = createSignal(false);

  // Warning threshold: CPU > 80%
  const WARNING_THRESHOLD = 80;

  createEffect(() => {
    const data = props.cpuData;
    if (data) {
      setIsWarning(data.overallPercent > WARNING_THRESHOLD);
    }
  });

  createEffect(() => {
    const data = props.cpuData;
    if (!chartRef || !data) return;

    const options: ApexCharts.ApexOptions = {
      chart: {
        type: 'bar',
        height: 200,
        toolbar: { show: false },
        background: 'transparent',
      },
      series: [{
        name: 'CPU Usage',
        data: data.perCorePercent,
      }],
      xaxis: {
        categories: data.perCorePercent.map((_, i) => `Core ${i}`),
        labels: { style: { colors: '#9ca3af' } },
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
      plotOptions: {
        bar: {
          borderRadius: 4,
          columnWidth: '60%',
        },
      },
      dataLabels: { enabled: false },
      grid: {
        borderColor: '#374151',
        strokeDashArray: 3,
      },
      tooltip: {
        theme: 'dark',
        y: { formatter: (val: number) => `${val.toFixed(1)}%` },
      },
    };

    if (chart) {
      chart.updateSeries([{ data: data.perCorePercent }]);
    } else {
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
    <div class={`rounded-lg p-4 ${isWarning() ? 'bg-yellow-900/30 border border-yellow-500' : 'bg-gray-800'}`}>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-white flex items-center gap-2">
          <span class="i-carbon-cpu text-xl" />
          CPU Usage
        </h2>
        {isWarning() && (
          <span class="px-2 py-1 text-xs font-medium bg-yellow-500 text-yellow-900 rounded">
            Warning
          </span>
        )}
      </div>
      
      {props.cpuData ? (
        <>
          <div class="mb-4">
            <div class="flex items-baseline gap-2">
              <span class={`text-4xl font-bold ${isWarning() ? 'text-yellow-400' : 'text-blue-400'}`}>
                {props.cpuData.overallPercent.toFixed(1)}%
              </span>
              <span class="text-gray-400 text-sm">overall</span>
            </div>
          </div>
          
          <div class="text-sm text-gray-400 mb-2">Per-Core Usage</div>
          <div ref={chartRef} />
        </>
      ) : (
        <div class="text-gray-400 text-center py-8">Loading CPU data...</div>
      )}
    </div>
  );
};

export default CPUMonitor;
