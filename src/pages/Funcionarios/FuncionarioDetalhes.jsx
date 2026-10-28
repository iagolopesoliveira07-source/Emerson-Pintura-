import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Badge from '../../components/Badge/Badge';
import Button from '../../components/Button/Button';
import Card from '../../components/Card/Card';
import FuncionarioFormModal from '../../components/FuncionarioForm/FuncionarioFormModal';
import FuncionarioDescontosSection from '../../components/FuncionarioDetalhes/FuncionarioDescontosSection';
import FuncionarioPagamentosSection from '../../components/FuncionarioDetalhes/FuncionarioPagamentosSection';
import FuncionarioFechamentosSection from '../../components/FuncionarioDetalhes/FuncionarioFechamentosSection';
import FecharPagamentoModal from '../../components/FuncionarioDetalhes/FecharPagamentoModal';
import ComprovativoPagamentoModal from '../../components/ComprovativoPagamento/ComprovativoPagamentoModal';
import FuncionarioObservacoesDiariasSection from '../../components/FuncionarioDetalhes/FuncionarioObservacoesDiariasSection';
import DiariasConferenciaTable from '../../components/FuncionarioDetalhes/DiariasConferenciaTable';
import FuncionarioDiariasSemanaSection from '../../components/FuncionarioDetalhes/FuncionarioDiariasSemanaSection';
import DiariaFormModal from '../../components/DiariaForm/DiariaFormModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { persistFuncionarioForm, getFuncionarioDeleteSummary } from '../../utils/funcionarioForm';
import { buildDiariaUpdate } from '../../utils/diariaForm';
import { getFuncionarioPagamentoResumo } from '../../utils/pagamentoPeriodCalculations';
import {
  calcTotalPagamentosFuncionario,
  calcSaldoFuncionario,
  calcDiariaTotal,
  calcDescontosMensaisAtivos,
  getHistorico,
} from '../../utils/calculations';
import {
  buildPaymentPreview,
  getDefaultPaymentSelections,
  getDiariasPendentes,
  hasPendingPaymentItems,
  calcTotalFechamentosFuncionario,
  sameFuncionarioId,
} from '../../utils/fechamentoPagamentoCalculations';
import { getFuncionarioPeriodoObservacoesResumo } from '../../utils/diariaObservacaoCalculations';
import { filterByPeriod, summarizeDiariasPeriodo } from '../../utils/periodFilter';
import { usePeriodFilter } from '../../hooks/usePeriodFilter';
import PeriodFilter from '../../components/PeriodFilter/PeriodFilter';
import HelpTip from '../../components/HelpTip/HelpTip';
import { HELP } from '../../utils/helpTexts';
import {
  isParceiroFuncionario,
  getTipoFuncionarioLabel,
  buildParceiroParticipacao,
} from '../../utils/funcionarioTipo';
import styles from '../../components/FuncionarioDetalhes/FechamentoPagamento.module.css';
import shared from '../shared.module.css';

