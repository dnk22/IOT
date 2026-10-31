interface LightCardProps {
  value: number | null;
  ema: number | null;
}

export function LightCard({ value, ema }: LightCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-heading">
        <span className="material-symbols-outlined text-[20px] text-tertiary" aria-hidden="true">light_mode</span>
        <span>Cảm biến ánh sáng</span>
        <span className={`ml-auto h-1.5 w-1.5 rounded-full ${value === null ? 'bg-error' : 'bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.8)]'}`} />
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="metric-value">{value ?? '--'}</span>
        <span className="metric-unit">ADC</span>
      </div>
      <div className="metric-footer">
        <span className="rounded bg-surface-lowest px-1.5 py-0.5 text-outline">Trung bình: {ema === null ? '--' : ema.toFixed(0)} · 0–4095</span>
      </div>
    </article>
  );
}
