import type { JackRole, ModuleKind } from './types';

export interface ModuleJackSpec {
  name: string;
  xMm: number;
  yMm: number;
  role: JackRole;
}

const JUNCTION_CENTER_X_MM = 10.16;
const JUNCTION_CENTER_Y_MM = 128.5 / 2;
const JUNCTION_PITCH_MM = 17.78;

export const moduleJacks: Partial<Record<ModuleKind, ModuleJackSpec[]>> = {
  junction4: Array.from({ length: 6 }, (_, index) => ({
    name: `jack_${index + 1}`,
    xMm: JUNCTION_CENTER_X_MM,
    yMm: JUNCTION_CENTER_Y_MM + (index - 2.5) * JUNCTION_PITCH_MM,
    role: 'both' as const
  })),
  vco4: [
    { name: 'cv_in', xMm: 10.16, yMm: 92.5, role: 'input' },
    { name: 'audio_out', xMm: 10.16, yMm: 114.5, role: 'output' }
  ],
  speaker4: [
    { name: 'audio_in', xMm: 10.16, yMm: 114.5, role: 'input' }
  ]
};
