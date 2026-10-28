import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormActions } from '../Form/Form';
import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'danger',
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </FormActions>
      }
    >
      {children || (message && <p className={styles.message}>{message}</p>)}
    </Modal>
  );
}
