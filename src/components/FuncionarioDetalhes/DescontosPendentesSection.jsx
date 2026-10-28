import { useState } from 'react';
import Badge from '../Badge/Badge';
import Button from '../Button/Button';
import EscolherSemanaModal from './EscolherSemanaModal';
import { formatCurrency } from '../../utils/formatters';
import { getDescontosPendentesPagamento } from '../../utils/fechamentoPagamentoCalculations';
import shared from '../../pages/shared.module.css';
import styles from './FechamentoPagamento.module.css';

function getModalidadeLabel(item) {
  if (item.modalidade === 'parcelado') {
    return `Parcela ${item.numero}/${item.total}`;
  }
  return item.categoria === 'aluguel' ? 'Aluguel mensal' : 'Desconto mensal';
}

export default function DescontosPendentesSection({ funcionario, onDescontarNestaSemana }) {
  const [semanaModalOpen, setSemanaModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const pendentes = getDescontosPendentesPagamento(funcionario);

  if (pendentes.length === 0) return null;

  const handleOpenSemana = (item) => {
    setSelectedItem(item);
    setSemanaModalOpen(true);
  };

  const handleConfirmSemana = (semana) => {
    if (!selectedItem) return;
    onDescontarNestaSemana?.({ ...selectedItem, semana });
    setSemanaModalOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className={shared.detailCard}>
      <h3 className={shared.detailCardTitle}>Descontos e parcelas pendentes</h3>
      <p className={styles.infoText} style={{ marginTop: 0, marginBottom: '1rem' }}>
        Todos os descontos começam como pendentes. O administrador decide manualmente quando
        aplicar cada um num pagamento semanal.
      </p>

      <div className={styles.pendentesList}>
        {pendentes.map((item) => (
          <div key={`${item.commitmentId}-${item.modalidade}`} className={styles.pendenteItem}>
            <div className={styles.pendenteInfo}>
              <div className={styles.pendenteDesc}>{item.descricao}</div>
              <div className={styles.pendenteMeta}>
                {getModalidadeLabel(item)} · {formatCurrency(item.valor)}
              </div>
            </div>
            <div className={styles.pendenteActions}>
              <Badge variant="warning">Pendente</Badge>
              <Button size="sm" onClick={() => handleOpenSemana(item)}>
                Descontar nesta semana
              </Button>
            </div>
          </div>
        ))}
      </div>

      <EscolherSemanaModal
        isOpen={semanaModalOpen}
        onClose={() => {
          setSemanaModalOpen(false);
          setSelectedItem(null);
        }}
        onConfirm={handleConfirmSemana}
        descontoLabel={selectedItem?.descricao}
        valor={selectedItem ? formatCurrency(selectedItem.valor) : null}
      />
    </div>
  );
}
