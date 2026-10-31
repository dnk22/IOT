import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/api/client';
import { resumeAutomation as sendResumeAutomation, sendManualControl } from '../services/api/controlApi';
import type { ActuatorName, DeviceStatus } from '../types/device';

const CONFIRMATION_TIMEOUT_MS = 12_000;

interface PendingCommand {
  actuator: ActuatorName;
  targetState: boolean | null;
  commandId: string | null;
}

export function useManualControl(status: DeviceStatus | null) {
  const [pending, setPending] = useState<PendingCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPendingTimeout(), [clearPendingTimeout]);

  useEffect(() => {
    if (!pending || !status) return;
    const actualState = pending.actuator === 'fan' ? status.fanOn : status.buzzerOn;
    const manualOverride = pending.actuator === 'fan' ? status.fanManualOverride : status.buzzerManualOverride;
    if ((pending.targetState === null && !manualOverride) ||
        (pending.targetState !== null && actualState === pending.targetState && manualOverride)) {
      clearPendingTimeout();
      setPending(null);
      setError(null);
    }
  }, [clearPendingTimeout, pending, status]);

  const setActuator = useCallback(
    async (actuator: ActuatorName, targetState: boolean) => {
      if (!status?.online || status.fanOn === null || status.buzzerOn === null || pending) return;

      const command = {
        target: actuator === 'fan' ? 'FAN' as const : 'BUZZER' as const,
        fanOn: actuator === 'fan' ? targetState : status.fanOn,
        buzzerOn: actuator === 'buzzer' ? targetState : status.buzzerOn,
      };
      setError(null);
      setPending({ actuator, targetState, commandId: null });

      try {
        const accepted = await sendManualControl(command);
        setPending((current) =>
          current?.actuator === actuator && current.targetState === targetState
            ? { ...current, commandId: accepted.commandId }
            : current,
        );
        clearPendingTimeout();
        timeoutRef.current = setTimeout(() => {
          setPending((current) => {
            if (current?.actuator === actuator && current.targetState === targetState) {
              setError('Đã gửi lệnh nhưng chưa nhận được trạng thái xác nhận từ ESP32.');
              return null;
            }
            return current;
          });
        }, CONFIRMATION_TIMEOUT_MS);
      } catch (caught: unknown) {
        clearPendingTimeout();
        setPending(null);
        setError(errorMessage(caught) || 'Không thể gửi lệnh điều khiển.');
      }
    },
    [clearPendingTimeout, pending, status],
  );

  const resumeAutomation = useCallback(async (actuator: ActuatorName) => {
    if (!status?.online || pending) return;
    setError(null);
    setPending({ actuator, targetState: null, commandId: null });
    try {
      const accepted = await sendResumeAutomation(actuator === 'fan' ? 'FAN' : 'BUZZER');
      setPending((current) => current?.actuator === actuator && current.targetState === null
        ? { ...current, commandId: accepted.commandId } : current);
      clearPendingTimeout();
      timeoutRef.current = setTimeout(() => {
        setPending((current) => {
          if (current?.actuator === actuator && current.targetState === null) {
            setError('Đã gửi lệnh nhưng ESP32 chưa xác nhận tiếp tục Automation.');
            return null;
          }
          return current;
        });
      }, CONFIRMATION_TIMEOUT_MS);
    } catch (caught: unknown) {
      clearPendingTimeout();
      setPending(null);
      setError(errorMessage(caught) || 'Không thể tiếp tục Automation.');
    }
  }, [clearPendingTimeout, pending, status]);

  return { pending, error, setActuator, resumeAutomation };
}
