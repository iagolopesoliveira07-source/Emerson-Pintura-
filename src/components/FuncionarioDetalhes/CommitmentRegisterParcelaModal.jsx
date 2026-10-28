import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormActions } from '../Form/Form';
import {
  canRegisterParcela,
  getParcelaAtual,
  getParcelasRestantesLabel,
  getTotalParcelas,
  getValorParcela,
} from '../../utils/commitmentCalculations';
import { formatCurrency } from '../../utils/formatters';

export default function CommitmentRegisterParcelaModal({
  isOpen,
  onClose,
  item,
  label = 'Desconto',
  onSubmit,
}) {
  if (!item) return null;

  const parcelaAtual = getParcelaAtual(item);
  const total = getTotalParcelas(item);
  const restantesLabel = getParcelasRestantesLabel(item);

  const handleConfirm = () => {
    if (!canRegisterParcela(item)) {
      window.alert('Esta parcela já foi registrada.');
      return;
    }

    onSubmit({
      valor: getValorParcela(item),
      data: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar parcela"
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm}>Registrar parcela</Button>
        </FormActions>
      }
    >
      <p style={{ marginBottom: '0.75rem', fontSize: '0.9375rem' }}>
        <strong>Descrição:</strong> {item.descricao}
      </p>
      <p style={{ marginBottom: '0.75rem', fontSize: '0.9375rem' }}>
        <strong>Valor:</strong> {formatCurrency(getValorParcela(item))}
      </p>
      <p style={{ marginBottom: '0.5rem', fontSize: '0.9375rem' }}>
        <strong>Parcela atual:</strong> {parcelaAtual} de {total}
      </p>
      {restantesLabel && restantesLabel !== '—' && (
        <p style={{ marginBottom: '1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          {restantesLabel}
        </p>
      )}
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
        Registrar esta parcela como descontada?
      </p>
    </Modal>
  );
}
