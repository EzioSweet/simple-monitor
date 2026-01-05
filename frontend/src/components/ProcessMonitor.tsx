import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type { ProcessInfo } from '../types';
import { API_BASE_URL } from '../config';

type SortBy = 'cpu' | 'memory';

const ProcessMonitor = () => {
  const [processes, setProcesses] = createSignal<ProcessInfo[]>([]);
  const [sortBy, setSortBy] = createSignal<SortBy>('cpu');
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const fetchProcesses = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/processes?limit=15&sort_by=${sortBy()}`);
      if (!res.ok) throw new Error('Failed to fetch processes');
      const data = await res.json();
      setProcesses(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and polling every 2 seconds
  createEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 2000);
    onCleanup(() => clearInterval(interval));
  });

  // Refetch when sort changes
  createEffect(() => {
    sortBy(); // track dependency
    fetchProcesses();
  });

  const formatMemory = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-400';
      case 'sleeping': return 'text-blue-400';
      case 'stopped': return 'text-yellow-400';
      case 'zombie': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div class="bg-gray-800 rounded-lg p-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-white flex items-center gap-2">
          <span class="i-carbon-application text-xl" />
          Processes
        </h2>
        <div class="flex gap-2">
          <button
            onClick={() => setSortBy('cpu')}
            class={`px-3 py-1 text-xs rounded transition-colors ${
              sortBy() === 'cpu' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            CPU
          </button>
          <button
            onClick={() => setSortBy('memory')}
            class={`px-3 py-1 text-xs rounded transition-colors ${
              sortBy() === 'memory' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Memory
          </button>
        </div>
      </div>

      <Show when={error()}>
        <div class="text-red-400 text-sm mb-2">{error()}</div>
      </Show>

      <Show when={loading() && processes().length === 0}>
        <div class="text-gray-400 text-center py-8">Loading processes...</div>
      </Show>

      <Show when={processes().length > 0}>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-gray-400 text-left border-b border-gray-700">
                <th class="pb-2 pr-2">PID</th>
                <th class="pb-2 pr-2">Name</th>
                <th class="pb-2 pr-2">User</th>
                <th class="pb-2 pr-2 text-right">CPU%</th>
                <th class="pb-2 pr-2 text-right">MEM%</th>
                <th class="pb-2 pr-2 text-right">RSS</th>
                <th class="pb-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <For each={processes()}>
                {(proc) => (
                  <tr class="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td class="py-1.5 pr-2 text-gray-300 font-mono text-xs">{proc.pid}</td>
                    <td class="py-1.5 pr-2 text-white truncate max-w-32" title={proc.name}>{proc.name}</td>
                    <td class="py-1.5 pr-2 text-gray-400 truncate max-w-20" title={proc.username}>{proc.username}</td>
                    <td class={`py-1.5 pr-2 text-right font-mono ${proc.cpuPercent > 50 ? 'text-yellow-400' : 'text-blue-400'}`}>
                      {proc.cpuPercent.toFixed(1)}
                    </td>
                    <td class={`py-1.5 pr-2 text-right font-mono ${proc.memoryPercent > 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {proc.memoryPercent.toFixed(1)}
                    </td>
                    <td class="py-1.5 pr-2 text-right text-gray-300 font-mono text-xs">{formatMemory(proc.memoryRss)}</td>
                    <td class={`py-1.5 text-center text-xs ${getStatusColor(proc.status)}`}>{proc.status}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
};

export default ProcessMonitor;
