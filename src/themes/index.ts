import nature from './nature';
import emerald_drift from './emerald_drift';
import gold_grid from './gold_grid';
import ember_dusk from './ember_dusk';
import paper_light from './paper_light';

export interface ThemeModule {
  id: string;
  label: string;
  external?: boolean;
  mount?: (container: HTMLElement) => {
    resize: () => void;
    dispose: () => void;
  };
}

export const THEME_REGISTRY: ThemeModule[] = [
  nature,
  emerald_drift,
  gold_grid,
  ember_dusk,
  paper_light,
  { id: 'kim_forest', label: 'Kim Forest (Legacy 3D)', external: true }
];

export const getThemeById = (id: string): ThemeModule => {
  const found = THEME_REGISTRY.find(t => t.id === id);
  return found || nature;
};
