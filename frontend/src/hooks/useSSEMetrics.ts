import { createSignal, onCleanup, onMount } from 'solid-js';
import type { SystemMetrics, ConnectionStatus } from '../types';
import { API_ENDPOINTS } from '../config';

/**
 * Configuration for exponential backoff retry
 */
interface RetryConfig {
  initialDelay: number;  // Initial delay in ms (1000 = 1s)
  maxDelay: number;      // Maximum delay in ms (30000 = 30s)
  multiplier: number;    // Multiplier for each retry (2 = double each time)
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
};

/**
 * Calculate the next retry delay using exponential backoff
 * @param attempt - Current retry attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.initialDelay * Math.pow(config.multiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Custom SolidJS hook for managing SSE connection and real-time metrics updates
 * 
 * Features:
 * - Establishes EventSource connection to /api/metrics/stream
 * - Parses incoming SSE events and updates metrics signal
 * - Tracks connection status (connecting, connected, disconnected, error)
 * - Implements automatic reconnection with exponential backoff
 * 
 * Requirements: 5.1, 5.3, 5.4, 5.5
 */
function useSSEMetrics(retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
  const [metrics, setMetrics] = createSignal<SystemMetrics | null>(null);
  const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>('disconnected');
  
  let eventSource: EventSource | null = null;
  let retryAttempt = 0;
  let retryTimeoutId: number | null = null;

  /**
   * Parse SSE event data into SystemMetrics
   */
  const parseMetricsData = (data: string): SystemMetrics | null => {
    try {
      const parsed = JSON.parse(data);
      return parsed as SystemMetrics;
    } catch (error) {
      console.error('Failed to parse metrics data:', error);
      return null;
    }
  };

  /**
   * Clean up existing connection and timers
   */
  const cleanup = () => {
    if (retryTimeoutId !== null) {
      clearTimeout(retryTimeoutId);
      retryTimeoutId = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  const scheduleReconnect = () => {
    if (retryTimeoutId !== null) {
      return; // Already scheduled
    }

    const delay = calculateBackoffDelay(retryAttempt, retryConfig);
    console.log(`Scheduling reconnect attempt ${retryAttempt + 1} in ${delay}ms`);
    
    retryTimeoutId = window.setTimeout(() => {
      retryTimeoutId = null;
      retryAttempt++;
      connect();
    }, delay);
  };

  /**
   * Establish SSE connection to the metrics stream endpoint
   */
  const connect = () => {
    // Clean up any existing connection
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    setConnectionStatus('connecting');
    
    try {
      eventSource = new EventSource(API_ENDPOINTS.METRICS_STREAM);

      eventSource.onopen = () => {
        console.log('SSE connection established');
        setConnectionStatus('connected');
        retryAttempt = 0; // Reset retry counter on successful connection
      };

      // Listen for 'metrics' events (as sent by the backend)
      eventSource.addEventListener('metrics', (event: MessageEvent) => {
        const metricsData = parseMetricsData(event.data);
        if (metricsData) {
          setMetrics(metricsData);
        }
      });

      // Also handle generic message events (fallback)
      eventSource.onmessage = (event: MessageEvent) => {
        const metricsData = parseMetricsData(event.data);
        if (metricsData) {
          setMetrics(metricsData);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        
        // Check the ready state to determine the appropriate status
        if (eventSource?.readyState === EventSource.CLOSED) {
          setConnectionStatus('disconnected');
        } else {
          setConnectionStatus('error');
        }
        
        // Close the current connection
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        
        // Schedule reconnection
        scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      setConnectionStatus('error');
      scheduleReconnect();
    }
  };

  /**
   * Manually trigger a reconnection (resets retry counter)
   */
  const reconnect = () => {
    cleanup();
    retryAttempt = 0;
    connect();
  };

  // Set up connection on mount
  onMount(() => {
    connect();
  });

  // Clean up on unmount
  onCleanup(() => {
    cleanup();
  });

  return {
    metrics,
    connectionStatus,
    reconnect,
  };
}

export default useSSEMetrics;
