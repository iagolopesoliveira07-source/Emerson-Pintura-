import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import Button from '../../components/Button/Button';
import Card from '../../components/Card/Card';
import Table from '../../components/Table/Table';
import PeriodFilter from '../../components/PeriodFilter/PeriodFilter';
import IvaEntregarFormModal from '../../components/IvaEntregarForm/IvaEntregarFormModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import confirmStyles from '../../components/ConfirmDialog/ConfirmDialog.module.css';
import { usePeriodFilter } from '../../hooks/usePeriodFilter';
import { filterByPeriod } from '../../utils/periodFilter';
import {
  summarizeIva,
  hasIvaInfo,
  formatTaxaIva,
  formToIvaEntregarPayload,
  buildIvaEntregarUpdate,
  monthToDateRange,
} from '../../utils/ivaCalculations';
import { getIvaBreakdownAssinado } from '../../utils/gastoDocumentoSinal';
import { applySinal, getGastoValorAssinado, isNotaCredito } from '../../utils/gastoDocumentoTipo';
import { gastosEmpresaParaIva } from '../../utils/gastoEmpresaCalculations';
import { getGastoTipoLabel, getGastoObservacaoDisplay } from '../../utils/gastoDisplay';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import { HelpLabel } from '../../components/HelpTip/HelpTip';
import DocumentoTipoBadge from '../../components/Gastos/DocumentoTipoBadge';
import shared from '../shared.module.css';
import styles from './Iva.module.css';

function toHistoryRow(gasto, tipo, descricao, gastoLabel) {
  const breakdown = getIvaBreakdownAssinado(gasto);
  return {
    id: `${tipo}-${gasto.id}`,
    tipo,
    data: gasto.data,
    descricao,
    gasto: gastoLabel,
    notaCredito: isNotaCredito(gasto),
    valorSemIva: applySinal(gasto.valorSemIva, gasto),
    taxaIva: gasto.taxaIva,
    valorIva: applySinal(gasto.valorIva, gasto),
    total: getGastoValorAssinado(gasto),
    ivaDedutivel: breakdown.dedutivel,
    ivaNaoDedutivel: breakdown.naoDedutivel,
    ivaSuportado: breakdown.suportado,
    foraDoIvaEmerson: breakdown.foraDoIvaEmerson,
    ivaAEntregar: null,
    record: gasto,
  };
}

function buildHistoryRows(gastos, gastosEmpresa, ivaEntregar) {
  const gastoRows = gastos.filter(hasIvaInfo).map((gasto) =>
    toHistoryRow(
      gasto,
      'gasto',
      getGastoObservacaoDisplay(gasto) || getGastoTipoLabel(gasto),
      getGastoTipoLabel(gasto)
    )
  );

  const empresaRows = gastosEmpresa.filter(hasIvaInfo).map((gasto) =>
    toHistoryRow(
      gasto,
      'gasto_empresa',
      gasto.descricao || gasto.categoria || 'Gasto da empresa',
      gasto.categoria || 'Empresa'
    )
  );

  const entregarRows = ivaEntregar.map((item) => ({
    id: `entregar-${item.id}`,
    tipo: 'entregar',
    data: item.data,
    descricao: item.descricao,
    gasto: '—',
    valorSemIva: null,
    taxaIva: null,
    valorIva: null,
    total: null,
    ivaDedutivel: null,
    ivaAEntregar: item.valor,
    record: item,
  }));

  return [...gastoRows, ...empresaRows, ...entregarRows].sort((a, b) => {
    const da = a.data || '';
    const db = b.data || '';
    if (da === db) return (b.id || '').localeCompare(a.id || '');
    return db.localeCompare(da);
  });
}

