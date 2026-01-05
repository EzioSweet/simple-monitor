/**
 * API configuration using environment variables
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const API_ENDPOINTS = {
  METRICS_CURRENT: `${API_BASE_URL}/metrics/current`,
  METRICS_HISTORY: `${API_BASE_URL}/metrics/history`,
  METRICS_STREAM: `${API_BASE_URL}/metrics/stream`,
} as const;
