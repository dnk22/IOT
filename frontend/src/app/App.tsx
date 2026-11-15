import { lazy, Suspense, useState } from 'react';
import { LoadingState } from '../components/common/LoadingState';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { mockActuators } from '../data/mockData';
import { AutomationPanel } from '../features/automation/AutomationPanel';
import { ManualControl } from '../features/control/ManualControl';
import { SensorCards } from '../features/telemetry/SensorCards';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { useManualControl } from '../hooks/useManualControl';
import { useTelemetry } from '../hooks/useTelemetry';

const SensorHistory = lazy(() => import('../features/telemetry/SensorHistory'));

export default function App() {
  const [controlsVisible, setControlsVisible] = useState(true);
  const { deviceStatus } = useDeviceStatus();
  const { telemetry, error: telemetryError } = useTelemetry();
  const { pending, error: controlError, setActuator, resumeAutomation } = useManualControl(deviceStatus);

  return (
    <div className="min-h-screen bg-surface px-3 py-5 text-on-surface sm:px-5 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1240px]">
        <DashboardHeader
          status={deviceStatus}
          controlsVisible={controlsVisible}
          onControlsVisibleChange={setControlsVisible}
        />
        <DashboardLayout
          sidebar={controlsVisible ? (
            <>
              <ManualControl
                actuators={mockActuators}
                status={deviceStatus}
                pendingActuator={pending?.actuator ?? null}
                error={controlError}
                onChange={setActuator}
                onResumeAutomation={resumeAutomation}
              />
              <AutomationPanel />
            </>
          ) : undefined}
        >
          <SensorCards
            telemetry={telemetry}
            device={deviceStatus}
            telemetryError={telemetryError}
            controlsVisible={controlsVisible}
          />
          <Suspense fallback={<LoadingState />}>
            <SensorHistory />
          </Suspense>
        </DashboardLayout>
      </div>
    </div>
  );
}
