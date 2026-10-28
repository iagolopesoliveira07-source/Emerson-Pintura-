import styles from './PageHeader.module.css';
import HelpTip from '../HelpTip/HelpTip';

export default function PageHeader({ title, subtitle, actions, help }) {
  return (
    <div className={styles.pageHeader}>
      <div>
        {title && (
          <h2 className={styles.pageTitle}>
            {title}
            {help ? <HelpTip text={help} /> : null}
          </h2>
        )}
        {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
