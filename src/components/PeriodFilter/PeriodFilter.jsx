import { PERIOD_PRESETS } from '../../utils/periodFilter';
import styles from './PeriodFilter.module.css';

export default function PeriodFilter({
  preset,
  onPresetChange,
  customInicio,
  customFim,
  onCustomInicioChange,
  onCustomFimChange,
  label,
  presets = PERIOD_PRESETS,
}) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.buttons} role="group" aria-label="Filtro por período">
        {presets.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.button} ${preset === item.id ? styles.buttonActive : ''}`}
            onClick={() => onPresetChange(item.id)}
            aria-pressed={preset === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      {preset === 'personalizado' && (
        <div className={styles.customRow}>
          <label className={styles.customField}>
            <span className={styles.customLabel}>Data inicial</span>
            <input
              type="date"
              className={styles.customInput}
              value={customInicio}
              onChange={(e) => onCustomInicioChange(e.target.value)}
            />
          </label>
          <label className={styles.customField}>
            <span className={styles.customLabel}>Data final</span>
            <input
              type="date"
              className={styles.customInput}
              value={customFim}
              onChange={(e) => onCustomFimChange(e.target.value)}
            />
          </label>
        </div>
      )}

      {label && (
        <p className={styles.label}>
          A consultar: <strong>{label}</strong>
        </p>
      )}
    </div>
  );
}
