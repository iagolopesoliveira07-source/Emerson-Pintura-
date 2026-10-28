import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import Button from '../../components/Button/Button';
import Card from '../../components/Card/Card';
import Table from '../../components/Table/Table';
import ObraStatusBadge from '../../components/ObraStatusBadge/ObraStatusBadge';
import Badge from '../../components/Badge/Badge';
import ObraFormModal from '../../components/ObraForm/ObraFormModal';
import ProgressBar from '../../components/ProgressBar/ProgressBar';
import { OBRA_STATUS, normalizeObraStatus, countObrasByStatus, sortObrasForDisplay } from '../../utils/obraStatus';
import ObraTipoBadge from '../../components/ObraDetalhes/ObraTipoBadge';
import { formToObraPayload } from '../../utils/obraForm';
import { formatCurrency, formatDateOrNotInformed, calcProgress } from '../../utils/formatters';
import { calcObraRecebimentoResumo } from '../../utils/debtCalculations';
import { applyObraExtrasToResumo } from '../../utils/obraExtras';
import { getTipoObra, isPrepaidCreditObra, calcPrepaidCreditSummary, TIPO_OBRA, TIPO_OBRA_OPTIONS, getEmpresaParticipacao } from '../../utils/obraSpecial';
import { HELP } from '../../utils/helpTexts';
import shared from '../shared.module.css';

export default function Obras() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { obras, pagamentos, addObra, funcionarios } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [filtro, setFiltro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  useEffect(() => {
    if (searchParams.get('nova') === 'true') setModalOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessMessage(location.state.successMessage);
      navigate(location.pathname, { replace: true, state: {} });
      const timer = setTimeout(() => setSuccessMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [location.state, location.pathname, navigate]);

  const filtered = sortObrasForDisplay(
    (obras || []).filter((o) => {
      if (!o) return false;
      const texto = `${o.nome || ''} ${o.cliente || ''}`.toLowerCase();
      const matchText = !filtro || texto.includes(filtro.toLowerCase());
      const matchEstado = !filtroEstado || normalizeObraStatus(o.estado) === filtroEstado;
      const matchTipo = !filtroTipo || getTipoObra(o) === filtroTipo;
      return matchText && matchEstado && matchTipo;
    })
  );

  const handleCreate = (form) => {
    const payload = formToObraPayload(form, null, { funcionarios });
    if (!payload) return;
    addObra(payload);
    setModalOpen(false);
  };

  const columns = [
    {
      key: 'nome',
      label: 'Obra',
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <strong>{r.nome}</strong>
          <ObraTipoBadge obra={r} />
        </span>
      ),
    },
    { key: 'cliente', label: 'Cliente', render: (r) => (getTipoObra(r) === TIPO_OBRA.ESPECIAL_TAVIRA ? '—' : r.cliente || '—') },
    {
      key: 'estado',
      label: 'Status',
      render: (r) => <ObraStatusBadge status={r.estado} />,
    },
    {
      key: 'recebimento',
      label: 'Pagamento',
      help: HELP.obra.aReceber,
      render: (r) => {
        if (isPrepaidCreditObra(r) || getTipoObra(r) === TIPO_OBRA.ESPECIAL_TAVIRA) return '—';

        const { valorRestante, isPago, extras } = applyObraExtrasToResumo(
          r,
          calcObraRecebimentoResumo(r, pagamentos)
        );

        if ((r.valorContratado || 0) <= 0 && extras.aCobrar <= 0.005 && extras.total <= 0.005) return '—';

        if (isPago) {
          return <Badge variant="success">Pago</Badge>;
        }

        return (
          <div>
            <Badge variant="warning">A receber</Badge>
            <div style={{ fontSize: '0.85em', color: '#b45309', marginTop: 4 }}>
              {formatCurrency(valorRestante)}
            </div>
          </div>
        );
      },
    },
    {
      key: 'valorContratado',
      label: 'Valor',
      help: HELP.obra.valorAtualizado,
      align: 'right',
      render: (r) => {
        if (getTipoObra(r) === TIPO_OBRA.ESPECIAL_TAVIRA) return '1 ano de aluguel';
        const extras = applyObraExtrasToResumo(r, { valorContratado: r.valorContratado || 0 });
        const original = extras.valorOriginal || 0;
        const atualizado = extras.valorAtualizado || original;
        if (isPrepaidCreditObra(r)) return formatCurrency(atualizado);
        if (!original && extras.extras.total <= 0.005) return '—';
        const part = getEmpresaParticipacao(r);
        const valorLabel =
          extras.extras.total > 0.005 ? (
            <div>
              <div>{formatCurrency(atualizado)}</div>
              <div style={{ fontSize: '0.75em', color: 'var(--color-text-muted)' }}>
                Original {formatCurrency(original)} + extras {formatCurrency(extras.extras.total)}
              </div>
            </div>
          ) : (
            formatCurrency(original)
          );
        if (part.isPartnership) {
          return (
            <div>
              {valorLabel}
              <div style={{ fontSize: '0.75em', color: 'var(--color-text-muted)' }}>
                {part.divisaoInformada
                  ? `${part.percentagemEmpresa}% / ${part.percentagemParceiro}% sobre o lucro`
                  : 'Parceria · % sobre o lucro não informada'}
              </div>
            </div>
          );
        }
        return valorLabel;
      },
    },
    { key: 'dataInicio', label: 'Início', render: (r) => formatDateOrNotInformed(r.dataInicio) },
    {
      key: 'progresso',
      label: 'Progresso',
      render: (r) => {
        if (isPrepaidCreditObra(r)) {
          const summary = calcPrepaidCreditSummary(r, { diarias: [], gastos: [] });
          const pct = summary?.percentExecutado || 0;
          return <ProgressBar value={pct} label={`${pct.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}%`} />;
        }
        return <ProgressBar value={calcProgress(r.dataInicio, r.dataPrevistaTermino)} showLabel={false} />;
      },
    },
  ];

  return (
    <div className={shared.page}>
      <PageHeader
        title="Obras"
        subtitle="Gerir todas as obras da empresa"
        actions={
          <Button icon={Plus} onClick={() => setModalOpen(true)}>Nova obra</Button>
        }
      />

      {successMessage && (
        <div className={shared.successBanner} role="status">
          {successMessage}
        </div>
      )}

      <div className={shared.statsRow}>
        <Card title="Total de obras" value={obras.length} iconColor="blue" />
        <Card title="Em andamento" value={countObrasByStatus(obras, 'Em andamento')} iconColor="cyan" />
        <Card title="Pausadas" value={countObrasByStatus(obras, 'Pausada')} iconColor="orange" />
        <Card title="Aguardando pagamento" value={countObrasByStatus(obras, 'Aguardando pagamento')} iconColor="purple" />
        <Card title="Encerradas" value={countObrasByStatus(obras, 'Encerrada')} iconColor="green" />
      </div>

      <div className={shared.filters}>
        <input
          className={shared.filterInput}
          placeholder="Pesquisar obras..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <select className={shared.filterInput} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {TIPO_OBRA_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <select className={shared.filterInput} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos os status</option>
          {OBRA_STATUS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <Table columns={columns} data={filtered} onRowClick={(r) => navigate(`/obras/${r.id}`)} emptyMessage="Nenhuma obra registada." />

      <ObraFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="create"
        onSubmit={handleCreate}
      />
    </div>
  );
}
