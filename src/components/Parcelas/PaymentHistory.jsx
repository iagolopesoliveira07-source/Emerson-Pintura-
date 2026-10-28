import { Pencil, Trash2 } from 'lucide-react';
import Button from '../Button/Button';
import { formatCurrency, formatDate } from '../../utils/formatters';
import shared from '../../pages/shared.module.css';

export default function PaymentHistory({ historico = [], onEdit, onDelete }) {
  if (historico.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Sem pagamentos registados.</p>;
  }

  return (
    <div>
      {historico.map((entry) => (
        <div key={entry.id} className={shared.detailRow}>
          <span className={shared.detailLabel}>
            {formatDate(entry.data)} · {formatCurrency(entry.valor)} · {entry.metodoPagamento || '—'}
          </span>
          <div className={shared.tableActions}>
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => onEdit(entry)} />
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => onDelete(entry)} />
          </div>
        </div>
      ))}
    </div>
  );
}
