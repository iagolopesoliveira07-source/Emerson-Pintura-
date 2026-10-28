import styles from './EmptyState.module.css';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className={styles.empty}>
      {Icon && (
        <div className={styles.icon}>
          <Icon size={28} />
        </div>
      )}
      {title && <h3 className={styles.title}>{title}</h3>}
      {description && <p className={styles.description}>{description}</p>}
      {action}
    </div>
  );
}
