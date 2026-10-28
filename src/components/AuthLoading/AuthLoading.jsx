import styles from './AuthLoading.module.css';

export default function AuthLoading({ message = 'A verificar sessão...' }) {
  return (
    <div className={styles.container}>
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.message}>{message}</p>
    </div>
  );
}
