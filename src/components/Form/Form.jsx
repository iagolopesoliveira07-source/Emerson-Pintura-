import styles from './Form.module.css';
import HelpTip from '../HelpTip/HelpTip';

export function FormGroup({ label, required, error, hint, help, children }) {
  return (
    <div className={styles.formGroup}>
      {(label || help) && (
        <div className={styles.labelRow}>
          {label ? (
            <label className={`${styles.label} ${required ? styles.required : ''}`}>{label}</label>
          ) : null}
          {help ? <HelpTip text={help} /> : null}
        </div>
      )}
      {children}
      {error && <p className={styles.error}>{error}</p>}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

export function Input({ error, className = '', ...props }) {
  return (
    <input
      className={`${styles.input} ${error ? styles.inputError : ''} ${className}`}
      {...props}
    />
  );
}

export function Select({ error, children, className = '', ...props }) {
  return (
    <select
      className={`${styles.select} ${error ? styles.inputError : ''} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ error, className = '', ...props }) {
  return (
    <textarea
      className={`${styles.textarea} ${error ? styles.inputError : ''} ${className}`}
      {...props}
    />
  );
}

export function FormRow({ children }) {
  return <div className={styles.row}>{children}</div>;
}

export function FormActions({ children }) {
  return <div className={styles.formActions}>{children}</div>;
}

export function CalculatedValue({ label, value }) {
  return (
    <div className={styles.calculated}>
      {label}: {value}
    </div>
  );
}
