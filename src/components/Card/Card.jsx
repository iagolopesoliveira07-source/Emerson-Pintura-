import styles from './Card.module.css';
import HelpTip from '../HelpTip/HelpTip';

export default function Card({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'blue',
  help,
  children,
  onClick,
  className = '',
}) {
  const iconClass = styles[`cardIcon${iconColor.charAt(0).toUpperCase() + iconColor.slice(1)}`];

  return (
    <div
      className={`${styles.card} ${onClick ? styles.clickable : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {(title || Icon) && (
        <div className={styles.cardHeader}>
          {title && (
            <span className={styles.cardTitle}>
              <span>{title}</span>
              {help ? <HelpTip text={help} /> : null}
            </span>
          )}
          {Icon && (
            <div className={`${styles.cardIcon} ${iconClass}`}>
              <Icon size={22} />
            </div>
          )}
        </div>
      )}
      {value !== undefined && <div className={styles.cardValue}>{value}</div>}
      {subtitle && <div className={styles.cardSubtitle}>{subtitle}</div>}
      {children}
    </div>
  );
}
