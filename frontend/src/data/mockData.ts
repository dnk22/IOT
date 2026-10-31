import type { ActuatorState } from '../types/device';

export const mockActuators: ActuatorState[] = [
  { id: 'fan', name: 'Quạt', relayChannel: 2, gpio: 26, idleLabel: 'ĐANG CHỜ', activeLabel: 'ĐANG CHẠY' },
  { id: 'buzzer', name: 'Còi', relayChannel: 1, gpio: 25, idleLabel: 'IM LẶNG', activeLabel: 'ĐANG CẢNH BÁO' },
];
