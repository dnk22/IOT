import type { DeviceStatus } from '../../types/device';
import { StatusBadge } from '../common/StatusBadge';
import { Toggle } from '../common/Toggle';

interface DashboardHeaderProps {
  status: DeviceStatus | null;
  controlsVisible: boolean;
  onControlsVisibleChange: (visible: boolean) => void;
}

export function DashboardHeader({
  status,
  controlsVisible,
  onControlsVisibleChange,
}: DashboardHeaderProps) {
  const presence = status?.presence ?? 'UNKNOWN';
  const presenceTone = presence === 'ONLINE' ? 'online' : presence === 'OFFLINE' ? 'offline' : 'warning';
  const mqttConnected = status?.mqttConnected === true;
  const presenceLabel = presence === 'ONLINE'
    ? 'Thiết bị trực tuyến'
    : presence === 'OFFLINE'
      ? 'Thiết bị ngoại tuyến'
      : 'Chưa xác định thiết bị';

  return (
    <header className="panel mb-4 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 rounded border border-primary/15 bg-primary/5 px-2.5 py-1.5 text-primary">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">memory</span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">{status?.deviceId ?? 'esp32_01'}</span>
          </div>
          <StatusBadge
            label={presenceLabel}
            tone={presenceTone}
            pulse={presence === 'ONLINE'}
          />
          <span className="hidden h-4 w-px bg-outline-variant/70 sm:block" />
          <StatusBadge
            label={`MQTT ${mqttConnected ? 'đã kết nối' : 'mất kết nối'}`}
            tone={mqttConnected ? 'cyan' : 'offline'}
          />
          <span className="hidden h-4 w-px bg-outline-variant/70 sm:block" />
          <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-on-surface-variant">
            <span className="material-symbols-outlined text-[19px] text-primary" aria-hidden="true">wifi</span>
            {status?.wifiSsid ?? 'Chưa kết nối'}
            <strong className={status?.wifiRssiDbm === null || status?.wifiRssiDbm === undefined ? 'text-outline' : 'text-secondary'}>
              ({status?.wifiRssiDbm ?? '--'} dBm)
            </strong>
          </span>
        </div>
        <label className="flex items-center gap-2 font-mono text-[10px] tracking-wide text-on-surface-variant">
          <span>Hiện khu vực điều khiển</span>
          <Toggle
            checked={controlsVisible}
            onChange={onControlsVisibleChange}
            label="Hiện khu vực điều khiển thủ công và tự động hóa"
          />
        </label>
      </div>
    </header>
  );
}
