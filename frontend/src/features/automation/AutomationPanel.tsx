import { useState } from 'react';
import type { AutomationRuleInput } from '../../types/automation';
import { Toggle } from '../../components/common/Toggle';
import { ErrorState } from '../../components/common/ErrorState';
import { useAutomation } from '../../hooks/useAutomation';
import { AddRuleButton } from './AddRuleButton';
import { AutomationRuleCard } from './AutomationRuleCard';
import { AutomationRuleModal } from './AutomationRuleModal';

const syncLabels = {
  PENDING: 'Đang đồng bộ',
  SYNCED: 'Đã đồng bộ',
  ERROR: 'Lỗi đồng bộ',
};

export function AutomationPanel() {
  const {
    automation,
    capabilities,
    isLoading,
    isSaving,
    error,
    createRule,
    updateRule,
    deleteRule,
    setRuleEnabled,
    setMasterEnabled,
  } = useAutomation();
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(null);
  const selectedRule = modal?.mode === 'edit'
    ? automation?.rules.find((rule) => rule.id === modal.id) ?? null
    : null;
  const selectedIndex = selectedRule
    ? automation?.rules.findIndex((rule) => rule.id === selectedRule.id) ?? -1
    : -1;

  const saveRule = async (input: AutomationRuleInput) => {
    const saved = modal?.mode === 'edit'
      ? await updateRule(modal.id, input)
      : await createRule(input);
    if (saved) setModal(null);
  };

  const removeRule = async () => {
    if (modal?.mode !== 'edit') return;
    if (await deleteRule(modal.id)) setModal(null);
  };

  return (
    <section className="panel p-4" aria-labelledby="automation-title">
      <div className="section-title-row border-b border-outline-variant/25 pb-3">
        <span className="material-symbols-outlined text-[21px] text-secondary" aria-hidden="true">smart_toy</span>
        <h2 id="automation-title" className="section-title">Tự động hóa</h2>
      </div>
      {error && <div className="mt-3"><ErrorState message={error} /></div>}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-panel border border-outline-variant/35 bg-surface-lowest p-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[19px] text-primary" aria-hidden="true">bolt</span>
          <div>
            <p className="text-xs font-medium text-on-surface">Toàn bộ kịch bản</p>
          </div>
        </div>
        <Toggle checked={automation?.enabled ?? false} onChange={setMasterEnabled} disabled={!automation || isSaving} label="Bật tắt toàn bộ automation" />
      </div>
      {automation && (
        <div className="mt-2 flex items-center justify-between rounded border border-outline-variant/30 px-2.5 py-2 font-mono text-[9px] uppercase tracking-wider text-outline">
          <span className={automation.syncState === 'SYNCED' ? 'text-secondary' : automation.syncState === 'ERROR' ? 'text-error' : 'text-tertiary'}>
            {syncLabels[automation.syncState]}
          </span>
        </div>
      )}
      <div className="mt-3 space-y-2.5">
        {isLoading && <p className="py-4 text-center font-mono text-[10px] uppercase tracking-wider text-outline">Đang tải Automation...</p>}
        {!isLoading && automation?.rules.length === 0 && (
          <p className="rounded border border-dashed border-outline-variant/40 px-3 py-5 text-center font-mono text-[10px] text-outline">
            Chưa có quy tắc Automation.
          </p>
        )}
        {automation?.rules.map((rule, index) => (
          <AutomationRuleCard
            key={rule.id}
            index={index}
            rule={rule}
            saving={isSaving}
            onToggle={(enabled) => { void setRuleEnabled(rule.id, enabled); }}
            onEdit={() => setModal({ mode: 'edit', id: rule.id })}
          />
        ))}
      </div>
      <div className="mt-3">
        <AddRuleButton
          onClick={() => setModal({ mode: 'create' })}
          disabled={!automation || !capabilities || isSaving || automation.rules.length >= capabilities.maxRules}
        />
      </div>
      <AutomationRuleModal
        open={modal !== null}
        mode={modal?.mode ?? 'create'}
        rule={selectedRule}
        ruleNumber={selectedIndex >= 0 ? selectedIndex + 1 : null}
        capabilities={capabilities}
        saving={isSaving}
        onClose={() => setModal(null)}
        onSave={(input) => { void saveRule(input); }}
        onDelete={() => { void removeRule(); }}
      />
    </section>
  );
}
