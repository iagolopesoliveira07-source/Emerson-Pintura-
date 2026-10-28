import styles from './Table.module.css';
import HelpTip from '../HelpTip/HelpTip';

export default function Table({ columns, data, onRowClick, emptyMessage = 'Sem registos.', compact = false }) {
  if (!data || data.length === 0) {
    return (
      <div className={`${styles.tableWrapper} ${compact ? styles.tableWrapperCompact : ''}`}>
        <div style={{ padding: compact ? '1rem 0.6rem' : '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.tableWrapper} ${compact ? styles.tableWrapperCompact : ''}`}>
      <table className={`${styles.table} ${compact ? styles.tableCompact : ''}`}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.align === 'right' ? styles.alignRight : ''}
                style={col.width ? { width: col.width } : undefined}
              >
                <span className={styles.thInner}>
                  {col.label}
                  {col.help ? <HelpTip text={col.help} /> : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={row.id || idx}
              className={onRowClick ? styles.clickable : ''}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={col.align === 'right' ? styles.alignRight : ''}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
