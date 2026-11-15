import type { DeviceStatus } from '../../types/device';
import type { TelemetryReading } from '../../types/telemetry';
import { BuzzerStatusCard } from '../device/BuzzerStatusCard';
import { FanStatusCard } from '../device/FanStatusCard';
import { HumidityCard } from './HumidityCard';
import { LightCard } from './LightCard';
import { TemperatureCard } from './TemperatureCard';

interface SensorCardsProps {
  telemetry: TelemetryReading | null;
  device: DeviceStatus | null;
  telemetryError: string | null;
  controlsVisible: boolean;
}

export function SensorCards({
  telemetry,
  device,
  telemetryError,
  controlsVisible,
}: SensorCardsProps) {
  return (
    <section aria-label="Trạng thái thời gian thực">
      {telemetryError && (
        <p className="mb-3 rounded border border-error/25 bg-error/5 px-3 py-2 font-mono text-[10px] text-error" role="alert">
          Dữ liệu cảm biến mới nhất: {telemetryError}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <TemperatureCard
          value={telemetry?.temperatureC ?? null}
          ema={telemetry?.temperatureEma ?? null}
          valid={telemetry?.dhtValid ?? false}
          receivedAtMs={telemetry?.receivedAtMs ?? null}
        />
        <HumidityCard value={telemetry?.humidityPct ?? null} ema={telemetry?.humidityEma ?? null} valid={telemetry?.dhtValid ?? false} />
        <LightCard value={telemetry?.lightRaw ?? null} ema={telemetry?.lightEma ?? null} />
        {controlsVisible && <FanStatusCard enabled={device?.fanOn ?? null} />}
        {controlsVisible && <BuzzerStatusCard enabled={device?.buzzerOn ?? null} />}
      </div>
    </section>
  );
}
