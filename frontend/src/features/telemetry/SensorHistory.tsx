import { LoadingState } from '../../components/common/LoadingState';
import { useTelemetryHistory } from '../../hooks/useTelemetryHistory';
import { HumidityChart } from './HumidityChart';
import { LightChart } from './LightChart';
import { TemperatureChart } from './TemperatureChart';

export default function SensorHistory() {
  const { history, isLoading, error } = useTelemetryHistory();

  return (
    <section className="panel p-3 sm:p-4" aria-labelledby="sensor-history-title">
      <div className="flex flex-col gap-3 border-b border-outline-variant/25 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="section-title-row">
            <span className="material-symbols-outlined text-[21px] text-primary" aria-hidden="true">monitoring</span>
            <h2 id="sensor-history-title" className="section-title">Dữ liệu cảm biến thời gian thực</h2>
          </div>
        </div>
      </div>
      {error && <p className="mt-3 rounded border border-error/25 bg-error/5 px-3 py-2 font-mono text-[10px] text-error" role="alert">Dữ liệu: {error}</p>}
      {isLoading && history.length === 0 ? (
        <div className="mt-3"><LoadingState /></div>
      ) : (
        <>
          {isLoading && <p className="mt-3 font-mono text-[9px] uppercase tracking-wider text-tertiary">Đang tải dữ liệu gần nhất…</p>}
          {history.length === 0 && !error && <p className="mt-3 rounded bg-surface-lowest px-3 py-6 text-center font-mono text-[10px] text-outline">Chưa có dữ liệu cảm biến.</p>}
          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <HumidityChart data={history} />
            <LightChart data={history} />
          </div>
          <div className="mt-3"><TemperatureChart data={history} /></div>
        </>
      )}
    </section>
  );
}
