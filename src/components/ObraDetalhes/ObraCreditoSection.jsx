import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import IntervencaoFormModal from './IntervencaoFormModal';
import IntervencaoDetalheModal from './IntervencaoDetalheModal';
import AssociarLancamentosModal from './AssociarLancamentosModal';
import ObraCreditoResultadoPanel from './ObraCreditoResultadoPanel';
import ProgressBar from '../ProgressBar/ProgressBar';
import { formatCurrency, formatDateOrNotInformed } from '../../utils/formatters';
import { getGastoValorAssinado } from '../../utils/gastoDocumentoTipo';
import { getGastoEmpresaValor, isGastoEmpresaPrevisto } from '../../utils/gastoEmpresaCalculations';
import {
  calcPrepaidCreditSummary,
  CONTROLE_CUSTOS,
  getIntervencaoClienteResumo,
  getIntervencaoNome,
  getIntervencaoRecords,
  getIntervencaoStatusLabel,
  isIntervencaoAbatida,
  isServicoEmAndamento,
  isStatusServicoFinal,
  montarObraNormalDesdeServicoCredito,
  patchIntervencaoControleCustos,
  reatribuirDiariaAoSairDoCredito,
  reatribuirLancamentoAoSairDoCredito,
  removeIntervencao,
  upsertIntervencao,
} from '../../utils/obraPrepaidCredit';
import { HELP } from '../../utils/helpTexts';
import HelpTip, { HelpLabel } from '../HelpTip/HelpTip';
import styles from './ObraCredito.module.css';

function formatValorServico(row) {
  if (!row || row.valorDefinido == null || !(row.valorDefinido > 0)) return 'Sem valor';
  return formatCurrency(row.valorDefinido);
}

function resultadoTexto(row) {
  if (!row || row.resultadoExibicaoTipo === 'historico') return '—';
  if (row.resultadoExibicaoValor == null) return '—';
  return formatCurrency(row.resultadoExibicaoValor);
}

function resultadoClass(row) {
  if (row.resultadoExibicaoValor == null) return '';
  if (row.resultadoExibicaoValor >= 0) return styles.valorPositivo;
  return styles.valorNegativo;
}

function statusVariant(row) {
  const status = row.statusCanonico;
  if (status === 'abatido_credito') return 'success';
  if (status === 'finalizado') return 'purple';
  if (status === 'orcamento_definido') return 'warning';
  return 'primary';
}

