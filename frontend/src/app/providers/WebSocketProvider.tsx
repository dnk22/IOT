import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RealtimeWebSocketClient } from '../../services/websocket/websocketClient';
import type { DeviceStatus } from '../../types/device';
import type { TelemetryReading } from '../../types/telemetry';
import type { AutomationView } from '../../types/automation';
import type { WebSocketConnectionState } from '../../types/websocket';

interface WebSocketContextValue {
  connectionState: WebSocketConnectionState;
  realtimeStatus: DeviceStatus | null;
  realtimeTelemetry: TelemetryReading | null;
  realtimeAutomation: AutomationView | null;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: PropsWithChildren) {
  const clientRef = useRef<RealtimeWebSocketClient | null>(null);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>('connecting');
  const [realtimeStatus, setRealtimeStatus] = useState<DeviceStatus | null>(null);
  const [realtimeTelemetry, setRealtimeTelemetry] = useState<TelemetryReading | null>(null);
  const [realtimeAutomation, setRealtimeAutomation] = useState<AutomationView | null>(null);

  if (!clientRef.current) {
    clientRef.current = new RealtimeWebSocketClient();
  }

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    const removeStateListener = client.onState(setConnectionState);
    const removeMessageListener = client.onMessage((message) => {
      if (message.type === 'status') setRealtimeStatus(message.data);
      if (message.type === 'telemetry') setRealtimeTelemetry(message.data);
      if (message.type === 'automation') setRealtimeAutomation(message.data);
    });
    client.connect();

    return () => {
      removeStateListener();
      removeMessageListener();
      client.disconnect();
    };
  }, []);

  const value = useMemo(
    () => ({ connectionState, realtimeStatus, realtimeTelemetry, realtimeAutomation }),
    [connectionState, realtimeStatus, realtimeTelemetry, realtimeAutomation],
  );

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocketContext must be used inside WebSocketProvider.');
  return context;
}
