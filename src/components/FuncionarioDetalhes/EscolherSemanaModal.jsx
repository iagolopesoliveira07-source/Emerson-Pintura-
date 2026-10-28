import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormActions } from '../Form/Form';
import { SEMANAS_MES, getSemanaLabel } from '../../utils/semanaMesCalculations';
import styles from './FechamentoPagamento.module.css';

export default function EscolherSemanaModal({
  isOpen,
  onClose,
  onConfirm,
  descontoLabel,
  valor,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Escolher semana"
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </FormActions>
      }
    >
      {descontoLabel && (
        <p className={styles.infoText} style={{ marginTop: 0 }}>
          Desconto: <strong>{descontoLabel}</strong>
          {valor != null && ` (${valor})`}
        </p>
      )}
      <p className={styles.infoText}>Seleccione em qual semana do mês este desconto será aplicado:</p>
      <div className={styles.semanaGrid}>
        {SEMANAS_MES.map((semana) => (
          <Button key={semana} onClick={() => onConfirm(semana)}>
            {getSemanaLabel(semana)}
          </Button>
        ))}
      </div>
    </Modal>
  );
}
