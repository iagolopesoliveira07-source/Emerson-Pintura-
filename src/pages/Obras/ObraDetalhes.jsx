import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileDown, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../../components/Button/Button';
import Card from '../../components/Card/Card';
import ObraStatusBadge from '../../components/ObraStatusBadge/ObraStatusBadge';
import ObraFormModal from '../../components/ObraForm/ObraFormModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import ObraDiariasSection from '../../components/ObraDetalhes/ObraDiariasSection';
import ObraGastosSection from '../../components/ObraDetalhes/ObraGastosSection';
import ObraPagamentosSection from '../../components/ObraDetalhes/ObraPagamentosSection';
import ObraFuncionariosSection from '../../components/ObraDetalhes/ObraFuncionariosSection';
import ObraFinalizacaoSection from '../../components/ObraDetalhes/ObraFinalizacaoSection';
import ObraHistoricoSection from '../../components/ObraDetalhes/ObraHistoricoSection';
import ObraTipoBadge from '../../components/ObraDetalhes/ObraTipoBadge';
import ObraParceriaSection from '../../components/ObraDetalhes/ObraParceriaSection';
import ObraParceriaAcertosSection from '../../components/ObraDetalhes/ObraParceriaAcertosSection';
import ObraParceriaPeriodoSection from '../../components/ObraDetalhes/ObraParceriaPeriodoSection';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import ObraCreditoJobSection from '../../components/ObraDetalhes/ObraCreditoJobSection';
import ObraTaviraSection from '../../components/ObraDetalhes/ObraTaviraSection';
import ObraExtrasSection from '../../components/ObraDetalhes/ObraExtrasSection';
import { FormGroup, Input, Select } from '../../components/Form/Form';
import { formatCurrency, formatDateOrNotInformed } from '../../utils/formatters';
import { getGastoEmpresaValor } from '../../utils/gastoEmpresaCalculations';
import { buildObraUpdate } from '../../utils/obraForm';
import { getObraIvaDisplay } from '../../utils/obraIva';
import {
  isPrepaidCreditObra,
  getTipoObra,
  getTipoObraLabel,
  TIPO_OBRA,
  calcObraEmpresaFinanceiro,
} from '../../utils/obraSpecial';
import { OBRA_STATUS, normalizeObraStatus, applyObraStatusChange } from '../../utils/obraStatus';
import ObraDiasTrabalhadosSection from '../../components/ObraDetalhes/ObraDiasTrabalhadosSection';
import HotelDommeControleSection from '../../components/ObraDetalhes/HotelDommeControleSection';
import ObraCreditoSection from '../../components/ObraDetalhes/ObraCreditoSection';
import { isHotelDommeObra } from '../../utils/hotelDommeCalculations';
import { getDataInicioControle } from '../../utils/controlDate';
import {
  calcGastosObra,
  calcGastosEmpresaDaObra,
  getGastosEmpresaDaObra,
  calcRecebimentosObra,
  calcDiariasObra,
  getHistorico,
} from '../../utils/calculations';
import { gerarRelatorioObraPdf } from '../../utils/gerarRelatorioObraPdf';
import { summarizeObraExtras } from '../../utils/obraExtras';
import { filterDiariasDaObra } from '../../utils/diariaObraAlocacao';
import { HELP } from '../../utils/helpTexts';
import shared from '../shared.module.css';

