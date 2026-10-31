import type { DevicePresence } from "../../../shared/src/types/mqtt.js";

import type {
  StatusRepository,
  StatusView,
} from "../repositories/statusRepository.js";

export interface PresenceBroadcaster {
  broadcastStatus(data: StatusView): void;
}

type Availability = Exclude<DevicePresence, "UNKNOWN"> | null;

const WATCH_INTERVAL_MS = 2_000;

export class DevicePresenceService {
  private mqttConnected = false;
  private availability: Availability = null;
  private availabilityObservedAtMs = 0;
  private runtimeLastSeenAtMs = 0;
  private lastBroadcastState: string | null = null;
  private watcher: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(
    private readonly deviceId: string,
    private readonly offlineTimeoutMs: number,
    private readonly repository: StatusRepository,
    private readonly broadcaster: PresenceBroadcaster,
  ) {}

  start(): void {
    if (this.watcher) return;
    this.watcher = setInterval(() => this.checkLiveness(), WATCH_INTERVAL_MS);
    this.watcher.unref();
  }

  stop(): void {
    if (!this.watcher) return;
    clearInterval(this.watcher);
    this.watcher = null;
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
  }

  setMqttConnected(connected: boolean, nowMs = Date.now()): void {
    if (this.disposed) return;
    if (this.mqttConnected === connected) return;
    this.mqttConnected = connected;
    if (!connected) {
      this.availability = null;
      this.availabilityObservedAtMs = 0;
    }
    this.broadcastIfStateChanged(nowMs);
  }

  handleAvailability(availability: Exclude<DevicePresence, "UNKNOWN">, nowMs = Date.now()): void {
    if (this.disposed) return;
    this.availability = availability;
    this.availabilityObservedAtMs = availability === "ONLINE" ? nowMs : 0;
    this.repository.setAvailabilityOnline(this.deviceId, availability === "ONLINE");
    this.broadcastIfStateChanged(nowMs);
  }

  noteDeviceActivity(receivedAtMs = Date.now(), alreadyPersisted = false): void {
    if (this.disposed) return;
    this.runtimeLastSeenAtMs = Math.max(this.runtimeLastSeenAtMs, receivedAtMs);
    if (!alreadyPersisted) {
      this.repository.touchLastSeen(this.deviceId, receivedAtMs);
    }
    this.broadcastIfStateChanged(receivedAtMs);
  }

  statusUpdated(receivedAtMs: number): StatusView {
    this.noteDeviceActivity(receivedAtMs, true);
    const view = this.getView(receivedAtMs);
    this.broadcaster.broadcastStatus(view);
    this.lastBroadcastState = this.stateKey(view);
    return view;
  }

  checkLiveness(nowMs = Date.now()): void {
    if (this.disposed) return;
    this.broadcastIfStateChanged(nowMs);
  }

  getView(nowMs = Date.now()): StatusView {
    const persisted = this.repository.findByDeviceId(this.deviceId);
    const lastSeenAtMs = Math.max(persisted?.lastSeenAtMs ?? 0, this.runtimeLastSeenAtMs);
    const presence = this.computePresence(lastSeenAtMs, nowMs);
    return {
      deviceId: this.deviceId,
      online: presence === "ONLINE",
      presence,
      mqttConnected: this.mqttConnected,
      wifiSsid: persisted?.wifiSsid ?? null,
      ipAddress: persisted?.ipAddress ?? null,
      wifiRssiDbm: persisted?.wifiRssiDbm ?? null,
      uptimeMs: persisted?.uptimeMs ?? 0,
      firmwareVersion: persisted?.firmwareVersion ?? null,
      fanOn: persisted?.fanOn ?? null,
      buzzerOn: persisted?.buzzerOn ?? null,
      fanSource: persisted?.fanSource ?? null,
      buzzerSource: persisted?.buzzerSource ?? null,
      fanActiveRuleId: persisted?.fanActiveRuleId ?? null,
      buzzerActiveRuleId: persisted?.buzzerActiveRuleId ?? null,
      automationConfigVersion: persisted?.automationConfigVersion ?? 0,
      automationEnabled: persisted?.automationEnabled ?? false,
      fanManualOverride: persisted?.fanManualOverride ?? false,
      buzzerManualOverride: persisted?.buzzerManualOverride ?? false,
      ruleStates: persisted?.ruleStates ?? [],
      lastSeenAtMs,
    };
  }

  findByDeviceId(deviceId: string): StatusView | null {
    return deviceId === this.deviceId ? this.getView() : null;
  }

  private computePresence(lastSeenAtMs: number, nowMs: number): DevicePresence {
    if (!this.mqttConnected) return "UNKNOWN";
    if (this.availability === "OFFLINE") return "OFFLINE";

    const latestEvidenceAtMs = Math.max(lastSeenAtMs, this.availabilityObservedAtMs);
    if (this.availability === "ONLINE") {
      return nowMs - latestEvidenceAtMs <= this.offlineTimeoutMs ? "ONLINE" : "OFFLINE";
    }
    if (lastSeenAtMs === 0) return "UNKNOWN";
    return nowMs - lastSeenAtMs <= this.offlineTimeoutMs ? "ONLINE" : "OFFLINE";
  }

  private broadcastIfStateChanged(nowMs: number): void {
    const view = this.getView(nowMs);
    const state = this.stateKey(view);
    if (state === this.lastBroadcastState) return;
    this.lastBroadcastState = state;
    this.broadcaster.broadcastStatus(view);
  }

  private stateKey(view: StatusView): string {
    return `${view.presence}:${view.mqttConnected}`;
  }
}
