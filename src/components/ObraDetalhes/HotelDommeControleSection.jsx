import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import Table from '../Table/Table';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import HotelDommeTrabalhoFormModal from './HotelDommeTrabalhoFormModal';
import { formatCurrency, formatDateOrNotInformed } from '../../utils/formatters';
import {
  buildHotelDommeHistorico,
  buildHotelDommeMovimento,
  getHotelDommeResumo,
  HOTEL_DOMME_STATUS,
  HOTEL_DOMME_TIPO_LABELS,
  HOTEL_DOMME_TIPOS,
  toggleHotelDommeMovimentoStatus,
  updateHotelDommeMovimento,
} from '../../utils/hotelDommeCalculations';
import styles from './HotelDommeControle.module.css';
import shared from '../../pages/shared.module.css';

function formatValorHistorico(valor) {
  if (valor == null || valor === 0) return formatCurrency(0);
  const prefix = valor > 0 ? '+' : '';
  return `${prefix}${formatCurrency(valor)}`;
}

export default function HotelDommeControleSection({ obra, onSuccess }) {
  const {
    diarias,
    gastos,
    funcionarios,
    getHotelDommeControleByObraId,
    addHotelDommeMovimento,
    updateHotelDommeMovimentoRecord,
    deleteHotelDommeMovimento,
  } = useApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const controle = getHotelDommeControleByObraId(obra.id);
  const resumo = useMemo(
    () => getHotelDommeResumo(controle, diarias, gastos),
    [controle, diarias, gastos]
  );

  const historico = useMemo(
    () => buildHotelDommeHistorico(controle, diarias, gastos, funcionarios),
    [controle, diarias, gastos, funcionarios]
  );

  if (!controle || !resumo) return null;

  const saldoClass =
    resumo.saldoAtual <= 0
      ? styles.summarySaldoEsgotado
      : resumo.alerta?.nivel === 'baixo'
        ? styles.summarySaldoBaixo
        : styles.summarySaldo;

  const handleCreate = (payload) => {
    const result = buildHotelDommeMovimento(payload);
    if (!result.item) {
      onSuccess?.('Não foi possível registar a movimentação.');
      return;
    }
    addHotelDommeMovimento(obra.id, result.item);
    setCreateOpen(false);
    onSuccess?.('Trabalho/emergência registado com sucesso.');
  };

  const handleEdit = (payload) => {
    const result = updateHotelDommeMovimento(selected, payload);
    if (!result.item) {
      onSuccess?.('Não foi possível atualizar a movimentação.');
      return;
    }
    updateHotelDommeMovimentoRecord(obra.id, result.item);
    setEditOpen(false);
    setSelected(null);
    onSuccess?.('Movimentação atualizada com sucesso.');
  };

  const handleDelete = () => {
    deleteHotelDommeMovimento(obra.id, selected.id);
    setDeleteOpen(false);
    setSelected(null);
    onSuccess?.('Movimentação excluída com sucesso.');
  };

  const handleToggleStatus = (movimento) => {
    updateHotelDommeMovimentoRecord(obra.id, toggleHotelDommeMovimentoStatus(movimento));
    onSuccess?.(
      movimento.status === HOTEL_DOMME_STATUS.PENDENTE
        ? 'Movimentação marcada como realizada.'
        : 'Movimentação marcada como pendente.'
    );
  };

  const columns = [
    {
      key: 'data',
      label: 'Data',
      render: (row) => (row.data ? formatDateOrNotInformed(row.data) : '—'),
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (row) => HOTEL_DOMME_TIPO_LABELS[row.tipo] || row.tipo,
    },
    {
      key: 'descricao',
      label: 'Descrição',
      render: (row) => row.descricao,
    },
    {
      key: 'funcionarios',
      label: 'Funcionários',
      render: (row) => (
        <span className={styles.funcionariosCell}>
          {(row.funcionariosEnvolvidos || []).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'valor',
      label: 'Valor',
      align: 'right',
      render: (row) => (
        <span className={row.valor >= 0 ? styles.valorPositivo : styles.valorNegativo}>
          {formatValorHistorico(row.valor)}
        </span>
      ),
    },
    {
      key: 'saldo',
      label: 'Saldo após',
      align: 'right',
      render: (row) =>
        row.saldoApos == null ? '—' : formatCurrency(row.saldoApos),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        if (row.source === 'sistema' || row.source === 'diaria' || row.source === 'gasto') {
          return '—';
        }
        return (
          <Badge variant={row.status === HOTEL_DOMME_STATUS.PENDENTE ? 'warning' : 'success'}>
            {row.status === HOTEL_DOMME_STATUS.PENDENTE ? 'Pendente' : 'Realizado'}
          </Badge>
        );
      },
    },
    {
      key: 'observacoes',
      label: 'Observações',
      render: (row) => (
        <span className={styles.obsCell} title={row.observacoes || ''}>
          {row.observacoes || '—'}
        </span>
      ),
    },
    {
      key: 'acoes',
      label: 'Ações',
      render: (row) => {
        if (!row.editavel) return '—';
        const movimento = controle.movimentos.find((item) => item.id === row.sourceId);
        if (!movimento) return '—';

        return (
          <div className={styles.actionsCell}>
            <Button
              variant="ghost"
              size="sm"
              icon={Pencil}
              onClick={() => {
                setSelected(movimento);
                setEditOpen(true);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={movimento.status === HOTEL_DOMME_STATUS.PENDENTE ? CheckCircle : Clock}
              onClick={() => handleToggleStatus(movimento)}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => {
                setSelected(movimento);
                setDeleteOpen(true);
              }}
            />
          </div>
        );
      },
    },
  ];

  return (
    <section className={styles.section}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>Controle Hotel Domme</h3>
        <Button icon={Plus} onClick={() => setCreateOpen(true)}>
          Registrar trabalho/emergência
        </Button>
      </div>

      {resumo.alerta && (
        <div
          className={`${styles.alertBanner} ${
            resumo.alerta.nivel === 'esgotado' ? styles.alertEsgotado : styles.alertBaixo
          }`}
          role="alert"
        >
          {resumo.alerta.mensagem}
        </div>
      )}

      <div className={styles.summaryGrid}>
        <div className={`${styles.summaryItem} ${styles.summaryHighlight}`}>
          <span>Crédito inicial</span>
          <strong>{formatCurrency(resumo.creditoInicial)}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Consumo anterior</span>
          <strong>{formatCurrency(resumo.consumoAnterior)}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Disponível inicial</span>
          <strong>{formatCurrency(resumo.creditoDisponivelInicial)}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Trabalhos realizados</span>
          <strong>{formatCurrency(resumo.trabalhosRealizados)}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Diárias</span>
          <strong>{formatCurrency(resumo.totalDiarias)}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Outros gastos</span>
          <strong>{formatCurrency(resumo.totalGastos)}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Total consumido</span>
          <strong>{formatCurrency(resumo.totalConsumido)}</strong>
        </div>
        <div className={`${styles.summaryItem} ${saldoClass}`}>
          <span>Saldo atual</span>
          <strong>{formatCurrency(resumo.saldoAtual)}</strong>
        </div>
      </div>

      <div className={shared.sectionHeader} style={{ marginTop: '1rem' }}>
        <h4 className={shared.sectionHeaderTitle}>Histórico de movimentações</h4>
      </div>
      <div className={shared.tableScroll}>
        <Table
          columns={columns}
          data={[...historico].reverse()}
          emptyMessage="Sem movimentações registadas."
        />
      </div>

      <HotelDommeTrabalhoFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <HotelDommeTrabalhoFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        onSubmit={handleEdit}
        movimento={selected}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelected(null);
        }}
        onConfirm={handleDelete}
        title="Excluir movimentação?"
        message="Esta ação remove apenas o registo manual do controle de crédito."
        cancelLabel="Cancelar"
        confirmLabel="Excluir"
      />
    </section>
  );
}
