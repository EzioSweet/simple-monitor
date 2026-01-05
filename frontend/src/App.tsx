import { Show, createSignal } from 'solid-js';
import useSSEMetrics from './hooks/useSSEMetrics';
import { CPUMonitor, MemoryMonitor, DiskMonitor, NetworkMonitor, HistoricalView, ProcessMonitor } from './components';
import type { ConnectionStatus, TimeRange } from './types';

/**
 * Connection status indicator component
 * Displays the current SSE connection state with appropriate styling
 * Requirements: 5.5
 */
const ConnectionStatusIndicator = (props: { status: ConnectionStatus; onReconnect: () => void }) => {
  const getStatusConfig = () => {
    switch (props.status) {
      case 'connected':
        return { color: 'bg-green-500', text: 'Connected', pulse: false };
      case 'connecting':
        return { color: 'bg-yellow-500', text: 'Connecting...', pulse: true };
      case 'disconnected':
        return { color: 'bg-gray-500', text: 'Disconnected', pulse: false };
      case 'error':
        return { color: 'bg-red-500', text: 'Connection Error', pulse: false };
      default:
        return { color: 'bg-gray-500', text: 'Unknown', pulse: false };
    }
  };

  const config = () => getStatusConfig();

  return (
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <div class={`w-2.5 h-2.5 rounded-full ${config().color} ${config().pulse ? 'animate-pulse' : ''}`} />
        <span class="text-sm text-gray-300">{config().text}</span>
      </div>
      <Show when={props.status === 'disconnected' || props.status === 'error'}>
        <button
          onClick={props.onReconnect}
          class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          Reconnect
        </button>
      </Show>
    </div>
  );
};

/**
 * Loading skeleton component for initial load state
 * Requirements: 8.5
 */
const LoadingSkeleton = () => (
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {[1, 2, 3, 4].map(() => (
      <div class="bg-gray-800 rounded-lg p-4 animate-pulse">
        <div class="h-6 bg-gray-700 rounded w-1/3 mb-4" />
        <div class="h-32 bg-gray-700 rounded" />
      </div>
    ))}
  </div>
);

/**
 * Main App component - System Monitoring Dashboard
 * 
 * Integrates useSSEMetrics hook for real-time data
 * Renders all metric monitor components
 * Displays connection status indicator
 * Shows loading indicators during initial load
 * Applies UnoCSS styling for responsive layout
 * 
 * Requirements: 8.1, 8.2, 8.4, 8.5, 5.5, 6.3, 6.4, 6.5
 */
const App = () => {
  const { metrics, connectionStatus, reconnect } = useSSEMetrics();
  const [activeTab, setActiveTab] = createSignal<'realtime' | 'historical' | 'processes'>('realtime');
  const [timeRange, setTimeRange] = createSignal<TimeRange>('1h');

  const isLoading = () => connectionStatus() === 'connecting' && !metrics();
  const hasData = () => metrics() !== null;

  return (
    <div class="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="i-carbon-dashboard text-2xl text-blue-400" />
              <h1 class="text-xl font-bold">System Monitor</h1>
            </div>
            <ConnectionStatusIndicator 
              status={connectionStatus()} 
              onReconnect={reconnect} 
            />
          </div>
          
          {/* Tab Navigation */}
          <div class="flex gap-4 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab('realtime')}
              class={`px-4 py-2 text-sm font-medium rounded-t transition-colors cursor-pointer ${
                activeTab() === 'realtime'
                  ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <span class="i-carbon-activity mr-2" />
              Real-time
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('processes')}
              class={`px-4 py-2 text-sm font-medium rounded-t transition-colors cursor-pointer ${
                activeTab() === 'processes'
                  ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <span class="i-carbon-application mr-2" />
              Processes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('historical')}
              class={`px-4 py-2 text-sm font-medium rounded-t transition-colors cursor-pointer ${
                activeTab() === 'historical'
                  ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <span class="i-carbon-chart-line mr-2" />
              Historical
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Real-time View */}
        <Show when={activeTab() === 'realtime'}>
          <Show when={isLoading()}>
            <div class="mb-6">
              <div class="flex items-center justify-center gap-3 text-gray-400">
                <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Connecting to metrics stream...</span>
              </div>
            </div>
            <LoadingSkeleton />
          </Show>

          <Show when={!isLoading()}>
            {/* Connection error message */}
            <Show when={connectionStatus() === 'error' && !hasData()}>
              <div class="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg">
                <div class="flex items-center gap-3">
                  <span class="i-carbon-warning-alt text-xl text-red-400" />
                  <div>
                    <p class="text-red-400 font-medium">Unable to connect to metrics server</p>
                    <p class="text-gray-400 text-sm">Please check if the backend server is running and try reconnecting.</p>
                  </div>
                </div>
              </div>
            </Show>

            {/* Disconnected warning with stale data */}
            <Show when={(connectionStatus() === 'disconnected' || connectionStatus() === 'error') && hasData()}>
              <div class="mb-6 p-3 bg-yellow-900/30 border border-yellow-500 rounded-lg">
                <div class="flex items-center gap-2">
                  <span class="i-carbon-warning text-yellow-400" />
                  <span class="text-yellow-400 text-sm">
                    Connection lost. Displaying last known data. Attempting to reconnect...
                  </span>
                </div>
              </div>
            </Show>

            {/* Metrics Grid - Responsive layout */}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CPU Monitor */}
              <CPUMonitor cpuData={metrics()?.cpu ?? null} />

              {/* Memory Monitor */}
              <MemoryMonitor memoryData={metrics()?.memory ?? null} />

              {/* Disk Monitor */}
              <DiskMonitor diskData={metrics()?.disk ?? null} />

              {/* Network Monitor */}
              <NetworkMonitor networkData={metrics()?.network ?? null} />
            </div>

            {/* Last updated timestamp */}
            <Show when={hasData()}>
              <div class="mt-6 text-center text-gray-500 text-sm">
                Last updated: {new Date(metrics()!.timestamp).toLocaleString()}
              </div>
            </Show>
          </Show>
        </Show>

        {/* Processes View */}
        <Show when={activeTab() === 'processes'}>
          <ProcessMonitor />
        </Show>

        {/* Historical View */}
        <Show when={activeTab() === 'historical'}>
          <HistoricalView 
            timeRange={timeRange()} 
            onTimeRangeChange={setTimeRange} 
          />
        </Show>
      </main>

      {/* Footer */}
      <footer class="bg-gray-800 border-t border-gray-700 mt-auto">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p class="text-center text-gray-500 text-sm">
            System Monitoring Dashboard • Real-time metrics via SSE
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
