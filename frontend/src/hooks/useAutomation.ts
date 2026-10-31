import { useCallback, useEffect, useState } from 'react';
import { useWebSocketContext } from '../app/providers/WebSocketProvider';
import {
  createAutomationRule,
  deleteAutomationRule,
  getAutomation,
  getAutomationCapabilities,
  setAutomationEnabled,
  setAutomationRuleEnabled,
  updateAutomationRule,
} from '../services/api/automationApi';
import { errorMessage } from '../services/api/client';
import type { AutomationCapabilities, AutomationRuleInput, AutomationView } from '../types/automation';

export function useAutomation() {
  const { realtimeAutomation, realtimeStatus } = useWebSocketContext();
  const [automation, setAutomation] = useState<AutomationView | null>(null);
  const [capabilities, setCapabilities] = useState<AutomationCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback((next: AutomationView) => {
    setAutomation((current) => (
      !current || next.configVersion >= current.configVersion ? next : current
    ));
    setError(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    Promise.all([getAutomation(controller.signal), getAutomationCapabilities(controller.signal)])
      .then(([view, options]) => {
        accept(view);
        setCapabilities(options);
      })
      .catch((caught: unknown) => {
        const message = errorMessage(caught);
        if (message) setError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [accept]);

  useEffect(() => {
    if (realtimeAutomation) {
      accept(realtimeAutomation);
      setIsLoading(false);
    }
  }, [accept, realtimeAutomation]);

  useEffect(() => {
    if (!realtimeStatus) return;
    setAutomation((current) => {
      if (!current) return current;
      const runtimeKnown = realtimeStatus.online && realtimeStatus.automationConfigVersion === current.configVersion;
      return {
        ...current,
        rules: current.rules.map((rule) => ({
          ...rule,
          runtimeState: !current.enabled || !rule.enabled
            ? 'DISABLED'
            : runtimeKnown
              ? realtimeStatus.ruleStates.find((item) => item.id === rule.id)?.state ?? 'UNKNOWN'
              : 'UNKNOWN',
        })),
      };
    });
  }, [realtimeStatus]);

  const mutate = useCallback(async (operation: () => Promise<AutomationView>) => {
    setIsSaving(true);
    setError(null);
    try {
      const next = await operation();
      accept(next);
      return true;
    } catch (caught: unknown) {
      setError(errorMessage(caught) || 'Không thể cập nhật Automation.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [accept]);

  return {
    automation,
    capabilities,
    isLoading,
    isSaving,
    error,
    createRule: (input: AutomationRuleInput) => mutate(() => createAutomationRule(input)),
    updateRule: (id: string, input: AutomationRuleInput) => mutate(() => updateAutomationRule(id, input)),
    deleteRule: (id: string) => mutate(() => deleteAutomationRule(id)),
    setRuleEnabled: (id: string, enabled: boolean) => mutate(() => setAutomationRuleEnabled(id, enabled)),
    setMasterEnabled: (enabled: boolean) => mutate(() => setAutomationEnabled(enabled)),
  };
}
