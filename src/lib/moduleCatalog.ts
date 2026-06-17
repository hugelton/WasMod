import type { ModuleCatalogEntry, ModuleKind } from './types';

export const RACK_TOTAL_HP = 60;
export const BASE_HP_PX = 24;
export const MODULE_MM_PER_HP = 5.08;
export const MODULE_HEIGHT_MM = 128.5;
export const STRIP_PITCH_MM = 121.5;
export const BASE_RACK_HEIGHT_PX = BASE_HP_PX * (MODULE_HEIGHT_MM / MODULE_MM_PER_HP);
export const RACK_COUNT = 8;

export const moduleCatalog: Record<ModuleKind, ModuleCatalogEntry> = {
  blank2: {
    kind: 'blank2',
    name: 'Blank 2HP',
    hp: 2,
    description: '2HP blank panel',
    accent: '#d7d7d7',
    moduleType: 'blank'
  },
  blank4: {
    kind: 'blank4',
    name: 'Blank 4HP',
    hp: 4,
    description: '4HP blank panel',
    accent: '#d7d7d7',
    moduleType: 'blank'
  },
  blank6: {
    kind: 'blank6',
    name: 'Blank 6HP',
    hp: 6,
    description: '6HP blank panel',
    accent: '#d7d7d7',
    moduleType: 'blank'
  },
  blank8: {
    kind: 'blank8',
    name: 'Blank 8HP',
    hp: 8,
    description: '8HP blank panel',
    accent: '#d7d7d7',
    moduleType: 'blank'
  },
  blank12: {
    kind: 'blank12',
    name: 'Blank 12HP',
    hp: 12,
    description: '12HP blank panel',
    accent: '#d7d7d7',
    moduleType: 'blank'
  },
  junction4: {
    kind: 'junction4',
    name: 'Junction',
    hp: 4,
    description: '4HP passive multiple',
    accent: '#d7d7d7',
    moduleType: 'utility'
  },
  vco4: {
    kind: 'vco4',
    name: 'Sine VCO',
    hp: 4,
    description: '4HP sine oscillator with pitch CV input',
    accent: '#d7d7d7',
    moduleType: 'oscillator'
  },
  speaker4: {
    kind: 'speaker4',
    name: 'Speaker',
    hp: 4,
    description: '4HP mono output module',
    accent: '#d7d7d7',
    moduleType: 'output'
  }
};

export const moduleOrder: ModuleKind[] = ['vco4', 'speaker4', 'junction4', 'blank2', 'blank4', 'blank6', 'blank8', 'blank12'];
