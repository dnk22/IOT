import { useEffect, useId, useRef, useState } from 'react';
import { Toggle } from '../../components/common/Toggle';
import type {
  AutomationActionState,
  AutomationActuator,
  AutomationCapabilities,
  AutomationRule,
  AutomationRuleInput,
  AutomationSensor,
  ComparisonOperator,
} from '../../types/automation';

interface AutomationRuleModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  rule: AutomationRule | null;
  ruleNumber: number | null;
  capabilities: AutomationCapabilities | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: AutomationRuleInput) => void;
  onDelete: () => void;
}

interface DraftState {
  name: string;
  enabled: boolean;
  sensor: AutomationSensor;
  operator: ComparisonOperator;
  threshold: string;
  actionEntity: AutomationActuator;
  actionState: AutomationActionState;
}

interface ValidationErrors {
  name?: string;
  threshold?: string;
}

const createDraft: DraftState = {
  name: '',
  enabled: true,
  sensor: 'TEMPERATURE',
  operator: '>=',
  threshold: '30.0',
  actionEntity: 'FAN',
  actionState: 'ON',
};

function toDraftState(rule: AutomationRule | null): DraftState {
  if (!rule) {
    return createDraft;
  }

  return {
    name: rule.name,
    enabled: rule.enabled,
    sensor: rule.condition.sensor,
    operator: rule.condition.operator,
    threshold: rule.condition.threshold.toString(),
    actionEntity: rule.action.actuator,
    actionState: rule.action.state,
  };
}

