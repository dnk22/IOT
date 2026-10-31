import type { ActuatorState, ControlSource } from '../../types/device';

interface ActuatorControlProps {
  actuator: ActuatorState;
  enabled: boolean | null;
  pending: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
  source: ControlSource | null;
  manualOverride: boolean;
  onResumeAutomation: () => void;
}

export function ActuatorControl({ actuator, enabled, pending, disabled, onChange, source, manualOverride, onResumeAutomation }: ActuatorControlProps) {
  const isFan = actuator.id === 'fan';
  const controlsDisabled = disabled || pending || enabled === null;

  return (
    <div className={`rounded-panel border bg-surface-container p-3 transition-colors ${enabled ? 'border-secondary/35' : 'border-transparent'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-high ${enabled ? 'text-secondary' : 'text-outline'}`}>
            <span className={`material-symbols-outlined text-[22px] ${enabled && isFan ? 'animate-spin' : ''}`} aria-hidden="true">
              {isFan ? 'mode_fan' : enabled ? 'volume_up' : 'volume_off'}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-on-surface">{actuator.name}</h3>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
              Relay {actuator.relayChannel} · GPIO {actuator.gpio}
            </p>
          </div>
        </div>
        <span className={`rounded px-2 py-1 font-mono text-[10px] font-semibold ${pending ? 'bg-tertiary/10 text-tertiary' : enabled === null ? 'bg-surface-high text-outline' : enabled ? 'bg-secondary/10 text-secondary' : 'bg-surface-high text-outline'}`}>
          {pending ? 'ĐANG GỬI' : enabled === null ? '--' : enabled ? 'ON' : 'OFF'}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 rounded bg-surface-lowest p-1">
        <button
          type="button"
          aria-pressed={enabled === true}
          disabled={controlsDisabled || (enabled === true && source !== 'AUTOMATION')}
          onClick={() => onChange(true)}
          className={`control-button disabled:cursor-not-allowed disabled:opacity-55 ${enabled === true ? 'bg-secondary text-[#003824] shadow-emerald' : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">power_settings_new</span>
          ON
        </button>
        <button
          type="button"
          aria-pressed={enabled === false}
          disabled={controlsDisabled || (enabled === false && source !== 'AUTOMATION')}
          onClick={() => onChange(false)}
          className={`control-button disabled:cursor-not-allowed disabled:opacity-55 ${enabled === false ? 'bg-surface-high text-primary' : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">power_off</span>
          OFF
        </button>
      </div>
      {manualOverride && (
        <button type="button" disabled={disabled || pending} onClick={onResumeAutomation} className="control-button mt-2 w-full border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">autorenew</span>
          Tiếp tục Automation
        </button>
      )}
    </div>
  );
}
