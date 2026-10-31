interface StatusBadgeProps {
  label: string;
  tone?: 'online' | 'warning' | 'offline' | 'neutral' | 'cyan';
  pulse?: boolean;
}

const tones = {
  online: 'border-secondary/20 bg-secondary/10 text-secondary',
  warning: 'border-tertiary/20 bg-tertiary/10 text-tertiary',
  offline: 'border-error/20 bg-error/10 text-error',
  neutral: 'border-outline-variant/50 bg-surface-high text-on-surface-variant',
  cyan: 'border-primary/20 bg-primary/10 text-primary',
};

const dots = {
  online: 'bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.8)]',
  warning: 'bg-tertiary',
  offline: 'bg-error',
  neutral: 'bg-outline',
  cyan: 'bg-primary shadow-[0_0_8px_rgba(76,215,246,0.7)]',
};

export function StatusBadge({ label, tone = 'neutral', pulse = false }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${tones[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]} ${pulse ? 'animate-pulse' : ''}`} aria-hidden="true" />
      {label}
    </span>
  );
}