export function AutomationRuleModal({
  open,
  mode,
  rule,
  ruleNumber,
  capabilities,
  saving,
  onClose,
  onSave,
  onDelete,
}: AutomationRuleModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<DraftState>(createDraft);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const selectedSensor = capabilities?.sensors.find((option) => option.value === draft.sensor) ?? capabilities?.sensors[0];
  const selectedActuator = capabilities?.actuators.find((option) => option.value === draft.actionEntity) ?? capabilities?.actuators[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === 'edit' && rule) {
      setDraft(toDraftState(rule));
    } else if (capabilities) {
      const sensor = capabilities.sensors[0];
      const actuator = capabilities.actuators[0];
      if (sensor && actuator && actuator.actions[0]) {
        setDraft({
          name: '',
          enabled: true,
          sensor: sensor.value,
          operator: capabilities.operators[0] ?? '>=',
          threshold: String(Math.min(sensor.max, Math.max(sensor.min, sensor.value === 'TEMPERATURE' ? 30 : sensor.min))),
          actionEntity: actuator.value,
          actionState: actuator.actions[0],
        });
      }
    }
    setErrors({});
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [capabilities, mode, onClose, open, rule]);

  if (!open || !capabilities || !selectedSensor || !selectedActuator) {
    return null;
  }

  const updateSensor = (sensor: AutomationSensor) => {
    setDraft((current) => ({ ...current, sensor }));
    setErrors((current) => ({ ...current, threshold: undefined }));
  };

  const validate = () => {
    const nextErrors: ValidationErrors = {};
    const threshold = Number(draft.threshold);

    if (!draft.name.trim()) {
      nextErrors.name = 'Vui lòng nhập tên quy tắc';
    }
    if (draft.threshold.trim() === '' || !Number.isFinite(threshold)) {
      nextErrors.threshold = 'Vui lòng nhập ngưỡng hợp lệ';
    } else if (threshold < selectedSensor.min || threshold > selectedSensor.max) {
      nextErrors.threshold = `Ngưỡng phải từ ${selectedSensor.min} đến ${selectedSensor.max} ${selectedSensor.unit}`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    onSave({
      name: draft.name.trim(),
      enabled: draft.enabled,
      condition: {
        sensor: draft.sensor,
        operator: draft.operator,
        threshold: Number(draft.threshold),
      },
      action: {
        actuator: draft.actionEntity,
        state: draft.actionState,
      },
    });
  };

  const nameClass = 'w-full rounded border bg-surface-lowest py-2 pl-8 pr-3 font-mono text-xs text-on-surface outline-none transition placeholder:text-outline/60 focus:border-primary focus:ring-1 focus:ring-primary/20 ' +
    (errors.name ? 'border-error ring-1 ring-error/15' : 'border-outline-variant/55');
  const thresholdClass = 'mt-1 flex items-center rounded border bg-surface-lowest px-2.5 transition focus-within:ring-1 ' +
    (errors.threshold ? 'border-error ring-1 ring-error/15' : 'border-outline-variant/55 focus-within:border-primary focus-within:ring-primary/20');

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-lowest/85 p-3 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-panel border border-primary/40 bg-[#0c1527] shadow-cyan"
      >
        <header className="flex items-center justify-between border-b border-outline-variant/45 bg-surface-high/80 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-primary/30 bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">tune</span>
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 id={titleId} className="text-sm font-semibold tracking-tight text-on-surface sm:text-base">
                {mode === 'create' ? 'THÊM QUY TẮC TỰ ĐỘNG' : 'CẤU HÌNH QUY TẮC TỰ ĐỘNG'}
              </h2>
              {mode === 'edit' && ruleNumber !== null && (
                <span className="rounded border border-secondary/30 bg-secondary/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-secondary">
                  QUY TẮC #{String(ruleNumber).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng trình chỉnh sửa quy tắc"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-outline-variant/40 bg-surface-container text-on-surface-variant transition hover:bg-surface-highest hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <p id={descriptionId} className="sr-only">
              Biểu mẫu {mode === 'create' ? 'thêm' : 'chỉnh sửa'} một quy tắc tự động gồm một điều kiện và một hành động.
            </p>

            <div className="grid gap-3 md:grid-cols-12 md:items-start">
              <label className="block md:col-span-8">
                <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">Tên quy tắc</span>
                <span className="relative mt-1.5 flex items-center">
                  <span className="material-symbols-outlined pointer-events-none absolute left-2.5 text-[16px] text-outline" aria-hidden="true">label</span>
                  <input
                    ref={nameInputRef}
                    disabled={saving}
                    value={draft.name}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, name: event.target.value }));
                      setErrors((current) => ({ ...current, name: undefined }));
                    }}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? titleId + '-name-error' : undefined}
                    placeholder="Ví dụ: Tự động bật quạt làm mát"
                    className={nameClass}
                  />
                </span>
                {errors.name && <span id={titleId + '-name-error'} className="mt-1 block font-mono text-[9px] text-error" role="alert">{errors.name}</span>}
              </label>

              <div className="md:col-span-4">
                <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">Kích hoạt quy tắc</span>
                <div className="mt-1.5 flex items-center justify-between rounded border border-outline-variant/55 bg-surface-lowest px-3 py-1.5">
                  <span className={'flex items-center gap-1.5 font-mono text-[10px] font-semibold ' + (draft.enabled ? 'text-secondary' : 'text-outline')}>
                    <span className={'h-2 w-2 rounded-full ' + (draft.enabled ? 'bg-secondary shadow-emerald' : 'bg-outline')} />
                    {draft.enabled ? 'Đang bật' : 'Tạm dừng'}
                  </span>
                  <Toggle checked={draft.enabled} disabled={saving} onChange={(enabled) => setDraft((current) => ({ ...current, enabled }))} label="Kích hoạt quy tắc" />
                </div>
                <span className="mt-1 block font-mono text-[9px] leading-3 text-outline">Quy tắc chỉ được đánh giá khi đang bật</span>
              </div>
            </div>

            <div className="grid items-stretch gap-2 rounded-panel border border-outline-variant/35 bg-surface-lowest/90 p-2 md:grid-cols-[1fr_auto_1fr]">
              <fieldset className="min-w-0 rounded border border-tertiary/25 bg-surface-container p-3">
                <legend className="sr-only">Điều kiện</legend>
                <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 pb-2">
                  <span className="flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-outline">
                    <span className="material-symbols-outlined text-[15px] text-tertiary" aria-hidden="true">thermostat</span>
                    Điều kiện (IF)
                  </span>
                  <span className="font-mono text-[9px] text-primary">Dữ liệu cảm biến</span>
                </div>

                <label className="mt-3 block">
                  <span className="font-mono text-[9px] text-on-surface-variant">Cảm biến nguồn</span>
                  <select value={draft.sensor} onChange={(event) => updateSensor(event.target.value as AutomationSensor)} disabled={saving} className="mt-1 w-full rounded border border-outline-variant/55 bg-surface-lowest px-2.5 py-2 font-mono text-[11px] text-on-surface outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50">
                    {capabilities.sensors.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label>
                    <span className="font-mono text-[9px] text-on-surface-variant">Toán tử</span>
                    <select value={draft.operator} onChange={(event) => setDraft((current) => ({ ...current, operator: event.target.value as ComparisonOperator }))} disabled={saving} className="mt-1 w-full rounded border border-outline-variant/55 bg-surface-lowest px-2.5 py-2 font-mono text-[11px] font-semibold text-on-surface outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20">
                      {capabilities.operators.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                    </select>
                  </label>

                  <label>
                    <span className="font-mono text-[9px] text-on-surface-variant">Ngưỡng</span>
                    <span className={thresholdClass}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step={selectedSensor.step}
                        min={selectedSensor.min}
                        max={selectedSensor.max}
                        disabled={saving}
                        value={draft.threshold}
                        onChange={(event) => {
                          setDraft((current) => ({ ...current, threshold: event.target.value }));
                          setErrors((current) => ({ ...current, threshold: undefined }));
                        }}
                        aria-invalid={Boolean(errors.threshold)}
                        aria-describedby={errors.threshold ? titleId + '-threshold-error' : undefined}
                        className="min-w-0 flex-1 bg-transparent py-2 font-mono text-[11px] font-bold text-tertiary outline-none"
                      />
                      <span className="shrink-0 font-mono text-[9px] text-outline">{selectedSensor.unit}</span>
                    </span>
                  </label>
                </div>
                {errors.threshold && <span id={titleId + '-threshold-error'} className="mt-1 block font-mono text-[9px] text-error" role="alert">{errors.threshold}</span>}
              </fieldset>

              <div className="flex items-center justify-center py-1 text-primary md:px-1 md:py-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/35 bg-surface-high shadow-cyan">
                  <span className="material-symbols-outlined rotate-90 text-[18px] md:rotate-0" aria-hidden="true">arrow_forward</span>
                </span>
              </div>

              <fieldset className="min-w-0 rounded border border-secondary/25 bg-surface-container p-3">
                <legend className="sr-only">Hành động</legend>
                <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 pb-2">
                  <span className="flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-outline">
                    <span className="material-symbols-outlined text-[15px] text-secondary" aria-hidden="true">bolt</span>
                    Hành động (THEN)
                  </span>
                  <span className="font-mono text-[9px] text-secondary">Thiết bị đích</span>
                </div>

                <label className="mt-3 block">
                  <span className="font-mono text-[9px] text-on-surface-variant">Cơ cấu chấp hành</span>
                  <select value={draft.actionEntity} onChange={(event) => setDraft((current) => ({ ...current, actionEntity: event.target.value as AutomationActuator }))} disabled={saving} className="mt-1 w-full rounded border border-outline-variant/55 bg-surface-lowest px-2.5 py-2 font-mono text-[11px] text-on-surface outline-none transition focus:border-secondary focus:ring-1 focus:ring-secondary/20">
                    {capabilities.actuators.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-outline">Relay {selectedActuator.relayChannel} · GPIO{selectedActuator.gpio}</span>
                </label>

                <div className="mt-2">
                  <span className="font-mono text-[9px] text-on-surface-variant">Lệnh thực thi</span>
                  <div className="mt-1 grid grid-cols-2 gap-1 rounded border border-outline-variant/55 bg-surface-lowest p-1">
                    {selectedActuator.actions.map((state) => {
                      const selected = draft.actionState === state;
                      const buttonClass = 'control-button min-h-8 py-1.5 ' +
                        (selected ? 'bg-secondary text-[#003824]' : 'text-on-surface-variant hover:bg-surface-high');
                      return (
                        <button key={state} type="button" disabled={saving} aria-pressed={selected} onClick={() => setDraft((current) => ({ ...current, actionState: state }))} className={buttonClass}>
                          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">{state === 'ON' ? 'power_settings_new' : 'power_off'}</span>
                          {state === 'ON' ? 'BẬT (ON)' : 'TẮT (OFF)'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </fieldset>
            </div>

            <aside className="flex items-start gap-2 rounded border border-tertiary/25 bg-tertiary/5 px-3 py-2">
              <span className="material-symbols-outlined mt-0.5 text-[16px] text-tertiary" aria-hidden="true">timer</span>
              <p className="font-mono text-[9px] leading-4 text-on-surface-variant">
                Khi điều kiện không còn thỏa mãn liên tục trong <strong className="text-tertiary">{capabilities.releaseConfirmMs / 1000} giây</strong>, quy tắc sẽ dừng áp dụng hành động.
              </p>
            </aside>

            <div className="rounded border border-outline-variant/30 bg-surface-lowest p-3">
              <span className="flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-outline">
                <span className="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">terminal</span>
                Xem trước quy tắc (biểu thức logic)
              </span>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded border border-primary/20 bg-[#08101e] px-3 py-2 font-mono text-[11px]">
                <strong className="text-primary">NẾU</strong>
                <span className="text-on-surface">{selectedSensor.label}</span>
                <span className="text-primary">{draft.operator}</span>
                <strong className="text-tertiary">{draft.threshold || '—'}{selectedSensor.unit}</strong>
                <span className="text-primary">→</span>
                <strong className="text-primary">THÌ</strong>
                <span className="text-secondary">{selectedActuator.label}</span>
                <span className="text-primary">→</span>
                <strong className="rounded border border-secondary/30 bg-secondary/10 px-1.5 py-0.5 text-[9px] text-secondary">{draft.actionState === 'ON' ? 'BẬT' : 'TẮT'}</strong>
              </div>
            </div>
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-outline-variant/45 bg-surface-high/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            {mode === 'edit' ? (
              <button type="button" disabled={saving} onClick={onDelete} className="control-button border border-error/45 px-3 text-error hover:bg-error/10 disabled:opacity-45">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                Xóa quy tắc
              </button>
            ) : <span />}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={saving} onClick={onClose} className="control-button border border-outline-variant/55 px-4 text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-45">Hủy</button>
              <button type="submit" disabled={saving} className="control-button bg-primary px-4 text-[#003640] shadow-cyan hover:bg-[#82e9ff] disabled:opacity-45">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">save</span>
                {saving ? 'Đang lưu...' : mode === 'create' ? 'Lưu quy tắc' : 'Lưu thay đổi'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
