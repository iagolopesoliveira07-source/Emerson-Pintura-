import { useMemo, useState } from 'react';
import { formatPeriodLabel, getPeriodRange } from '../utils/periodFilter';

export function usePeriodFilter(defaultPreset = 'todos', presets = []) {
  const [preset, setPreset] = useState(defaultPreset);
  const [customInicio, setCustomInicio] = useState('');
  const [customFim, setCustomFim] = useState('');

  const range = useMemo(
    () => getPeriodRange(preset, customInicio, customFim),
    [preset, customInicio, customFim]
  );

  const label = useMemo(
    () => formatPeriodLabel(preset, range, presets),
    [preset, range, presets]
  );

  return {
    preset,
    setPreset,
    customInicio,
    setCustomInicio,
    customFim,
    setCustomFim,
    range,
    label,
  };
}