export default function Iva() {
  const {
    gastos,
    gastosEmpresa = [],
    ivaEntregar = [],
    addIvaEntregar,
    updateIvaEntregar,
    deleteIvaEntregar,
  } = useApp();
  const period = usePeriodFilter('este_mes');
  const [mesConsulta, setMesConsulta] = useState('');
  const [historicoFiltro, setHistoricoFiltro] = useState('todos');
  const [ivaDetalhe, setIvaDetalhe] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const gastosPeriodo = useMemo(
    () => filterByPeriod(gastos, period.range),
    [gastos, period.range]
  );
  const ivaEntregarPeriodo = useMemo(
    () => filterByPeriod(ivaEntregar, period.range),
    [ivaEntregar, period.range]
  );

  const gastosEmpresaPeriodo = useMemo(
    () => gastosEmpresaParaIva(filterByPeriod(gastosEmpresa, period.range)),
    [gastosEmpresa, period.range]
  );

  const resumo = useMemo(
    () =>
      summarizeIva({
        gastos: gastosPeriodo,
        gastosEmpresa: gastosEmpresaPeriodo,
        ivaEntregar: ivaEntregarPeriodo,
      }),
    [gastosPeriodo, gastosEmpresaPeriodo, ivaEntregarPeriodo]
  );

  const historyRows = useMemo(() => {
    const rows = buildHistoryRows(gastosPeriodo, gastosEmpresaPeriodo, ivaEntregarPeriodo);
    let next = rows;
    if (historicoFiltro === 'compras') next = next.filter((row) => row.tipo === 'gasto');
    if (historicoFiltro === 'empresa') next = next.filter((row) => row.tipo === 'gasto_empresa');
    if (historicoFiltro === 'entregar') next = next.filter((row) => row.tipo === 'entregar');
    if (ivaDetalhe === 'suportado') next = next.filter((row) => row.ivaSuportado != null);
    if (ivaDetalhe === 'dedutivel') next = next.filter((row) => Number(row.ivaDedutivel) !== 0);
    if (ivaDetalhe === 'nao_dedutivel') next = next.filter((row) => Number(row.ivaNaoDedutivel) !== 0);
    return next;
  }, [gastosPeriodo, gastosEmpresaPeriodo, ivaEntregarPeriodo, historicoFiltro, ivaDetalhe]);

  const saldoClass =
    resumo.saldo > 0 ? styles.saldoPositive : resumo.saldo < 0 ? styles.saldoNegative : styles.saldoZero;
  const saldoLabel =
    resumo.saldo > 0
      ? 'Mais IVA recuperável do que IVA a entregar'
      : resumo.saldo < 0
        ? 'Mais IVA a entregar do que IVA recuperável'
        : 'IVA recuperável e IVA a entregar estão iguais';

  const handleMesConsulta = (value) => {
    setMesConsulta(value);
    if (!value) return;
    const range = monthToDateRange(value);
    if (!range) return;
    period.setPreset('personalizado');
    period.setCustomInicio(range.inicio);
    period.setCustomFim(range.fim);
  };

  const handleCreate = (form) => {
    addIvaEntregar(formToIvaEntregarPayload(form));
    setCreateOpen(false);
  };

  const handleEdit = (form) => {
    updateIvaEntregar(buildIvaEntregarUpdate(selected, form));
    setEditOpen(false);
    setSelected(null);
  };

  const handleDelete = () => {
    deleteIvaEntregar(selected.id);
    setDeleteOpen(false);
    setSelected(null);
  };

  const columns = [
    {
      key: 'data',
      label: 'Data',
      render: (row) => formatDate(row.data),
    },
    {
      key: 'descricao',
      label: 'Descrição',
      render: (row) => (
        <div className={styles.descCell}>
          <span className={styles.descMain}>
            {row.descricao || '—'}
            {row.notaCredito ? (
              <>
                {' '}
                <DocumentoTipoBadge gasto={row.record} />
              </>
            ) : null}
          </span>
          {row.tipo === 'gasto' && row.gasto && row.gasto !== row.descricao && (
            <span className={styles.descMeta}>{row.gasto}</span>
          )}
          {row.tipo === 'gasto_empresa' && (
            <span className={styles.descMeta}>Gasto da empresa{row.gasto ? ` · ${row.gasto}` : ''}</span>
          )}
          {row.tipo === 'entregar' && <span className={styles.descMeta}>IVA a entregar</span>}
        </div>
      ),
    },
    {
      key: 'valorSemIva',
      label: 'Sem IVA',
      align: 'right',
      render: (row) => (row.valorSemIva == null ? '—' : formatCurrency(row.valorSemIva)),
    },
    {
      key: 'taxaIva',
      label: 'Taxa',
      align: 'right',
      render: (row) => (row.taxaIva == null ? '—' : formatTaxaIva(row.taxaIva)),
    },
    {
      key: 'valorIva',
      label: 'IVA',
      align: 'right',
      render: (row) => (row.valorIva == null ? '—' : formatCurrency(row.valorIva)),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (row) => (row.total == null ? '—' : formatCurrency(row.total)),
    },
    {
      key: 'ivaDedutivel',
      label: 'Dedutível',
      align: 'right',
      render: (row) => {
        if (row.tipo === 'entregar') return null;
        if (row.foraDoIvaEmerson) {
          return 'Fora do IVA da Emerson';
        }
        if (row.ivaDedutivel == null) return 'Por determinar';
        return formatCurrency(row.ivaDedutivel);
      },
    },
    {
      key: 'ivaAEntregar',
      label: 'A entregar',
      align: 'right',
      render: (row) => (row.ivaAEntregar == null ? '—' : formatCurrency(row.ivaAEntregar)),
    },
    {
      key: 'acoes',
      label: '',
      align: 'right',
      render: (row) => {
        if (row.tipo !== 'entregar') return null;
        return (
          <div className={shared.tableActions}>
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              title="Editar"
              aria-label="Editar IVA a entregar"
              onClick={() => {
                setSelected(row.record);
                setEditOpen(true);
              }}
            />
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              title="Excluir"
              aria-label="Excluir IVA a entregar"
              onClick={() => {
                setSelected(row.record);
                setDeleteOpen(true);
              }}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className={shared.page}>
      <PageHeader
        title="Controle de IVA"
        subtitle="IVA recuperável das compras e IVA a entregar ao Estado"
        help={HELP.iva.registrado}
        actions={
          <Button icon={Plus} onClick={() => setCreateOpen(true)}>
            IVA a entregar
          </Button>
        }
      />

      <PeriodFilter
        preset={period.preset}
        onPresetChange={period.setPreset}
        customInicio={period.customInicio}
        customFim={period.customFim}
        onCustomInicioChange={period.setCustomInicio}
        onCustomFimChange={period.setCustomFim}
        label={period.label}
      />

      <div className={styles.monthRow}>
        <label className={styles.monthField}>
          <span className={styles.monthLabel}>Consultar por mês</span>
          <input
            type="month"
            className={styles.monthInput}
            value={mesConsulta}
            onChange={(e) => handleMesConsulta(e.target.value)}
            aria-label="Consultar IVA por mês"
          />
        </label>
      </div>

      <div className={styles.saldoGrid}>
        <Card title="IVA dedutível / recuperável" value={formatCurrency(resumo.ivaDedutivel)} iconColor="green" help={HELP.iva.dedutivel} />
        <Card title="IVA a entregar ao Estado" value={formatCurrency(resumo.ivaAEntregar)} iconColor="orange" />
        <div className={`${styles.saldoCard} ${saldoClass}`}>
          <span className={styles.saldoTitle}>Saldo de IVA</span>
          <strong className={styles.saldoValue}>{formatCurrency(resumo.saldo)}</strong>
          <span className={styles.saldoHint}>{saldoLabel}</span>
          <span className={styles.saldoFormula}>recuperável − a entregar</span>
        </div>
      </div>

      <div className={styles.totaisGrid}>
        <button type="button" className={`${styles.totalItem} ${styles.totalButton} ${ivaDetalhe === 'suportado' ? styles.totalActive : ''}`} onClick={() => setIvaDetalhe(ivaDetalhe === 'suportado' ? '' : 'suportado')}>
          <span>IVA suportado</span>
          <strong>{formatCurrency(resumo.totalIva)}</strong>
        </button>
        <div className={styles.totalItem}>
          <span>Total de gastos</span>
          <strong>{formatCurrency(resumo.totalGastos)}</strong>
        </div>
        <div className={styles.totalItem}>
          <span>Total sem IVA</span>
          <strong>{formatCurrency(resumo.totalSemIva)}</strong>
        </div>
        <button type="button" className={`${styles.totalItem} ${styles.totalButton} ${ivaDetalhe === 'dedutivel' ? styles.totalActive : ''}`} onClick={() => setIvaDetalhe(ivaDetalhe === 'dedutivel' ? '' : 'dedutivel')}>
          <span>
            <HelpLabel text={HELP.iva.dedutivel}>IVA dedutível</HelpLabel>
          </span>
          <strong>{formatCurrency(resumo.ivaDedutivel)}</strong>
        </button>
        <button type="button" className={`${styles.totalItem} ${styles.totalButton} ${ivaDetalhe === 'nao_dedutivel' ? styles.totalActive : ''}`} onClick={() => setIvaDetalhe(ivaDetalhe === 'nao_dedutivel' ? '' : 'nao_dedutivel')}>
          <span>
            <HelpLabel text={HELP.iva.naoDedutivel}>IVA não dedutível</HelpLabel>
          </span>
          <strong>{formatCurrency(resumo.ivaNaoDedutivel)}</strong>
        </button>
        <div className={styles.totalItem}>
          <span>IVA a entregar</span>
          <strong>{formatCurrency(resumo.ivaAEntregar)}</strong>
        </div>
        <div className={styles.totalItem}>
          <span>Saldo</span>
          <strong>{formatCurrency(resumo.saldo)}</strong>
        </div>
      </div>

      {resumo.gastosSemIvaInfo > 0 && (
        <p className={styles.legacyNote}>
          {resumo.gastosSemIvaInfo} gasto{resumo.gastosSemIvaInfo === 1 ? '' : 's'} neste período
          {' '}com IVA não informado. Os valores originais não foram alterados.
        </p>
      )}

      <div className={styles.historicoHeader}>
        <h2 className={styles.historicoTitle}>Histórico</h2>
        <div className={styles.chips} role="group" aria-label="Filtrar histórico">
          <button
            type="button"
            className={`${styles.chip} ${historicoFiltro === 'todos' ? styles.chipActive : ''}`}
            onClick={() => setHistoricoFiltro('todos')}
          >
            Todos
          </button>
          <button
            type="button"
            className={`${styles.chip} ${historicoFiltro === 'compras' ? styles.chipActive : ''}`}
            onClick={() => setHistoricoFiltro('compras')}
          >
            Compras
          </button>
          <button
            type="button"
            className={`${styles.chip} ${historicoFiltro === 'empresa' ? styles.chipActive : ''}`}
            onClick={() => setHistoricoFiltro('empresa')}
          >
            Empresa
          </button>
          <button
            type="button"
            className={`${styles.chip} ${historicoFiltro === 'entregar' ? styles.chipActive : ''}`}
            onClick={() => setHistoricoFiltro('entregar')}
          >
            IVA a entregar
          </button>
        </div>
      </div>

      <div className={shared.tableScroll}>
        <Table
          columns={columns}
          data={historyRows}
          emptyMessage="Sem registos de IVA neste período."
        />
      </div>

      <IvaEntregarFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        onSubmit={handleCreate}
      />

      <IvaEntregarFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        mode="edit"
        record={selected}
        onSubmit={handleEdit}
      />

      {selected && (
        <ConfirmDialog
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false);
            setSelected(null);
          }}
          onConfirm={handleDelete}
          title="Excluir IVA a entregar?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
        >
          <p className={confirmStyles.message}>Tem certeza que deseja excluir este registo?</p>
          <div className={confirmStyles.details}>
            {[
              ['Data', formatDate(selected.data)],
              ['Descrição', selected.descricao || '—'],
              ['Valor', formatCurrency(selected.valor)],
            ].map(([label, value]) => (
              <div key={label} className={confirmStyles.detailRow}>
                <span className={confirmStyles.detailLabel}>{label}:</span>
                <span className={confirmStyles.detailValue}>{value}</span>
              </div>
            ))}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
