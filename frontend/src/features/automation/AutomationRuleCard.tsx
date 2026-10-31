import type { AutomationRule } from '../../types/automation';
import { Toggle } from '../../components/common/Toggle';

interface AutomationRuleCardProps {
  index: number;
  rule: AutomationRule;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
}

const sensorIcons = {
  TEMPERATURE: 'device_thermostat',
  HUMIDITY: 'water_drop',
  LIGHT: 'light_mode',
};

const actionIcons = {
  FAN: 'mode_fan',
  BUZZER: 'notifications_active',
};

const sensorLabels = {
  TEMPERATURE: 'Nhiệt độ',
  HUMIDITY: 'Độ ẩm',
  LIGHT: 'Ánh sáng',
};

const actuatorLabels = {
  FAN: 'Quạt',
  BUZZER: 'Còi',
};

const runtimeLabels = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Không hoạt động',
  RELEASING: 'Chờ ngắt',
  DISABLED: 'Đã tắt',
  UNKNOWN: 'Chưa xác định',
};

const runtimeClasses = {
  ACTIVE: 'bg-secondary/10 text-secondary',
  INACTIVE: 'bg-primary/10 text-primary',
  RELEASING: 'bg-tertiary/10 text-tertiary',
  DISABLED: 'bg-surface-high text-outline',
  UNKNOWN: 'bg-tertiary/10 text-tertiary',
};

export function AutomationRuleCard({ index, rule, saving, onToggle, onEdit }: AutomationRuleCardProps) {
  const operational = rule.runtimeState === 'ACTIVE';

  return (
    <article
      tabIndex={0}
      aria-label={'Quy tắc ' + rule.name + '. Nhấp đúp để chỉnh sửa.'}
      title="Nhấp đúp để chỉnh sửa quy tắc"
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest('button')) {
          return;
        }
        onEdit();
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && event.key === 'Enter') {
          onEdit();
        }
      }}
      className={`rounded-panel border bg-surface-container p-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        operational ? 'border-primary/25 hover:border-primary/55' : 'border-outline-variant/40 opacity-75 hover:border-outline'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-on-surface">
            #{index + 1} · {rule.name}
          </h3>
          <span className={'rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ' + runtimeClasses[rule.runtimeState]}>
            {runtimeLabels[rule.runtimeState]}
          </span>
        </div>
        <Toggle checked={rule.enabled} onChange={onToggle} disabled={saving} label={`Bật tắt quy tắc ${rule.name}`} />
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch rounded border border-outline-variant/30 bg-surface-lowest/80">
        <div className="min-w-0 p-2.5">
          <span className="flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-outline">
            <span className="material-symbols-outlined text-[14px] text-tertiary" aria-hidden="true">{sensorIcons[rule.condition.sensor]}</span>
            Điều kiện
          </span>
          <p className="mt-1.5 break-words font-mono text-[10px] text-on-surface">
            {sensorLabels[rule.condition.sensor]} {rule.condition.operator}{' '}
            <strong className="text-tertiary">{rule.condition.threshold.toFixed(rule.condition.unit === 'ADC' ? 0 : 1)} {rule.condition.unit}</strong>
          </p>
        </div>
        <div className="flex items-center border-x border-outline-variant/30 px-2 text-primary">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
        </div>
        <div className="min-w-0 p-2.5">
          <span className="flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-outline">
            <span className="material-symbols-outlined text-[14px] text-secondary" aria-hidden="true">{actionIcons[rule.action.actuator]}</span>
            Hành động
          </span>
          <p className="mt-1.5 break-words font-mono text-[10px] text-secondary">
            {actuatorLabels[rule.action.actuator]} <strong>{rule.action.state === 'ON' ? 'BẬT' : 'TẮT'}</strong>
          </p>
        </div>
      </div>
      <p className="mt-2 text-right font-mono text-[8px] uppercase tracking-wider text-outline">Nhấp đúp để chỉnh sửa</p>
    </article>
  );
}
