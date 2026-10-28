import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, FormActions } from '../Form/Form';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import { formatBackupDate, summarizeBackupData } from '../../services/backupService';
import styles from '../ResetDataModal/ResetDataModal.module.css';

const CONFIRM_WORD = 'RESTAURAR';

export default function RestoreBackupModal({ isOpen, onClose, onConfirm, backup }) {
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setConfirmText('');
    }
  }, [isOpen]);

  const handleClose = () => {
    setStep(1);
    setConfirmText('');
    onClose();
  };

  const handleConfirm = () => {
    if (confirmText !== CONFIRM_WORD) return;
    onConfirm();
    handleClose();
  };

  if (!backup) return null;

  const summary = backup.summary || summarizeBackupData(backup.data);
  const isConfirmValid = confirmText === CONFIRM_WORD;

  if (step === 1) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Restaurar backup?"
        footer={
          <FormActions>
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancelar
            </Button>
            <Button variant="danger" type="button" onClick={() => setStep(2)}>
              Continuar
            </Button>
          </FormActions>
        }
      >
        <p className={confirmStyles.message}>
          A restauração substitui os dados actuais pelos deste backup. Esta acção não é automática
          e só avança se confirmar no passo seguinte.
        </p>
        <p className={styles.listIntro}>Backup de {formatBackupDate(backup.createdAt)}:</p>
        <ul className={styles.removalList}>
          <li>{summary.obras} obra(s)</li>
          <li>{summary.funcionarios} funcionário(s)</li>
          <li>{summary.diarias} diária(s)</li>
          <li>{summary.pagamentos} pagamento(s)</li>
          <li>{summary.gastos} gasto(s) de obras</li>
          <li>{summary.gastosEmpresa || 0} gasto(s) da empresa</li>
          <li>{summary.gastosEmpresaCategorias || 0} categoria(s) da empresa</li>
          <li>{summary.empresaVeiculos || 0} veículo(s)</li>
          <li>{summary.empresaDespesasProgramadas || 0} despesa(s) programada(s)</li>
        </ul>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Confirmar restauração"
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={handleClose}>
            Cancelar
          </Button>
          <Button variant="danger" type="button" onClick={handleConfirm} disabled={!isConfirmValid}>
            Restaurar backup
          </Button>
        </FormActions>
      }
    >
      <p className={confirmStyles.message}>
        Os dados actuais serão substituídos. Escreva {CONFIRM_WORD} para confirmar. O sistema vai
        recarregar a página a seguir.
      </p>
      <FormGroup label={`Escreva ${CONFIRM_WORD} para confirmar`}>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_WORD}
          autoComplete="off"
          spellCheck={false}
        />
      </FormGroup>
    </Modal>
  );
}