export default function FuncionarioDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    funcionarios,
    diarias,
    valoresAcerto,
    pagamentos,
    fechamentosPagamento,
    obras,
    getFuncionarioById,
    getObraById,
    addFuncionario,
    updateFuncionario,
    deleteFuncionario,
    executarFechamentoPagamento,
    corrigirComprovativoPagamento,
    marcarDiariaComoPaga,
    updateDiaria,
    configuracoes,
  } = useApp();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editDiariaOpen, setEditDiariaOpen] = useState(false);
  const [diariaEmEdicao, setDiariaEmEdicao] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fecharPagamentoOpen, setFecharPagamentoOpen] = useState(false);
  const [fecharPagamentoPreset, setFecharPagamentoPreset] = useState(null);
  const [comprovativoFechamento, setComprovativoFechamento] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const period = usePeriodFilter();

  const func = getFuncionarioById(id);
  const isParceiro = isParceiroFuncionario(func);

  const pendingPreview = useMemo(() => {
    if (!func) return null;
    const selections = getDefaultPaymentSelections(func, diarias, valoresAcerto, id);
    return buildPaymentPreview({
      funcionario: func,
      funcionarioId: id,
      diarias,
      valoresAcerto,
      fechamentosPagamento,
      selections,
    });
  }, [func, id, diarias, valoresAcerto, fechamentosPagamento]);

  const funcDiarias = useMemo(() => {
    if (!func) return [];
    return diarias
      .filter((d) => sameFuncionarioId(d.funcionarioId, id))
      .sort((a, b) => {
        if (!a.data && !b.data) return 0;
        if (!a.data) return 1;
        if (!b.data) return -1;
        return a.data.localeCompare(b.data);
      });
  }, [diarias, id, func]);

  const funcDiariasPeriodo = useMemo(
    () => filterByPeriod(funcDiarias, period.range),
    [funcDiarias, period.range]
  );

  const participacao = useMemo(
    () => (func ? buildParceiroParticipacao(id, { diarias: funcDiarias, obras }) : null),
    [func, id, funcDiarias, obras]
  );

  const resumoPeriodo = useMemo(
    () => summarizeDiariasPeriodo(funcDiariasPeriodo),
    [funcDiariasPeriodo]
  );

  const diariasPendentesFuncionario = useMemo(() => {
    if (!func) return [];
    return getDiariasPendentes(id, diarias, fechamentosPagamento, funcionarios).sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return a.data.localeCompare(b.data);
    });
  }, [id, diarias, fechamentosPagamento, func, funcionarios]);

  if (!func) {
    return (
      <div>
        <Link to="/funcionarios" className={shared.backLink}><ArrowLeft size={16} /> Voltar</Link>
        <p>Funcionário não encontrado.</p>
      </div>
    );
  }

  const diariasPendentes = getDiariasPendentes(id, diarias, fechamentosPagamento, funcionarios);
  const totalDiariasPendentes = diariasPendentes.reduce((s, d) => s + calcDiariaTotal(d), 0);
  const totalPagamentos = calcTotalPagamentosFuncionario(id, pagamentos, funcionarios);
  const totalFechamentos = calcTotalFechamentosFuncionario(id, fechamentosPagamento);
  const descontosMensais = calcDescontosMensaisAtivos(func);
  const saldo = calcSaldoFuncionario(id, {
    diarias,
    pagamentos,
    funcionarios,
    valoresAcerto,
    fechamentosPagamento,
  });
  const pagamentoResumo = getFuncionarioPagamentoResumo(func, fechamentosPagamento);
  const periodoObservacoesResumo = getFuncionarioPeriodoObservacoesResumo(
    func,
    diarias,
    fechamentosPagamento
  );
  const hasPending = pendingPreview ? hasPendingPaymentItems(pendingPreview) : false;

  const funcValoresAcerto = (valoresAcerto || []).filter((v) => v && v.funcionarioId === id);
  const funcPagamentos = (pagamentos || []).filter((p) => p && p.pessoaRelacionada === func.nome);

  let historico = [];
  try {
    historico = getHistorico({
      obras: [],
      funcionarios: [func],
      diarias: funcDiarias,
      valoresAcerto: funcValoresAcerto,
      gastos: [],
      pagamentos: funcPagamentos,
      fechamentosPagamento,
    });
  } catch (err) {
    console.error('[funcionário] Falha ao montar o histórico', err);
  }

  const saveActions = { addFuncionario, updateFuncionario };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleMarcarDiariaPaga = (diaria) => {
    const result = marcarDiariaComoPaga(diaria.id);
    if (result.error) {
      window.alert(result.error);
      return;
    }
    showSuccess('Diária marcada como paga.');
  };

  const handleEditarDiaria = (diaria) => {
    setDiariaEmEdicao(diaria);
    setEditDiariaOpen(true);
  };

  const handleSalvarDiaria = (form) => {
    if (!diariaEmEdicao?.id) return;
    const actualizada = buildDiariaUpdate(diariaEmEdicao, form, {
      parceiro: isParceiroFuncionario(func),
    });
    updateDiaria({
      ...actualizada,
      id: diariaEmEdicao.id,
      funcionarioId: diariaEmEdicao.funcionarioId,
      createdAt: diariaEmEdicao.createdAt,
      fechamentoPagamentoId: diariaEmEdicao.fechamentoPagamentoId,
      statusPagamento: diariaEmEdicao.statusPagamento,
    });
    setEditDiariaOpen(false);
    setDiariaEmEdicao(null);
    showSuccess('Diária atualizada.');
  };

  const handleEdit = (form) => {
    persistFuncionarioForm(form, {
      mode: 'edit',
      funcionario: func,
      actions: saveActions,
    });
    setEditModalOpen(false);
    showSuccess('Funcionário atualizado com sucesso.');
  };

  const handleDelete = () => {
    deleteFuncionario(func.id);
    setDeleteDialogOpen(false);
    navigate('/funcionarios', { state: { successMessage: 'Funcionário excluído com sucesso.' } });
  };

  const handleFecharPagamento = async (payload) => {
    const result = executarFechamentoPagamento(payload);
    if (result?.error) return result;
    setFecharPagamentoPreset(null);
    showSuccess('Pagamento registado com sucesso.');
    if (result?.fechamento) setComprovativoFechamento(result.fechamento);
    return result;
  };

  const deleteSummary = getFuncionarioDeleteSummary(func.id, {
    diarias,
    valoresAcerto,
    pagamentos,
    funcionarios,
  });

  return (
    <div className={shared.page}>
      <Link to="/funcionarios" className={shared.backLink}><ArrowLeft size={16} /> Voltar</Link>

      {successMessage && (
        <div className={shared.successBanner} role="status">
          {successMessage}
        </div>
      )}

      <div className={shared.pageTitleRow}>
        <div className={shared.pageTitleGroup}>
          <h2 className={shared.pageTitle}>{func.nome}</h2>
          {isParceiro ? <Badge variant="info">Parceiro</Badge> : null}
          <Badge>{func.estado}</Badge>
        </div>
        <div className={shared.pageActions}>
          <Button variant="secondary" icon={Pencil} onClick={() => setEditModalOpen(true)}>
            Editar funcionário
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setDeleteDialogOpen(true)}>
            Excluir funcionário
          </Button>
        </div>
      </div>

      {isParceiro ? (
        <div className={shared.statsRow}>
          <Card title="Dias trabalhados" value={participacao?.quantidade || 0} iconColor="blue" />
          <Card title="N.º de diárias" value={participacao?.registos || 0} iconColor="cyan" />
          <Card title="Obras" value={participacao?.obras?.length || 0} iconColor="green" />
        </div>
      ) : (
        <div className={shared.statsRow}>
          <Card title="Diárias pendentes" value={formatCurrency(totalDiariasPendentes)} iconColor="blue" help={HELP.diaria.pendente} />
          <Card title="Total já pago" value={formatCurrency(totalFechamentos)} iconColor="cyan" />
          <Card title="Saldo a pagar" value={formatCurrency(saldo)} iconColor="green" />
        </div>
      )}

      <div className={shared.detailGrid}>
        <div className={shared.detailCard}>
          <h3 className={shared.detailCardTitle}>Informações pessoais</h3>
          {[
            ['Tipo', getTipoFuncionarioLabel(func)],
            ['Telefone', func.telefone || '—'],
            ...(isParceiro
              ? [
                  ['Diárias trabalhadas', participacao?.quantidade || 0],
                  ['Obras com participação', participacao?.obras?.length || 0],
                  ['Observações nas diárias', periodoObservacoesResumo.quantidade],
                ]
              : [
                  ['Valor da diária', formatCurrency(func.valorDiaria)],
                  ['Frequência de pagamento', pagamentoResumo.frequencia],
                  ['Período actual', pagamentoResumo.periodLabel],
                  ['Situação do pagamento', pagamentoResumo.statusLabel],
                  ['Diárias trabalhadas', funcDiarias.reduce((s, d) => s + d.quantidade, 0)],
                  ['Observações nas diárias', periodoObservacoesResumo.quantidade],
                ]),
          ].map(([label, value]) => (
            <div key={label} className={shared.detailRow}>
              <span className={shared.detailLabel}>{label}</span>
              <span className={shared.detailValue}>{value}</span>
            </div>
          ))}
        </div>

        {isParceiro ? (
          <div className={shared.detailCard}>
            <h3 className={shared.detailCardTitle}>Participação nas obras</h3>
            <p className={styles.semPendentes} style={{ marginTop: 0 }}>
              As diárias servem só para controlo de presença. A participação no lucro trata-se na obra em parceria.
            </p>
            {(participacao?.obras || []).length === 0 ? (
              <p className={styles.semPendentes}>Ainda não há diárias de presença registadas.</p>
            ) : (
              (participacao.obras || []).map((obra) => (
                <div key={obra.obraId || obra.nome} className={shared.detailRow}>
                  <span className={shared.detailLabel}>{obra.nome}</span>
                  <span className={shared.detailValue}>
                    {obra.quantidade} {obra.quantidade === 1 ? 'diária' : 'diárias'} · {obra.registos}{' '}
                    {obra.registos === 1 ? 'dia' : 'dias'}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
        <div className={shared.detailCard}>
          <h3 className={shared.detailCardTitle}>Resumo financeiro</h3>
          {[
            ['Diárias pendentes', formatCurrency(totalDiariasPendentes)],
            ['Descontos a realizar', descontosMensais.totalRecorrenteAtivo > 0 ? formatCurrency(descontosMensais.totalRecorrenteAtivo) : '—'],
            ['Parcelas pendentes', descontosMensais.proximoDesconto > 0 ? formatCurrency(descontosMensais.proximoDesconto) : '—'],
            ['Pagamentos fechados', formatCurrency(totalFechamentos)],
            ['Pagamentos manuais', totalPagamentos > 0 ? formatCurrency(totalPagamentos) : '—'],
            ['Saldo a pagar', formatCurrency(saldo)],
          ].map(([label, value]) => (
            <div key={label} className={shared.detailRow}>
              <span className={shared.detailLabel}>{label}</span>
              <span
                className={shared.detailValue}
                style={label === 'Saldo a pagar' ? { color: 'var(--color-primary)', fontWeight: 700 } : {}}
              >
                {value}
              </span>
            </div>
          ))}

          <div className={styles.fecharBtnWrap}>
            {diariasPendentesFuncionario.length > 0 && (
              <>
                <p className={styles.sectionLabel} style={{ marginTop: 0 }}>
                  Diárias pendentes — conferência
                </p>
                <DiariasConferenciaTable
                  diarias={diariasPendentesFuncionario}
                  emptyMessage="Sem diárias pendentes."
                  onEditarDiaria={handleEditarDiaria}
                />
              </>
            )}
            {hasPending ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Button icon={CheckCircle} onClick={() => setFecharPagamentoOpen(true)}>
                  Fechar pagamento
                </Button>
                <HelpTip text={HELP.diaria.fecharPagamento} />
              </span>
            ) : (
              <span className={styles.semPendentes}>Sem valores pendentes</span>
            )}
            {pendingPreview && hasPending && (
              <span className={styles.semPendentes}>
                Próximo pagamento: {formatCurrency(pendingPreview.totalPago)}
              </span>
            )}
          </div>
        </div>
        )}
      </div>

      <FuncionarioObservacoesDiariasSection
        resumo={periodoObservacoesResumo}
        modoParceiro={isParceiro}
        diarias={diarias}
        onEditarDiaria={handleEditarDiaria}
      />

      <div className={shared.detailCard}>
        <h3 className={shared.detailCardTitle}>Consulta por período</h3>
        <PeriodFilter
          preset={period.preset}
          onPresetChange={period.setPreset}
          customInicio={period.customInicio}
          customFim={period.customFim}
          onCustomInicioChange={period.setCustomInicio}
          onCustomFimChange={period.setCustomFim}
          label={period.label}
        />
        <div className={shared.statsRow} style={{ marginTop: '1rem' }}>
          <Card title="Dias trabalhados" value={resumoPeriodo.dias} iconColor="blue" />
          <Card title="Diárias" value={resumoPeriodo.quantidade} iconColor="cyan" help={HELP.relatorio.totalDiarias} />
          {isParceiro ? null : (
            <Card title="Valor das diárias" value={formatCurrency(resumoPeriodo.total)} iconColor="green" />
          )}
          <Card title="Com observação" value={resumoPeriodo.observacoes} iconColor="orange" help={HELP.diaria.observacao} />
        </div>
      </div>

      <div className={shared.detailCard}>
        <h3 className={shared.detailCardTitle}>Diárias</h3>
        <FuncionarioDiariasSemanaSection
          diarias={funcDiariasPeriodo}
          fechamentosPagamento={fechamentosPagamento}
          getObraById={getObraById}
          onMarcarDiariaPaga={handleMarcarDiariaPaga}
          onEditarDiaria={handleEditarDiaria}
          modoParceiro={isParceiro}
        />
      </div>

      {isParceiro ? (
        <div className={shared.detailCard}>
          <h3 className={shared.detailCardTitle}>Histórico de participação</h3>
          {(participacao?.dias || []).length === 0 ? (
            <p className={styles.semPendentes}>Ainda não há diárias de presença.</p>
          ) : (
            (participacao.dias || []).slice().reverse().slice(0, 30).map((item) => (
              <div key={item.id} className={shared.detailRow}>
                <span className={shared.detailLabel}>
                  {item.data ? formatDate(item.data) : 'Sem data'} · {item.obraNome}
                </span>
                <span className={shared.detailValue}>
                  {item.quantidade} {item.quantidade === 1 ? 'diária' : 'diárias'}
                  {item.observacao ? ` · ${item.observacao}` : ''}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
      <FuncionarioDescontosSection funcionario={func} onSuccess={showSuccess} />
      <FuncionarioFechamentosSection
        funcionario={func}
        fechamentosPagamento={fechamentosPagamento}
        periodRange={period.range}
        diarias={diarias}
        empresaNome={configuracoes?.nomeEmpresa || 'Emerson Pinturas'}
        onCorrigir={(fechamentoId, snapshot, observacao) => {
          const result = corrigirComprovativoPagamento(fechamentoId, { snapshot, observacao });
          if (result?.error) return;
          showSuccess('Pagamento corrigido. O comprovativo original foi preservado.');
        }}
      />
      <FuncionarioPagamentosSection
        funcionario={func}
        onSuccess={showSuccess}
        periodRange={period.range}
      />

      <div className={shared.detailCard}>
        <h3 className={shared.detailCardTitle}>Histórico</h3>
        {historico.slice(0, 10).map((item) => (
          <div key={item.id} className={shared.detailRow}>
            <span className={shared.detailLabel}>{item.descricao}</span>
            <span className={shared.detailValue}>{formatCurrency(item.valor)} — {formatDate(item.data)}</span>
          </div>
        ))}
      </div>
        </>
      )}

      {isParceiro ? null : (
        <>
      <FecharPagamentoModal
        isOpen={fecharPagamentoOpen}
        onClose={() => {
          setFecharPagamentoOpen(false);
          setFecharPagamentoPreset(null);
        }}
        onConfirm={handleFecharPagamento}
        funcionario={func}
        diarias={diarias}
        valoresAcerto={valoresAcerto}
        fechamentosPagamento={fechamentosPagamento}
        initialPreset={fecharPagamentoPreset}
      />

      <ComprovativoPagamentoModal
        isOpen={Boolean(comprovativoFechamento)}
        onClose={() => setComprovativoFechamento(null)}
        fechamento={comprovativoFechamento}
        diarias={diarias}
        empresaNome={configuracoes?.nomeEmpresa || 'Emerson Pinturas'}
        onCorrigir={(snapshot, observacao) => {
          if (!comprovativoFechamento?.id) return;
          const result = corrigirComprovativoPagamento(comprovativoFechamento.id, { snapshot, observacao });
          if (result?.fechamento) setComprovativoFechamento(result.fechamento);
        }}
      />

        </>
      )}

      <DiariaFormModal
        isOpen={editDiariaOpen}
        onClose={() => {
          setEditDiariaOpen(false);
          setDiariaEmEdicao(null);
        }}
        mode="edit"
        diaria={diariaEmEdicao}
        funcionarios={funcionarios}
        obras={obras}
        onSubmit={handleSalvarDiaria}
      />

      <FuncionarioFormModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        mode="edit"
        funcionario={func}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Excluir funcionário?"
        message={
          deleteSummary.hasFinancialRecords
            ? 'Este funcionário possui registros financeiros associados. Tem certeza que deseja excluir?'
            : 'Tem certeza que deseja excluir este funcionário?'
        }
        cancelLabel="Cancelar"
        confirmLabel="Excluir funcionário"
      >
        {deleteSummary.hasFinancialRecords && (
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {deleteSummary.counts.diarias > 0 && <li>{deleteSummary.counts.diarias} diária(s)</li>}
            {deleteSummary.counts.valoresAcerto > 0 && <li>{deleteSummary.counts.valoresAcerto} valor(es) para acerto</li>}
            {deleteSummary.counts.pagamentos > 0 && <li>{deleteSummary.counts.pagamentos} pagamento(s)</li>}
            {deleteSummary.counts.alugueis > 0 && <li>{deleteSummary.counts.alugueis} aluguel(is)</li>}
            {deleteSummary.counts.descontosMensais > 0 && (
              <li>{deleteSummary.counts.descontosMensais} desconto(s) mensal(is)</li>
            )}
          </ul>
        )}
      </ConfirmDialog>
    </div>
  );
}
