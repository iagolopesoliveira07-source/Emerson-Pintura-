import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import { formatCurrency } from '../../utils/formatters';
import {
  getValorEntregue,
  getValorUtilizado,
  getValorADevolver,
  getValorAdicionalAPagar,
} from '../../utils/acertoCalculations';

export default function ValoresAcertoConfirmModal({ isOpen, onClose, onConfirm, item }) {
  if (!item) return null;

  const entregue = getValorEntregue(item);
  const utilizado = getValorUtilizado(item);
  const aDevolver = getValorADevolver(item);
  const adicional = getValorAdicionalAPagar(item);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Confirmar acerto?"
      cancelLabel="Cancelar"
      confirmLabel="Confirmar acerto"
    >
      <p className={confirmStyles.message}>Confirmar acerto deste valor?</p>
      <div className={confirmStyles.details}>
        {[
          ['Valor entregue', formatCurrency(entregue)],
          ['Total utilizado', formatCurrency(utilizado)],
          adicional > 0
            ? ['Valor adicional a pagar', formatCurrency(adicional)]
            : ['Valor a devolver', formatCurrency(aDevolver)],
        ].map(([label, value]) => (
          <div key={label} className={confirmStyles.detailRow}>
            <span className={confirmStyles.detailLabel}>{label}:</span>
            <span className={confirmStyles.detailValue}>{value}</span>
          </div>
        ))}
      </div>
    </ConfirmDialog>
  );
}
