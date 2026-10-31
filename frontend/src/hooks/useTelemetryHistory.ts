import { useEffect, useState } from 'react';
import { useWebSocketContext } from '../app/providers/WebSocketProvider';
import { errorMessage } from '../services/api/client';
import { getRecentTelemetry } from '../services/api/telemetryApi';
import { MAX_CHART_POINTS, type TelemetryHistoryPoint } from '../types/telemetry';

function mergeChronologically(points: TelemetryHistoryPoint[]): TelemetryHistoryPoint[] {
  const byTimestamp = new Map<number, TelemetryHistoryPoint>();
  points.forEach((point) => byTimestamp.set(point.receivedAtMs, point));
  return [...byTimestamp.values()]
    .sort((left, right) => left.receivedAtMs - right.receivedAtMs)
    .slice(-MAX_CHART_POINTS);
}

export function useTelemetryHistory() {
  const { realtimeTelemetry } = useWebSocketContext();
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    getRecentTelemetry(MAX_CHART_POINTS, controller.signal)
      .then((items) => {
        setHistory((current) => mergeChronologically([...items, ...current]));
        setError(null);
      })
      .catch((caught: unknown) => {
        const message = errorMessage(caught);
        if (message) setError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!realtimeTelemetry) return;
    setHistory((current) => mergeChronologically([...current, realtimeTelemetry]));
  }, [realtimeTelemetry]);

  return { history, isLoading, error };
}
