import { useState } from 'react';
import { Eye, FileText } from 'lucide-react';
import Badge from '../Badge/Badge';
import Button from '../Button/Button';
import Table from '../Table/Table';
import FechamentoDetalheModal from './FechamentoDetalheModal';
import ComprovativoPagamentoModal from '../ComprovativoPagamento/ComprovativoPagamentoModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getFechamentosFuncionario } from '../../utils/fechamentoPagamentoCalculations';
import { getFechamentoPeriodoLabel } from '../../utils/pagamentoPeriodCalculations';
import { filterByPeriod } from '../../utils/periodFilter';
import shared from '../../pages/shared.module.css';
import styles from './FechamentoPagamento.module.css';

export default function FuncionarioFechamentosSection({
  funcionario,
  fechamentosPagamento,
  periodRange,
  diarias = [],
  empresaNome = 'Emerson Pinturas',
  onCorrigir,
}) {
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [comprovativoOpen, setComprovativoOpen] = useState(false);
  const items = filterByPeriod(
    getFechamentosFuncionario(funcionario.id, fechamentosPagamento),
    periodRange
  );
  const selectedLive = items.find((item) => item.id === selected?.id) || selected;
  const totalPago = items.reduce((sum, f) => sum + (f.totalPago || 0), 0);

  const totalDescontos = (f) =>
    (f.totalDescontosRecorrentes || 0) +
    (f.totalDescontosParcelados || 0) +
    (f.totalAcertosUtilizado || 0);

  const columns = [
    { key: 'data', label: 'Data', render: (r) => formatDate(r.data) },
    { key: 'tipo', label: 'Tipo', render: (r) => r.tipoPagamento },
    {
      key: 'periodo',
      label: 'Período',
      render: (r) => getFechamentoPeriodoLabel(r),
    },
    {
      key: 'diarias',
      label: 'Diárias',
      align: 'right',
      render: (r) => formatCurrency(r.totalDiarias),
    },
    {
      key: 'descontos',
      label: 'Descontos',
      align: 'right',
      render: (r) => (totalDescontos(r) > 0 ? `- ${formatCurrency(totalDescontos(r))}` : '—'),
    },
    {
      key: 'acrescimo',
      label: 'Acréscimo',
      align: 'right',
      render: (r) => {
        const valor = r.totalAcrescimoManual ?? r.totalGratificacao ?? 0;
        return valor > 0 ? formatCurrency(valor) : '—';
      },
    },
    {
      key: 'descontoManual',
      label: 'Desc. manual',
      align: 'right',
      render: (r) =>
        r.totalDescontoManual > 0 ? `- ${formatCurrency(r.totalDescontoManual)}` : '—',
    },
    {
      key: 'acertos',
      label: 'Acertos',
      align: 'right',
      render: (r) =>
        r.totalAcertosDevolvido > 0 ? formatCurrency(r.totalAcertosDevolvido) : '—',
    },
    {
      key: 'total',
      label: 'Total pago',
      align: 'right',
      render: (r) => formatCurrency(r.totalPago),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Badge variant="success">{r.status}</Badge>,
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      render: (r) => (
        <div className={shared.tableActions}>
          <Button
            variant="secondary"
            size="sm"
            icon={FileText}
            onClick={() => {
              setSelected(r);
              setComprovativoOpen(true);
            }}
          >
            Ver comprovativo
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Eye}
            onClick={() => {
              setSelected(r);
              setDetailOpen(true);
            }}
          >
            Ver detalhes
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={shared.detailCard}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>Histórico de pagamentos</h3>
      </div>

      <div className={`${shared.tableScroll} ${styles.tableDesktop}`}>
        <Table
          columns={columns}
          data={items}
          emptyMessage="Sem pagamentos fechados registados."
        />
      </div>

      <div className={styles.pagamentosLista}>
        {items.length === 0 ? (
          <p className={styles.infoText}>Sem pagamentos fechados registados.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className={styles.pendenteItem}>
              <div className={styles.pendenteInfo}>
                <p className={styles.pendenteDesc}>{formatDate(item.data)}</p>
                <p className={styles.pendenteMeta}>{getFechamentoPeriodoLabel(item)}</p>
                <p className={styles.pagamentoValor}>{formatCurrency(item.totalPago)}</p>
                <Badge variant="success">{item.status}</Badge>
              </div>
              <div className={styles.pendenteActions}>
                <Button
                  size="sm"
                  icon={FileText}
                  onClick={() => {
                    setSelected(item);
                    setComprovativoOpen(true);
                  }}
                >
                  Ver comprovativo
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Eye}
                  onClick={() => {
                    setSelected(item);
                    setDetailOpen(true);
                  }}
                >
                  Detalhes
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className={shared.sectionTotal}>
          <span>Total pago (fechamentos)</span>
          <span className={shared.sectionTotalValue}>{formatCurrency(totalPago)}</span>
        </div>
      )}

      <FechamentoDetalheModal
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelected(null);
        }}
        fechamento={selectedLive}
        diarias={diarias}
        onVerComprovativo={() => {
          setDetailOpen(false);
          setComprovativoOpen(true);
        }}
      />
      <ComprovativoPagamentoModal
        isOpen={comprovativoOpen}
        onClose={() => {
          setComprovativoOpen(false);
          setSelected(null);
        }}
        fechamento={selectedLive}
        diarias={diarias}
        empresaNome={empresaNome}
        onCorrigir={
          onCorrigir
            ? (snapshot, observacao) => onCorrigir(selected?.id, snapshot, observacao)
            : undefined
        }
      />
    </div>
  );
}
