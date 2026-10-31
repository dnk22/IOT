interface BuzzerStatusCardProps {
  enabled: boolean | null;
}

export function BuzzerStatusCard({ enabled }: BuzzerStatusCardProps) {
  return (
    <article className={`metric-card ${enabled === true ? 'border-error/40 shadow-[0_0_18px_-7px_rgba(255,180,171,0.35)]' : ''}`}>
      <div className="metric-heading">
        <span className={`material-symbols-outlined text-[19px] ${enabled ? 'text-error' : 'text-outline'}`} aria-hidden="true">{enabled ? 'volume_up' : 'volume_off'}</span>
        <span>Còi</span>
        <span className={`ml-auto rounded px-1.5 py-0.5 ${enabled === null ? 'bg-surface-high text-outline' : enabled ? 'bg-error/10 text-error' : 'bg-surface-high text-outline'}`}>
          {enabled === null ? '--' : enabled ? 'ON' : 'OFF'}
        </span>
      </div>
      <p className={`mt-5 font-mono text-2xl font-medium tracking-tight ${enabled ? 'text-error' : 'text-on-surface-variant'}`}>
        {enabled === null ? 'CHƯA XÁC ĐỊNH' : enabled ? 'ĐANG CẢNH BÁO' : 'IM LẶNG'}
      </p>
    </article>
  );
}
