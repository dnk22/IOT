interface HumidityCardProps {
  value: number | null;
  ema: number | null;
  valid: boolean;
}

export function HumidityCard({ value, ema, valid }: HumidityCardProps) {
  const available = valid && value !== null;
  return (
    <article className="metric-card">
      <div className="metric-heading">
        <span className="material-symbols-outlined text-[19px] text-primary" aria-hidden="true">water_drop</span>
        <span>Độ ẩm</span>
        <span className={`ml-auto h-1.5 w-1.5 rounded-full ${available ? 'bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.8)]' : 'bg-error'}`} />
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="metric-value">{available ? value.toFixed(1) : '--'}</span>
        <span className="metric-unit">%</span>
      </div>
      <div className="metric-footer">
        <span className="rounded bg-surface-lowest px-1.5 py-0.5 text-outline">Trung bình: {ema === null ? '--' : `${ema.toFixed(1)}%`}</span>
      </div>
    </article>
  );
}