export default function ObraCreditoSection({
  obra,
  onSuccess,
  visao = 'interna',
  onVisaoChange,
  onGerarPdfInterno,
  onGerarPdfCliente,
  pdfEstado = 'idle',
}) {
  const {
    diarias = [],
    gastos = [],
    gastosEmpresa = [],
    funcionarios = [],
    getFuncionarioById,
    pagamentos = [],
    updateObra,
    updateDiaria,
    updateGasto,
    updateGastoEmpresa,
    updatePagamento,
    addObra,
  } = useApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [picker, setPicker] = useState(null);
  const [assignTargetId, setAssignTargetId] = useState('');
  const [transferId, setTransferId] = useState(null);
  const [unassignedDiariaIds, setUnassignedDiariaIds] = useState(() => new Set());
  const [unassignedGastoKeys, setUnassignedGastoKeys] = useState(() => new Set());

  const summary = useMemo(() => {
    try {
      return calcPrepaidCreditSummary(obra, { diarias, gastos, gastosEmpresa });
    } catch (err) {
      console.error('[obra crédito] Falha ao calcular o resumo', err);
      return null;
    }
  }, [obra, diarias, gastos, gastosEmpresa]);

  const getFuncionarioNome = (id) =>
    getFuncionarioById?.(id)?.nome || (funcionarios || []).find((item) => item?.id === id)?.nome || '—';

  if (!summary) return null;

  const visaoCliente = visao === 'cliente';
  const selected = (summary.historico || []).find((item) => item.id === selectedId) || null;
  const selectedRecords = selected
    ? getIntervencaoRecords(selected.id, { diarias, gastos, gastosEmpresa })
    : { diarias: [], gastos: [], gastosEmpresa: [] };
  const selectedHistorico = selected?.controleCustos === CONTROLE_CUSTOS.HISTORICO;

  const emAndamento = (summary.historico || []).filter((row) => isServicoEmAndamento(row));
  const concluidos = (summary.historico || []).filter((row) => isStatusServicoFinal(row));
  const servicosAtivos = (summary.historico || []).filter(
    (row) => row.controleCustos !== CONTROLE_CUSTOS.HISTORICO
  );
  const naoAtribuidos = summary.custosNaoAtribuidos || {};

  const diariasSemServico = (diarias || []).filter(
    (item) => item && item.obraId === obra?.id && !item.intervencaoId
  );
  const gastosSemServico = [
    ...(gastos || [])
      .filter((item) => item && item.obraId === obra?.id && !item.intervencaoId)
      .map((item) => ({ key: `obra:${item.id}`, kind: 'obra', record: item })),
    ...(gastosEmpresa || [])
      .filter((item) => item && item.obraId === obra?.id && !item.intervencaoId && !isGastoEmpresaPrevisto(item))
      .map((item) => ({ key: `empresa:${item.id}`, kind: 'empresa', record: item })),
  ];

  const persistObra = (nextObra, message) => {
    updateObra(nextObra);
    onSuccess?.(message);
  };

  const handleCreate = (intervencao) => {
    persistObra(upsertIntervencao(obra, intervencao), 'Serviço registado com sucesso.');
    setCreateOpen(false);
    setSelectedId(intervencao.id);
  };

  const handleEdit = (intervencao) => {
    persistObra(upsertIntervencao(obra, intervencao), 'Serviço atualizado com sucesso.');
    setEditOpen(false);
    setSelectedId(intervencao.id);
  };

  const transferTarget = (summary.historico || []).find((item) => item.id === transferId) || null;

  const confirmarTransferencia = () => {
    if (!transferTarget) return;
    const criada = addObra(montarObraNormalDesdeServicoCredito(obra, transferTarget));
    const destinoId = criada.id;
    const servicoId = transferTarget.id;
    (diarias || []).forEach((item) => {
      const next = reatribuirDiariaAoSairDoCredito(item, servicoId, obra.id, destinoId);
      if (next !== item) updateDiaria(next);
    });
    (gastos || []).forEach((item) => {
      const next = reatribuirLancamentoAoSairDoCredito(item, servicoId, obra.id, destinoId);
      if (next !== item) updateGasto(next);
    });
    (gastosEmpresa || []).forEach((item) => {
      const next = reatribuirLancamentoAoSairDoCredito(item, servicoId, obra.id, destinoId);
      if (next !== item) updateGastoEmpresa(next);
    });
    (pagamentos || []).forEach((item) => {
      const next = reatribuirLancamentoAoSairDoCredito(item, servicoId, obra.id, destinoId);
      if (next !== item) updatePagamento(next);
    });
    const semServico = removeIntervencao(obra, servicoId);
    updateObra(
      Array.isArray(obra.extras)
        ? { ...semServico, extras: obra.extras.filter((item) => item?.intervencaoId !== servicoId) }
        : semServico
    );
    setTransferId(null);
    if (selectedId === servicoId) setSelectedId(null);
    onSuccess?.('Serviço transferido para Obras Normais.');
  };

  const handleDelete = () => {
    if (!selected) return;
    selectedRecords.diarias.forEach((item) => updateDiaria({ ...item, intervencaoId: null }));
    selectedRecords.gastos.forEach((item) => updateGasto({ ...item, intervencaoId: null }));
    selectedRecords.gastosEmpresa.forEach((item) =>
      updateGastoEmpresa({ ...item, intervencaoId: null })
    );
    persistObra(
      removeIntervencao(obra, selected.id),
      isIntervencaoAbatida(selected)
        ? 'Serviço excluído. O valor abatido voltou ao saldo de crédito. Diárias e gastos passaram para Sem serviço definido.'
        : 'Serviço excluído. Diárias e gastos passaram para Sem serviço definido.'
    );
    setDeleteOpen(false);
    setSelectedId(null);
  };

  const handleMarcarCustosCompletos = () => {
    if (!selected) return;
    persistObra(
      patchIntervencaoControleCustos(obra, selected.id, CONTROLE_CUSTOS.COMPLETO),
      'Custos marcados como completos.'
    );
  };

  const applyPicker = (rows) => {
    if (!selected) return;
    rows.forEach((row) => {
      if (row.kind === 'diaria') updateDiaria({ ...row.record, intervencaoId: selected.id });
      else if (row.kind === 'obra') updateGasto({ ...row.record, intervencaoId: selected.id });
      else updateGastoEmpresa({ ...row.record, intervencaoId: selected.id });
    });
    setPicker(null);
    onSuccess?.(
      picker === 'diarias'
        ? 'Diárias associadas ao serviço.'
        : 'Gastos associados ao serviço.'
    );
  };

  const assignUnassigned = (kind) => {
    const target = servicosAtivos.find((item) => item.id === assignTargetId);
    if (!target) return;
    if (kind === 'diarias') {
      diariasSemServico
        .filter((item) => unassignedDiariaIds.has(item.id))
        .forEach((item) => updateDiaria({ ...item, intervencaoId: target.id }));
      setUnassignedDiariaIds(new Set());
      onSuccess?.('Diárias associadas ao serviço.');
      return;
    }
    gastosSemServico
      .filter((item) => unassignedGastoKeys.has(item.key))
      .forEach((item) => {
        if (item.kind === 'obra') updateGasto({ ...item.record, intervencaoId: target.id });
        else updateGastoEmpresa({ ...item.record, intervencaoId: target.id });
      });
    setUnassignedGastoKeys(new Set());
    onSuccess?.('Gastos associados ao serviço.');
  };

  const renderServicoCard = (row) => {
    const cliente = visaoCliente ? getIntervencaoClienteResumo(row) : null;
    return (
    <article key={row.id} className={styles.servicoCardCompact}>
      <button type="button" className={styles.servicoCardButton} onClick={() => setSelectedId(row.id)}>
        <div className={styles.servicoCardHead}>
          <div>
            <strong>{cliente ? cliente.titulo : getIntervencaoNome(row)}</strong>
            <span className={styles.servicoStatusRow}>
              <Badge variant={statusVariant(row)}>{cliente ? cliente.status : getIntervencaoStatusLabel(row)}</Badge>
              {isIntervencaoAbatida(row) ? <span>Abatido no crédito</span> : visaoCliente ? null : <span>Não abatido</span>}
            </span>
          </div>
        </div>
        {cliente ? (
          <div className={styles.compactGrid}>
            <div>
              <span>Período</span>
              <b>{cliente.periodo}</b>
            </div>
            <div>
              <span>Valor acordado</span>
              <b>{cliente.valor != null ? formatCurrency(cliente.valor) : 'Sem valor'}</b>
            </div>
            <div>
              <span>Status</span>
              <b>{cliente.status}</b>
            </div>
          </div>
        ) : (
        <div className={styles.compactGrid}>
          <div>
            <span>Período</span>
            <b>{typeof row.periodoLabel === 'string' && row.periodoLabel ? row.periodoLabel : '—'}</b>
          </div>
          <div>
            <span>Valor</span>
            <b>{formatValorServico(row)}</b>
          </div>
          <div>
            <span>Diárias</span>
            <b>{row.quantidadeDiarias || 0}</b>
          </div>
          <div>
            <span>Custo real</span>
            <b>{formatCurrency(row.custoTotal || 0)}</b>
          </div>
          <div>
            <span>Resultado</span>
            <b className={resultadoClass(row)}>{resultadoTexto(row)}</b>
          </div>
        </div>
        )}
      </button>
      {visaoCliente ? null : (
        <div className={styles.servicoAcao}>
          <span>
            Tratamento: {isIntervencaoAbatida(row) ? 'Abatido no crédito' : 'Destinado a abatimento no crédito'}
          </span>
          <Button type="button" size="sm" variant="secondary" onClick={() => setTransferId(row.id)}>
            Faturar como obra
          </Button>
        </div>
      )}
    </article>
    );
  };

  return (
    <div className={styles.sheet}>
      <div className={styles.visaoToggle} role="tablist" aria-label="Visão da obra">
        <button
          type="button"
          className={`${styles.tabBtn} ${!visaoCliente ? styles.tabBtnActive : ''}`}
          onClick={() => onVisaoChange?.('interna')}
        >
          Visão interna
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${visaoCliente ? styles.tabBtnActive : ''}`}
          onClick={() => onVisaoChange?.('cliente')}
        >
          Visão do cliente
        </button>
      </div>
      {visaoCliente ? (
        <p className={styles.hint}>
          Esta vista mostra só o que os donos da obra podem ver: crédito, períodos e valores
          acordados. Custos, diárias e lucro ficam na visão interna.
        </p>
      ) : null}

      <section className={styles.relatoriosBox} aria-labelledby="relatorios-obra-title">
        <h3 id="relatorios-obra-title" className={styles.sheetTitle}>
          Relatórios
        </h3>
        <p className={styles.hint}>
          O PDF interno inclui custos e resultado da Emerson Pinturas. O PDF para cliente nunca
          inclui diárias, mão de obra, custo real, gastos internos, lucro nem margem.
        </p>
        <div className={styles.relatoriosActions}>
          <Button
            variant="secondary"
            onClick={onGerarPdfInterno}
            disabled={pdfEstado !== 'idle'}
          >
            {pdfEstado === 'interno' ? 'A gerar PDF…' : 'Gerar PDF interno'}
          </Button>
          <Button onClick={onGerarPdfCliente} disabled={pdfEstado !== 'idle'}>
            {pdfEstado === 'cliente' ? 'A gerar PDF…' : 'Gerar PDF para cliente'}
          </Button>
        </div>
      </section>

      <section className={styles.resumoCredito} aria-labelledby="resumo-credito-title">
        <h3 id="resumo-credito-title" className={styles.sheetTitle}>
          Resumo do crédito
          <HelpTip text={HELP.obra.credito} />
        </h3>
        <div className={styles.ledgerResumo}>
          <div>
            <span>
              <HelpLabel text={HELP.obra.creditoRecebido}>Crédito inicial</HelpLabel>
            </span>
            <strong>{formatCurrency(summary.creditoInicial)}</strong>
          </div>
          <div>
            <span>
              <HelpLabel text={HELP.obra.abatidoCredito}>Total já abatido</HelpLabel>
            </span>
            <strong>{formatCurrency(summary.totalUtilizado)}</strong>
          </div>
          <div className={styles.ledgerSaldo}>
            <span>
              <HelpLabel text={HELP.obra.saldoCredito}>Saldo disponível</HelpLabel>
            </span>
            <strong>{formatCurrency(summary.saldoDisponivel)}</strong>
          </div>
        </div>

        <div className={styles.statsMini}>
          <div>
            <span>Total de serviços</span>
            <b>{summary.numeroIntervencoes}</b>
          </div>
          <div>
            <span>Em andamento</span>
            <b>{summary.servicosEmAndamentoCount}</b>
          </div>
          <div>
            <span>Concluídos / abatidos</span>
            <b>{summary.servicosConcluidosCount}</b>
          </div>
          {visaoCliente ? null : (
            <>
          <div>
            <span>Total de diárias</span>
            <b>{summary.quantidadeDiariasObra || 0}</b>
          </div>
          <div>
            <span>Total de gastos</span>
            <b>{formatCurrency((summary.totalMateriais || 0) + (summary.totalHospedagem || 0) + (summary.totalCombustivel || 0) + (summary.totalOutros || 0))}</b>
          </div>
          <div>
            <span>Custo total acumulado</span>
            <b>{formatCurrency(summary.custoTotalEmpresa)}</b>
          </div>
            </>
          )}
        </div>

        <div className={styles.progressWrap}>
          <span className={styles.progressCaption}>Crédito utilizado</span>
          <ProgressBar
            value={summary.percentExecutado}
            label={`${formatCurrency(summary.totalUtilizado)} de ${formatCurrency(summary.creditoInicial)}`}
          />
        </div>
      </section>

      <section className={styles.sheetBlock} aria-labelledby="servicos-andamento-title">
        <div className={styles.sheetHeader}>
          <h3 id="servicos-andamento-title" className={styles.sheetTitle}>
            Serviços em andamento
            <HelpTip text={HELP.obra.servicoCredito} />
          </h3>
          {visaoCliente ? null : (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Novo Serviço
          </Button>
          )}
        </div>
        {visaoCliente ? null : (
        <p className={styles.hint}>
          Emergências e trabalhos desta obra ficam aqui, sem criar uma obra nova. Clique no cartão
          para abrir o relatório completo.
        </p>
        )}
        {emAndamento.length === 0 ? (
          <p className={styles.hint}>Não há serviços em andamento.</p>
        ) : (
          <div className={styles.servicoList}>{emAndamento.map(renderServicoCard)}</div>
        )}
      </section>

      <section className={styles.sheetBlock} aria-labelledby="servicos-concluidos-title">
        <h3 id="servicos-concluidos-title" className={styles.sheetTitle}>
          Serviços finalizados / abatidos
        </h3>
        {concluidos.length === 0 ? (
          <p className={styles.hint}>Ainda não há serviços finalizados ou abatidos.</p>
        ) : (
          <div className={styles.servicoList}>{concluidos.map(renderServicoCard)}</div>
        )}
      </section>

      <section className={styles.sheetBlock} aria-labelledby="diarias-sem-servico-title">
        <h3 id="diarias-sem-servico-title" className={styles.sheetTitle}>
          Diárias sem serviço definido
          <HelpTip text={HELP.obra.semServico} />
        </h3>
        {naoAtribuidos.diariasCount > 0 ? (
          <p className={styles.hint}>
            {naoAtribuidos.quantidadeDiarias || 0} diária(s) · {formatCurrency(naoAtribuidos.totalDiarias || 0)}
          </p>
        ) : (
          <p className={styles.hint}>Todas as diárias desta obra estão associadas a um serviço.</p>
        )}
        {diariasSemServico.length > 0 ? (
          <>
            <div className={styles.unassignedToolbar}>
              <select
                className={styles.selectInline}
                value={assignTargetId}
                onChange={(e) => setAssignTargetId(e.target.value)}
              >
                <option value="">Associar ao serviço…</option>
                {servicosAtivos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getIntervencaoNome(item)}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                type="button"
                disabled={!assignTargetId || unassignedDiariaIds.size === 0}
                onClick={() => assignUnassigned('diarias')}
              >
                Associar seleccionadas
              </Button>
            </div>
            <div className={styles.pickerList}>
              {diariasSemServico.map((item) => (
                <label key={item.id} className={styles.pickerRow}>
                  <input
                    type="checkbox"
                    checked={unassignedDiariaIds.has(item.id)}
                    onChange={() => {
                      setUnassignedDiariaIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                  />
                  <span className={styles.pickerMeta}>
                    <strong>{getFuncionarioNome(item.funcionarioId)}</strong>
                    <span>{formatDateOrNotInformed(item.data)}</span>
                    <span>{formatCurrency((Number(item.quantidade) || 0) * (Number(item.valorDiaria) || 0))}</span>
                    {item.observacao ? <span>{item.observacao}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className={styles.sheetBlock} aria-labelledby="gastos-sem-servico-title">
        <h3 id="gastos-sem-servico-title" className={styles.sheetTitle}>
          Gastos sem serviço definido
          <HelpTip text={HELP.obra.semServico} />
        </h3>
        {naoAtribuidos.gastosCount > 0 ? (
          <p className={styles.hint}>{formatCurrency(naoAtribuidos.totalGastos || 0)} em gastos por associar.</p>
        ) : (
          <p className={styles.hint}>Todos os gastos desta obra estão associados a um serviço.</p>
        )}
        {gastosSemServico.length > 0 ? (
          <>
            <div className={styles.unassignedToolbar}>
              <select
                className={styles.selectInline}
                value={assignTargetId}
                onChange={(e) => setAssignTargetId(e.target.value)}
              >
                <option value="">Associar ao serviço…</option>
                {servicosAtivos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getIntervencaoNome(item)}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                type="button"
                disabled={!assignTargetId || unassignedGastoKeys.size === 0}
                onClick={() => assignUnassigned('gastos')}
              >
                Associar seleccionados
              </Button>
            </div>
            <div className={styles.pickerList}>
              {gastosSemServico.map((item) => (
                <label key={item.key} className={styles.pickerRow}>
                  <input
                    type="checkbox"
                    checked={unassignedGastoKeys.has(item.key)}
                    onChange={() => {
                      setUnassignedGastoKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.key)) next.delete(item.key);
                        else next.add(item.key);
                        return next;
                      });
                    }}
                  />
                  <span className={styles.pickerMeta}>
                    <strong>{formatDateOrNotInformed(item.record.data)}</strong>
                    <span>{item.record.fornecedorNome || item.record.fornecedor || item.record.categoria || '—'}</span>
                    <span>{item.record.categoria || item.record.descricao || '—'}</span>
                    <span>
                      {formatCurrency(
                        item.kind === 'obra'
                          ? getGastoValorAssinado(item.record)
                          : getGastoEmpresaValor(item.record)
                      )}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <ObraCreditoResultadoPanel summary={summary} />

      <IntervencaoDetalheModal
        isOpen={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        servico={selected}
        obra={obra}
        diarias={diarias}
        gastos={gastos}
        gastosEmpresa={gastosEmpresa}
        getFuncionarioNome={getFuncionarioNome}
        historico={selectedHistorico}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onAddDiarias={() => setPicker('diarias')}
        onAddGastos={() => setPicker('gastos')}
        onMarcarCustosCompletos={handleMarcarCustosCompletos}
      />

      <AssociarLancamentosModal
        isOpen={picker === 'diarias'}
        onClose={() => setPicker(null)}
        mode="diarias"
        obra={obra}
        targetIntervencao={selected}
        servicos={summary.historico || []}
        diarias={diarias}
        getFuncionarioNome={getFuncionarioNome}
        onConfirm={applyPicker}
      />

      <AssociarLancamentosModal
        isOpen={picker === 'gastos'}
        onClose={() => setPicker(null)}
        mode="gastos"
        obra={obra}
        targetIntervencao={selected}
        servicos={summary.historico || []}
        gastos={gastos}
        gastosEmpresa={gastosEmpresa}
        onConfirm={applyPicker}
      />

      <IntervencaoFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        summary={summary}
        onSubmit={handleCreate}
      />

      <IntervencaoFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        intervencao={selected}
        summary={summary}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        isOpen={Boolean(transferTarget)}
        onClose={() => setTransferId(null)}
        onConfirm={confirmarTransferencia}
        title="Faturar como obra?"
        cancelLabel="Cancelar"
        confirmLabel="Confirmar transferência"
      >
        <p className={confirmStyles.message}>
          Este serviço deixará de ser abatido do crédito e será transferido para Obras Normais. O valor será retirado dos abatimentos do crédito e o serviço levará todas as suas informações.
        </p>
      </ConfirmDialog>

      {selected && (
        <ConfirmDialog
          isOpen={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
          title="Excluir serviço?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir serviço"
        >
          <p className={confirmStyles.message}>
            O serviço deixa de existir. As diárias e os gastos passam para Sem serviço definido —
            não são apagados.
            {isIntervencaoAbatida(selected)
              ? ` Este serviço já abateu ${formatCurrency(selected.valorAbatido)} do crédito. Esse valor volta ao saldo disponível.`
              : ''}
          </p>
          <div className={confirmStyles.details}>
            {[
              ['Serviço', getIntervencaoNome(selected)],
              selected.valorDefinido > 0 ? ['Valor', formatCurrency(selected.valorDefinido)] : null,
            ]
              .filter(Boolean)
              .map(([label, value]) => (
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
