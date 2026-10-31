import type {
  ActuatorName,
  ActuatorState,
  DeviceStatus,
} from "../../types/device";
import { ActuatorControl } from "./ActuatorControl";

interface ManualControlProps {
  actuators: ActuatorState[];
  status: DeviceStatus | null;
  pendingActuator: ActuatorName | null;
  error: string | null;
  onChange: (id: ActuatorName, enabled: boolean) => void;
  onResumeAutomation: (id: ActuatorName) => void;
}

export function ManualControl({
  actuators,
  status,
  pendingActuator,
  error,
  onChange,
  onResumeAutomation,
}: ManualControlProps) {
  const states: Record<ActuatorName, boolean | null> = {
    fan: status?.fanOn ?? null,
    buzzer: status?.buzzerOn ?? null,
  };
  const offline = status?.online !== true;

  return (
    <section className="panel p-4" aria-labelledby="manual-control-title">
      <div className="section-title-row">
        <span
          className="material-symbols-outlined text-[20px] text-primary"
          aria-hidden="true"
        >
          tune
        </span>
        <h2 id="manual-control-title" className="section-title">
          Điều khiển thủ công
        </h2>
      </div>
      <p
        className={`mt-1 font-mono text-[9px] uppercase tracking-wider ${offline ? "text-error" : "text-outline"}`}
      >
        {offline && "Thiết bị ngoại tuyến · điều khiển đã bị vô hiệu hóa"}
      </p>
      {error && (
        <p
          className="mt-3 rounded border border-error/25 bg-error/5 px-2.5 py-2 font-mono text-[10px] leading-4 text-error"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {actuators.map((actuator) => (
          <ActuatorControl
            key={actuator.id}
            actuator={actuator}
            enabled={states[actuator.id]}
            pending={pendingActuator === actuator.id}
            disabled={offline || pendingActuator !== null}
            onChange={(enabled) => onChange(actuator.id, enabled)}
            source={
              actuator.id === "fan"
                ? (status?.fanSource ?? null)
                : (status?.buzzerSource ?? null)
            }
            manualOverride={actuator.id === "fan" ? status?.fanManualOverride ?? false : status?.buzzerManualOverride ?? false}
            onResumeAutomation={() => onResumeAutomation(actuator.id)}
          />
        ))}
      </div>
    </section>
  );
}
