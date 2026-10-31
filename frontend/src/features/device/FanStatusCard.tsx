interface FanStatusCardProps {
  enabled: boolean | null;
}

export function FanStatusCard({ enabled }: FanStatusCardProps) {
  return (
    <article className={`metric-card ${enabled === true ? 'border-secondary/40 shadow-emerald' : ''}`}>
      <div className="metric-heading">
        <span className={`material-symbols-outlined text-[19px] ${enabled ? 'animate-spin text-secondary' : 'text-outline'}`} aria-hidden="true">mode_fan</span>
        <span>Trạng thái quạt</span>
        <span className={`ml-auto rounded px-1.5 py-0.5 ${enabled === null ? 'bg-surface-high text-outline' : enabled ? 'bg-secondary/10 text-secondary' : 'bg-surface-high text-outline'}`}>
          {enabled === null ? '--' : enabled ? 'ON' : 'OFF'}
        </span>
      </div>
      <p className={`mt-5 font-mono text-2xl font-medium tracking-tight ${enabled ? 'text-secondary' : 'text-on-surface-variant'}`}>
        {enabled === null ? 'CHƯA XÁC ĐỊNH' : enabled ? 'ĐANG CHẠY' : 'ĐANG TẮT'}
      </p>
    </article>
  );
}