export default function ObraDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    funcionarios = [],
    diarias = [],
    gastos = [],
    gastosEmpresa = [],
    pagamentos = [],
    valoresAcerto = [],
    fechamentosPagamento = [],
    configuracoes,
    getObraById,
    updateObra,
    deleteObra,
  } = useApp();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pdfEstado, setPdfEstado] = useState('idle');

  useEffect(() => {
    const msg = location.state?.successMessage;
    if (!msg) return undefined;
    setSuccessMessage(msg);
    const timer = setTimeout(() => setSuccessMessage(''), 4000);
    navigate('.', { replace: true, state: {} });
    return () => clearTimeout(timer);
  }, [location.state, navigate]);

  const obra = getObraById(id);

  if (!obra) {
    return (
      <div>
        <Link to="/obras" className={shared.backLink}><ArrowLeft size={16} /> Voltar às obras</Link>
        <p>Obra não encontrada.</p>
      </div>
    );
  }

  const totalGastos = calcGastosObra(obra.id, gastos) + calcGastosEmpresaDaObra(obra.id, gastosEmpresa);
  const totalDiarias = calcDiariasObra(obra.id, diarias, funcionarios);
  let empresaFin = null;
  try {
    empresaFin = calcObraEmpresaFinanceiro(obra, {
      gastos,
      diarias,
      pagamentos,
      gastosEmpresa,
      funcionarios,
      fechamentosPagamento,
    });
  } catch (err) {
    console.error('[obra] Falha ao calcular a posição financeira', err);
  }
  const extrasResumo = empresaFin?.extras || summarizeObraExtras(obra);
  const totalRecebidoPagamentos = empresaFin?.recebidoPagamentos ?? calcRecebimentosObra(obra.id, pagamentos);
  const parceria = getTipoObra(obra) === TIPO_OBRA.PARCERIA;
  const totalRecebido = empresaFin?.recebidoTotal ?? (parceria ? totalRecebidoPagamentos + extrasResumo.recebido : totalRecebidoPagamentos);
  const totalCusto = totalGastos + totalDiarias;
  const valorOriginal = empresaFin?.valorOriginal ?? (obra.valorContratado || 0);
  const valorAtualizado = empresaFin?.valorTotalObra ?? valorOriginal + (extrasResumo.total || 0);
  const saldo =
    empresaFin?.aReceberTotal ??
    (parceria
      ? Math.max(0, valorOriginal - totalRecebidoPagamentos) + (extrasResumo.aCobrar ?? extrasResumo.cobrado ?? 0)
      : Math.max(0, valorAtualizado - totalRecebidoPagamentos));
  const dataInicioControle = getDataInicioControle(configuracoes);

  const obraDiarias = filterDiariasDaObra(diarias, obra.id);
  const obraGastos = (gastos || []).filter((g) => g && g.obraId === obra.id);
  const obraGastosEmpresa = getGastosEmpresaDaObra(obra.id, gastosEmpresa);
  const obraPagamentos = (pagamentos || []).filter((p) => p && p.obraId === obra.id);

  let historico = [];
  try {
    historico = getHistorico({
      obras: [obra],
      funcionarios,
      diarias: obraDiarias,
      valoresAcerto: (valoresAcerto || []).filter((v) => v && v.obraId === obra.id),
      gastos: obraGastos,
      gastosEmpresa: obraGastosEmpresa,
      pagamentos: obraPagamentos,
      fechamentosPagamento,
      obraId: obra.id,
    });
  } catch (err) {
    console.error('[obra] Falha ao montar o histórico', err);
  }

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleEdit = (form) => {
    updateObra(buildObraUpdate(obra, form, { funcionarios }));
    setEditModalOpen(false);
    showSuccess('Obra atualizada com sucesso.');
  };

  const handleDelete = () => {
    deleteObra(obra.id);
    setDeleteDialogOpen(false);
    navigate('/obras', { state: { successMessage: 'Obra excluída com sucesso.' } });
  };

  const handleStatusChange = (e) => {
    updateObra(applyObraStatusChange(obra, e.target.value, obra.motivoPausa));
  };

  const handleMotivoPausaChange = (e) => {
    updateObra(applyObraStatusChange(obra, 'Pausada', e.target.value));
  };

  const handleMarcarConcluida = (obraAtualizada) => {
    updateObra(obraAtualizada);
    showSuccess('Obra marcada como concluída.');
  };

  const handleGerarPdf = async () => {
    setPdfEstado('a-gerar');
    try {
      await gerarRelatorioObraPdf({
        obra,
        gastos,
        gastosEmpresa,
        diarias,
        pagamentos,
        funcionarios,
        fechamentosPagamento,
        configuracoes,
      });
      setPdfEstado('idle');
    } catch (error) {
      console.error(error);
      setPdfEstado('erro');
    }
  };

  const currentStatus = normalizeObraStatus(obra.estado);
  const ivaDisplay = getObraIvaDisplay(obra);
  const tipoObra = getTipoObra(obra);
  const prepaid = isPrepaidCreditObra(obra);
  const showIva = tipoObra !== TIPO_OBRA.ESPECIAL_TAVIRA && Boolean(obra.possuiIva);
  const showPagamentos = tipoObra !== TIPO_OBRA.ESPECIAL_TAVIRA && !prepaid;
  const showValorContratado = tipoObra !== TIPO_OBRA.ESPECIAL_TAVIRA;

  return (
    <div className={shared.page}>
      <Link to="/obras" className={shared.backLink}><ArrowLeft size={16} /> Voltar às obras</Link>

      {successMessage && (
        <div className={shared.successBanner} role="status">
          {successMessage}
        </div>
      )}

      <div className={shared.pageTitleRow}>
        <div className={prepaid ? shared.pageTitleStack : shared.pageTitleGroup}>
          <h2 className={shared.pageTitle}>{obra.nome}</h2>
          {prepaid ? (
            <div className={shared.pageMeta}>
              <div>Tipo: {getTipoObraLabel(tipoObra)}</div>
              <div>Status: {currentStatus}</div>
            </div>
          ) : (
            <>
              <ObraStatusBadge status={obra.estado} />
              <ObraTipoBadge tipo={tipoObra} />
            </>
          )}
        </div>
        <div className={shared.pageActions}>
          <Button
            variant="secondary"
            icon={FileDown}
            onClick={handleGerarPdf}
            disabled={pdfEstado === 'a-gerar'}
          >
            {pdfEstado === 'a-gerar' ? 'A gerar PDF…' : 'Gerar Relatório da Obra em PDF'}
          </Button>
          <Button variant="secondary" icon={Pencil} onClick={() => setEditModalOpen(true)}>
            Editar obra
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setDeleteDialogOpen(true)}>
            Excluir obra
          </Button>
        </div>
      </div>
      {pdfEstado === 'erro' ? (
        <p className={shared.pageMeta} role="alert">
          Não foi possível gerar o PDF. Tente novamente.
        </p>
      ) : null}

      {prepaid ? null : tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA ? (
        <div className={shared.statsRow}>
          <Card title="Forma de compensação" value="1 ano de aluguel" iconColor="blue" />
          <Card title="Diárias" value={formatCurrency(totalDiarias)} iconColor="purple" />
          <Card title="Gastos" value={formatCurrency(totalGastos)} iconColor="orange" />
          <Card title="Total investido" value={formatCurrency(totalCusto)} iconColor="red" />
        </div>
      ) : tipoObra === TIPO_OBRA.PARCERIA ? (
        <div className={shared.statsRow}>
          {showValorContratado && valorAtualizado > 0 ? (
            <Card
              title={extrasResumo.quantidade > 0 ? 'Valor total atualizado' : 'Valor total da obra'}
              value={formatCurrency(valorAtualizado)}
              iconColor="blue"
              help={extrasResumo.quantidade > 0 ? HELP.obra.valorAtualizado : HELP.obra.valorOriginal}
            />
          ) : null}
          <Card title="Gastos" value={formatCurrency(totalGastos)} iconColor="orange" />
          <Card title="Diárias" value={formatCurrency(totalDiarias)} iconColor="purple" />
          <Card title="Total recebido" value={formatCurrency(totalRecebido)} iconColor="green" help={HELP.obra.recebido} />
        </div>
      ) : tipoObra === TIPO_OBRA.CREDITO ? (
        <div className={shared.statsRow}>
          <Card
            title={extrasResumo.quantidade > 0 ? 'Valor total atualizado' : 'Valor acordado'}
            value={valorAtualizado > 0 ? formatCurrency(valorAtualizado) : 'Não informado'}
            iconColor="blue"
            help={extrasResumo.quantidade > 0 ? HELP.obra.valorAtualizado : HELP.obra.valorOriginal}
          />
          <Card title="Já recebido" value={formatCurrency(totalRecebido)} iconColor="green" help={HELP.obra.recebido} />
          <Card title="Total gasto" value={formatCurrency(totalCusto)} iconColor="orange" />
          <Card title="Resultado de caixa" value={formatCurrency(totalRecebido - totalCusto)} iconColor="cyan" />
        </div>
      ) : (
        <div className={shared.statsRow}>
          <Card title="Valor original" value={formatCurrency(valorOriginal)} iconColor="blue" help={HELP.obra.valorOriginal} />
          {extrasResumo.quantidade > 0 ? (
            <Card title="Extras/serviços" value={formatCurrency(extrasResumo.total)} iconColor="purple" help={HELP.obra.extras} />
          ) : null}
          {extrasResumo.quantidade > 0 ? (
            <Card title="Valor total atualizado" value={formatCurrency(valorAtualizado)} iconColor="blue" help={HELP.obra.valorAtualizado} />
          ) : null}
          <Card title="Gastos" value={formatCurrency(totalGastos)} iconColor="orange" />
          <Card title="Diárias" value={formatCurrency(totalDiarias)} iconColor="purple" />
          <Card title="Custo total" value={formatCurrency(totalCusto)} iconColor="red" />
          <Card title="Total recebido" value={formatCurrency(totalRecebido)} iconColor="green" help={HELP.obra.recebido} />
          <Card title="Falta receber" value={formatCurrency(saldo)} iconColor="cyan" help={HELP.obra.aReceber} />
        </div>
      )}

      {tipoObra === TIPO_OBRA.PARCERIA ? (
        <ErrorBoundary isolate label="Acertos da parceria" resetKey={obra.id}>
          <ObraParceriaAcertosSection obra={obra} onSuccess={showSuccess} />
        </ErrorBoundary>
      ) : null}
      {tipoObra === TIPO_OBRA.PARCERIA ? (
        <ErrorBoundary isolate label="Período após o Acerto" resetKey={obra.id}>
          <ObraParceriaPeriodoSection
            obra={obra}
            gastos={gastos}
            gastosEmpresa={gastosEmpresa}
            diarias={diarias}
            pagamentos={pagamentos}
            funcionarios={funcionarios}
          />
        </ErrorBoundary>
      ) : null}
      {tipoObra === TIPO_OBRA.PARCERIA ? (
        <ErrorBoundary isolate label="Resumo da parceria" resetKey={`${obra.id}-parceria-ui-20260922e`}>
          <ObraParceriaSection obra={obra} onSuccess={showSuccess} />
        </ErrorBoundary>
      ) : null}
      {tipoObra === TIPO_OBRA.CREDITO && !prepaid ? <ObraCreditoJobSection obra={obra} /> : null}
      {tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA ? <ObraTaviraSection obra={obra} /> : null}

      {prepaid && (
        <ObraCreditoSection obra={obra} onSuccess={showSuccess} />
      )}

      <ObraExtrasSection obra={obra} onSuccess={showSuccess} />

      {prepaid ? <h3 className={shared.sectionHeaderTitle}>Histórico / Documentos</h3> : null}

      <div className={shared.detailGrid}>
        <div className={shared.detailCard}>
          <h3 className={shared.detailCardTitle}>Informações da obra</h3>
          <FormGroup label="Status">
            <Select value={currentStatus} onChange={handleStatusChange}>
              {OBRA_STATUS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </FormGroup>
          {currentStatus === 'Pausada' && (
            <FormGroup label="Motivo da pausa">
              <Input
                defaultValue={obra.motivoPausa || ''}
                key={obra.motivoPausa || 'empty'}
                onBlur={handleMotivoPausaChange}
                placeholder="Ex: Falta de material"
              />
            </FormGroup>
          )}
          {[
            tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA ? null : ['Cliente', obra.cliente],
            obra.telefone ? ['Telefone', obra.telefone] : null,
            obra.morada ? ['Morada', obra.morada] : null,
            obra.dataInicio ? ['Início', formatDateOrNotInformed(obra.dataInicio)] : null,
            obra.dataPrevistaTermino ? ['Término previsto', formatDateOrNotInformed(obra.dataPrevistaTermino)] : null,
            tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA ? null : ['Observações', obra.observacoes || null],
          ]
            .filter((row) => row && row[1])
            .map(([label, value]) => (
            <div key={label} className={shared.detailRow}>
              <span className={shared.detailLabel}>{label}</span>
              <span className={shared.detailValue}>{value}</span>
            </div>
          ))}

          {showIva ? (
            <>
          <h3 className={shared.detailCardTitle} style={{ marginTop: '1.5rem' }}>IVA</h3>
          {[
            ['IVA', ivaDisplay.situacao],
            ivaDisplay.taxaLabel && ivaDisplay.taxaLabel !== '—' ? ['Taxa utilizada', ivaDisplay.taxaLabel] : null,
            ivaDisplay.valorSemIva != null ? ['Valor sem IVA', formatCurrency(ivaDisplay.valorSemIva)] : null,
            ivaDisplay.valorIva != null ? ['Valor do IVA', formatCurrency(ivaDisplay.valorIva)] : null,
            ivaDisplay.valorComIva != null ? ['Total com IVA', formatCurrency(ivaDisplay.valorComIva)] : null,
          ]
            .filter(Boolean)
            .map(([label, value]) => (
            <div key={label} className={shared.detailRow}>
              <span className={shared.detailLabel}>{label}</span>
              <span className={shared.detailValue}>{value}</span>
            </div>
          ))}
            </>
          ) : null}
        </div>

        <ObraFuncionariosSection obra={obra} onSuccess={showSuccess} />
        <ObraFinalizacaoSection
          obra={obra}
          gastos={gastos}
          gastosEmpresa={gastosEmpresa}
          diarias={diarias}
          pagamentos={pagamentos}
          funcionarios={funcionarios}
          fechamentosPagamento={fechamentosPagamento}
          dataInicioControle={dataInicioControle}
          onMarkConcluida={handleMarcarConcluida}
        />
      </div>

      {isHotelDommeObra(obra) && !prepaid && (
        <HotelDommeControleSection obra={obra} onSuccess={showSuccess} />
      )}

      {prepaid ? null : (
        <ObraDiasTrabalhadosSection obra={obra} diarias={diarias} funcionarios={funcionarios} />
      )}
      {prepaid ? null : (
      <ObraDiariasSection
        obra={obra}
        onSuccess={showSuccess}
        title="Diárias"
      />
      )}
      {prepaid ? null : (
      <ObraGastosSection
        obra={obra}
        onSuccess={showSuccess}
        title={tipoObra === TIPO_OBRA.PARCERIA ? 'Gastos / compras' : 'Gastos'}
      />
      )}
      {obraGastosEmpresa.length > 0 && (
        <section className={shared.detailCard} style={{ marginTop: '1rem' }}>
          <h3 className={shared.detailCardTitle}>Gastos da empresa associados</h3>
          <p className={shared.detailValue} style={{ marginBottom: '0.75rem' }}>
            Lançamentos únicos da área de gastos da empresa. O valor não é duplicado.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {obraGastosEmpresa.filter(Boolean).map((gasto) => (
              <li key={gasto.id} className={shared.detailRow}>
                <span className={shared.detailLabel}>
                  {gasto.data ? formatDateOrNotInformed(gasto.data) : '—'} · {gasto.descricao || gasto.categoria}
                  {gasto.veiculo ? ` · ${gasto.veiculo}` : ''}
                </span>
                <span className={shared.detailValue}>{formatCurrency(getGastoEmpresaValor(gasto))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {showPagamentos ? <ObraPagamentosSection obra={obra} onSuccess={showSuccess} /> : null}

      {tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA || tipoObra === TIPO_OBRA.CREDITO || prepaid ? null : (
      <ObraHistoricoSection
        obra={obra}
        historico={historico}
        totalRecebido={totalRecebidoPagamentos}
        totalGasto={totalCusto}
      />
      )}

      <ObraFormModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        mode="edit"
        obra={obra}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Excluir esta obra?"
        message="Esta ação irá remover a obra e os dados diretamente relacionados a ela. Tem certeza que deseja continuar?"
        cancelLabel="Cancelar"
        confirmLabel="Excluir obra"
      />
    </div>
  );
}
