import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, FormActions } from '../Form/Form';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import styles from './ResetDataModal.module.css';

const CONFIRM_WORD = 'ZERAR';

export default function ResetDataModal({ isOpen, onClose, onConfirm }) {
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState('');

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

  const handleContinue = () => {
    setStep(2);
    setConfirmText('');
  };

  const handleConfirm = () => {
    if (confirmText !== CONFIRM_WORD) return;
    onConfirm();
    handleClose();
  };

  const isConfirmValid = confirmText === CONFIRM_WORD;

  if (step === 1) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Zerar todos os dados?"
        footer={
          <FormActions>
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancelar
            </Button>
            <Button variant="danger" type="button" onClick={handleContinue}>
              Zerar todos os dados
            </Button>
          </FormActions>
        }
      >
        <p className={confirmStyles.message}>
          Esta ação irá apagar todos os dados cadastrados na aplicação. Esta ação não pode ser desfeita.
        </p>
        <p className={styles.listIntro}>Serão removidos permanentemente deste dispositivo:</p>
        <ul className={styles.removalList}>
          <li>Obras</li>
          <li>Funcionários</li>
          <li>Diárias</li>
          <li>Adiantamentos</li>
          <li>Empréstimos</li>
          <li>Gastos</li>
          <li>Pagamentos e recebimentos</li>
        </ul>
        <p className={styles.preservedNote}>
          As configurações da empresa e preferências do sistema serão mantidas.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Tem certeza absoluta?"
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={handleClose}>
            Cancelar
          </Button>
          <Button variant="danger" type="button" onClick={handleConfirm} disabled={!isConfirmValid}>
            Zerar definitivamente
          </Button>
        </FormActions>
      }
    >
      <p className={confirmStyles.message}>
        Todos os dados cadastrados serão removidos permanentemente deste dispositivo.
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
