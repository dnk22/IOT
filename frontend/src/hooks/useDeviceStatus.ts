import { useEffect, useState } from 'react';
import { useWebSocketContext } from '../app/providers/WebSocketProvider';
import { errorMessage } from '../services/api/client';
import { getDeviceStatus } from '../services/api/statusApi';
import type { DeviceStatus } from '../types/device';

export function useDeviceStatus() {
  const { realtimeStatus } = useWebSocketContext();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    getDeviceStatus(controller.signal)
      .then((status) => {
        setDeviceStatus((current) =>
          !current || status.lastSeenAtMs >= current.lastSeenAtMs ? status : current,
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
    if (realtimeStatus) {
      setDeviceStatus((current) =>
        !current || realtimeStatus.lastSeenAtMs >= current.lastSeenAtMs ? realtimeStatus : current,
      );
      setError(null);
      setIsLoading(false);
    }
  }, [realtimeStatus]);

  return { deviceStatus, isLoading, error };
}
