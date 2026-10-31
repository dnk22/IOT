import { parseDeviceStatus } from '../api/statusApi';
import { parseTelemetry } from '../api/telemetryApi';
import { parseAutomationView } from '../api/automationApi';
import type { WebSocketConnectionState, WebSocketMessage } from '../../types/websocket';

type MessageListener = (message: WebSocketMessage) => void;
type StateListener = (state: WebSocketConnectionState) => void;

function websocketUrl(): string {
  const url = new URL('/ws', window.location.href);
  url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

function parseMessage(raw: string): WebSocketMessage | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const envelope = value as Record<string, unknown>;
    if (envelope.type === 'telemetry') {
      return { type: 'telemetry', data: parseTelemetry(envelope.data) };
    }
    if (envelope.type === 'status') {
      return { type: 'status', data: parseDeviceStatus(envelope.data) };
    }
    if (envelope.type === 'automation') {
      return { type: 'automation', data: parseAutomationView(envelope.data) };
    }
    return null;
  } catch {
    return null;
  }
}

export class RealtimeWebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private stopped = true;
  private readonly messageListeners = new Set<MessageListener>();
  private readonly stateListeners = new Set<StateListener>();

  connect(): void {
    this.stopped = false;
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.emitState('connecting');
    const socket = new WebSocket(websocketUrl());
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.reconnectAttempt = 0;
      this.emitState('connected');
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      const message = parseMessage(event.data);
      if (message) {
        this.messageListeners.forEach((listener) => listener(message));
      }
    });

    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.emitState('disconnected');
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      socket.close();
    });
  }

  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.emitState('disconnected');
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const delayMs = Math.min(1_000 * 2 ** this.reconnectAttempt, 10_000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  private emitState(state: WebSocketConnectionState): void {
    this.stateListeners.forEach((listener) => listener(state));
  }
}
