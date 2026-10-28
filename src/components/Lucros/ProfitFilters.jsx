import { OBRA_STATUS } from '../../utils/obraStatus';
import shared from '../../pages/shared.module.css';
import styles from './Lucros.module.css';

const STATUS_OPTIONS = [
  { value: '', label: 'Todas as obras' },
  ...OBRA_STATUS.map((status) => ({ value: status, label: status })),
];

export default function ProfitFilters({
  statusFilter,
  onStatusChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) {
  return (
    <div className={styles.filters}>
      <select
        className={shared.filterInput}
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        aria-label="Filtrar por estado da obra"
      >
        {STATUS_OPTIONS.map(({ value, label }) => (
          <option key={value || 'all'} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input
        type="date"
        className={shared.filterInput}
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        aria-label="Data inicial"
      />
      <input
        type="date"
        className={shared.filterInput}
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        aria-label="Data final"
      />
    </div>
  );
}
