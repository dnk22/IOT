import { useEffect, useState } from 'react';
import { useWebSocketContext } from '../app/providers/WebSocketProvider';
import { errorMessage } from '../services/api/client';
import { getLatestTelemetry } from '../services/api/telemetryApi';
import type { TelemetryReading } from '../types/telemetry';

export function useTelemetry() {
  const { realtimeTelemetry } = useWebSocketContext();
  const [telemetry, setTelemetry] = useState<TelemetryReading | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    getLatestTelemetry(controller.signal)
      .then((reading) => {
        setTelemetry((current) =>
          !current || reading.receivedAtMs >= current.receivedAtMs ? reading : current,
        );
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
    if (realtimeTelemetry) {
      setTelemetry((current) =>
        !current || realtimeTelemetry.receivedAtMs >= current.receivedAtMs ? realtimeTelemetry : current,
      );
      setError(null);
      setIsLoading(false);
    }
  }, [realtimeTelemetry]);

  return { telemetry, isLoading, error };
}
