import type { DeviceStatus } from '../../types/device';
import { formatUptime } from '../../utils/formatUptime';

interface DeviceCardProps {
  device: DeviceStatus | null;
}

export function DeviceCard({ device }: DeviceCardProps) {
  const presence = device?.presence ?? 'UNKNOWN';
  const presenceClass = presence === 'ONLINE'
    ? 'bg-secondary/10 text-secondary'
    : presence === 'OFFLINE'
      ? 'bg-error/10 text-error'
      : 'bg-tertiary/10 text-tertiary';
  const presenceLabel = presence === 'ONLINE' ? 'TRỰC TUYẾN' : presence === 'OFFLINE' ? 'NGOẠI TUYẾN' : 'CHƯA XÁC ĐỊNH';
  return (
    <article className="metric-card">
      <div className="metric-heading">
        <span className="material-symbols-outlined text-[19px] text-primary" aria-hidden="true">memory</span>
        <span>Thiết bị ESP32</span>
        <span className={`ml-auto rounded px-1.5 py-0.5 ${presenceClass}`}>
          {presenceLabel}
        </span>
      </div>
      <p className="mt-4 font-mono text-lg font-semibold text-on-surface">{device?.ipAddress ?? '--'}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
        Uptime: {device ? formatUptime(device.uptimeMs) : '--'} · Firmware: {device?.firmwareVersion ?? '--'}
      </p>
    </article>
  );
}
