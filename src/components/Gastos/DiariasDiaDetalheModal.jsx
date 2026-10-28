import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { formatCurrency, formatDateOrNotInformed } from '../../utils/formatters';
import styles from './DiariasDiaDetalheModal.module.css';

export default function DiariasDiaDetalheModal({ isOpen, onClose, grupo }) {
  if (!grupo) return null;

  const detalhes = grupo._detalhes || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalhes das diárias"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className={styles.header}>
        <span className={styles.headerLabel}>Data</span>
        <span className={styles.headerValue}>
          {grupo.data ? formatDateOrNotInformed(grupo.data) : 'Sem data registada'}
        </span>
      </div>

      <h3 className={styles.listTitle}>Funcionários</h3>

      {detalhes.length === 0 ? (
        <p className={styles.empty}>Sem detalhes disponíveis.</p>
      ) : (
        <ul className={styles.list}>
          {detalhes.map((item) => (
            <li key={item.diariaId} className={styles.row}>
              <span className={styles.funcionario}>{item.funcionarioNome}</span>
              <span className={styles.separator}>—</span>
              <span className={styles.obra}>{item.obraNome}</span>
              {item.quantidade != null ? (
                <span className={styles.obra}> · {item.quantidade}</span>
              ) : null}
              <span className={styles.valor}>{formatCurrency(item.valor)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>Total do dia</span>
        <span className={styles.totalValue}>{formatCurrency(grupo.valor)}</span>
      </div>

      <p className={styles.nota}>
        Para editar ou excluir diárias, utilize a aba Diárias.
      </p>
    </Modal>
  );
}
