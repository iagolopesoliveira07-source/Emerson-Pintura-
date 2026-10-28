import styles from './ProgressBar.module.css';

export default function ProgressBar({ value = 0, showLabel = true, label }) {
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  const display = label || `${Math.round(clamped)}%`;
  return (
    <div>
      <div className={styles.progressBar}>
        <div className={styles.fill} style={{ width: `${clamped}%` }} />
      </div>
      {showLabel && <div className={styles.label}>{display}</div>}
    </div>
  );
}
