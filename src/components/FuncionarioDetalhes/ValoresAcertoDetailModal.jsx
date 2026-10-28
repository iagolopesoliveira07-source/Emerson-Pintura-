import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import { FormActions } from '../Form/Form';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  getValorEntregue,
  getValorUtilizado,
  getValorADevolver,
  getValorAdicionalAPagar,
  getAcertoGastos,
  getAcertoDisplayEstado,
  acertoEstadoVariant,
  isAcertoAcertado,
  getAcertoData,
} from '../../utils/acertoCalculations';
import styles from './ValoresAcerto.module.css';

export default function ValoresAcertoDetailModal({
  isOpen,
  onClose,
  item,
  obraNome,
}) {
  if (!item) return null;

  const entregue = getValorEntregue(item);
  const utilizado = getValorUtilizado(item);
  const aDevolver = getValorADevolver(item);
  const adicional = getValorAdicionalAPagar(item);
  const estado = getAcertoDisplayEstado(item);
  const gastos = getAcertoGastos(item);
  const acertado = isAcertoAcertado(item);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item.motivo}
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </FormActions>
      }
    >
      {obraNome && (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          Obra: {obraNome}
        </p>
      )}

      {getAcertoData(item) ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
          Data do adiantamento: {formatDate(getAcertoData(item))}
        </p>
      ) : null}

      <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{formatCurrency(entregue)} entregues</p>

      {gastos.length > 0 && (
        <>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.375rem' }}>
            Gastos:
          </p>
          <ul className={styles.gastoList}>
            {gastos.map((g) => (
              <li key={g.id} className={styles.gastoItem}>
                <span>{g.descricao}</span>
                <span className={styles.gastoDots} />
                <span>{formatCurrency(g.valor)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div style={{ marginTop: '1rem', fontSize: '0.875rem', lineHeight: 1.7 }}>
        <div>Total utilizado: <strong>{formatCurrency(utilizado)}</strong></div>
        {acertado ? (
          <>
            {item.acerto?.valorDevolvido > 0 && (
              <div>Devolvido: <strong>{formatCurrency(item.acerto.valorDevolvido)}</strong></div>
            )}
            {item.acerto?.valorAdicional > 0 && (
              <div>Valor adicional pago: <strong>{formatCurrency(item.acerto.valorAdicional)}</strong></div>
            )}
            {item.acerto?.dataAcerto && (
              <div>Data do acerto: <strong>{formatDate(item.acerto.dataAcerto)}</strong></div>
            )}
          </>
        ) : (
          <>
            {adicional > 0 ? (
              <div className={styles.highlightAdicional}>
                Valor adicional a pagar: <strong>{formatCurrency(adicional)}</strong>
              </div>
            ) : (
              aDevolver > 0 && (
                <div className={styles.highlightDevolver}>
                  A devolver: <strong>{formatCurrency(aDevolver)}</strong>
                </div>
              )
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Badge variant={acertoEstadoVariant(estado)}>{acertado ? '✓ Acertado' : estado}</Badge>
      </div>
    </Modal>
  );
}
