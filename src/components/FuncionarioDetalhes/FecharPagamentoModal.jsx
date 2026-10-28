import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormActions, FormRow } from '../Form/Form';
import { formatCurrency, formatDate, getTodayISO } from '../../utils/formatters';
import { getValorADevolver } from '../../utils/acertoCalculations';
import { SEMANAS_MES, getSemanaLabel, getSemanaDoMes } from '../../utils/semanaMesCalculations';
import {
  TIPO_PAGAMENTO,
  buildPaymentPreview,
  getDefaultPaymentSelections,
  getDiariasPendentes,
  canConfirmFechamento,
} from '../../utils/fechamentoPagamentoCalculations';
import { frequenciaToTipoPagamento, getFrequenciaPagamento } from '../../utils/pagamentoPeriodCalculations';
import DiariasPagamentoSelector from './DiariasPagamentoSelector';
import styles from './FechamentoPagamento.module.css';
import { HELP } from '../../utils/helpTexts';
import HelpTip from '../HelpTip/HelpTip';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';

export default function FecharPagamentoModal({
  isOpen,
  onClose,
  onConfirm,
  funcionario,
  diarias,
  valoresAcerto,
  fechamentosPagamento = [],
  initialPreset = null,
}) {
  const [tipoPagamento, setTipoPagamento] = useState(TIPO_PAGAMENTO.SEMANAL);
  const [referencia, setReferencia] = useState('');
  const [observacao, setObservacao] = useState('');
  const [dataPagamento, setDataPagamento] = useState(getTodayISO());
  const [semanaMes, setSemanaMes] = useState(getSemanaDoMes());
  const [acertoIds, setAcertoIds] = useState([]);
  const [recorrenteCommitmentIds, setRecorrenteCommitmentIds] = useState([]);
  const [parcelaCommitmentIds, setParcelaCommitmentIds] = useState([]);
  const [descontoValores, setDescontoValores] = useState({});
  const [acrescimoAtivo, setAcrescimoAtivo] = useState(false);
  const [acrescimoValor, setAcrescimoValor] = useState('');
  const [acrescimoObservacao, setAcrescimoObservacao] = useState('');
  const [descontoManualAtivo, setDescontoManualAtivo] = useState(false);
  const [descontoManualValor, setDescontoManualValor] = useState('');
  const [descontoManualObservacao, setDescontoManualObservacao] = useState('');
  const [gratificacaoAtiva, setGratificacaoAtiva] = useState(false);
  const [gratificacaoValor, setGratificacaoValor] = useState('');
  const [gratificacaoObservacao, setGratificacaoObservacao] = useState('');
  const [extras, setExtras] = useState([]);
  const [diariaIds, setDiariaIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !funcionario) return;

    const defaults = getDefaultPaymentSelections(
      funcionario,
      diarias,
      valoresAcerto,
      funcionario.id
    );

    const pendentes = getDiariasPendentes(
      funcionario.id,
      diarias,
      fechamentosPagamento,
      [funcionario]
    );
    setDiariaIds(initialPreset?.diariaIds ?? pendentes.map((item) => item.id));
    setAcertoIds(initialPreset?.acertoIds ?? defaults.acertoIds);
    setRecorrenteCommitmentIds(
      initialPreset?.recorrenteCommitmentIds ?? defaults.recorrenteCommitmentIds
    );
    setParcelaCommitmentIds(
      initialPreset?.parcelaCommitmentIds ?? defaults.parcelaCommitmentIds
    );
    setDescontoValores({});
    setSemanaMes(initialPreset?.semanaMes ?? getSemanaDoMes());
    setTipoPagamento(
      initialPreset?.tipoPagamento ||
        frequenciaToTipoPagamento(getFrequenciaPagamento(funcionario))
    );
    setDataPagamento(getTodayISO());
    setReferencia('');
    setObservacao('');
    setAcrescimoAtivo(false);
    setAcrescimoValor('');
    setAcrescimoObservacao('');
    setDescontoManualAtivo(false);
    setDescontoManualValor('');
    setDescontoManualObservacao('');
    setGratificacaoAtiva(false);
    setGratificacaoValor('');
    setGratificacaoObservacao('');
    setExtras([]);
    setSubmitting(false);
    setError('');
  }, [isOpen, funcionario, diarias, valoresAcerto, fechamentosPagamento, initialPreset]);

  const ajustesManuais = useMemo(
    () => ({
      acrescimo: {
        ativa: acrescimoAtivo,
        valor: acrescimoValor,
        observacao: acrescimoObservacao,
      },
      gratificacao: {
        ativa: gratificacaoAtiva,
        valor: gratificacaoValor,
        observacao: gratificacaoObservacao,
      },
      desconto: {
        ativa: descontoManualAtivo,
        valor: descontoManualValor,
        observacao: descontoManualObservacao,
      },
      extras,
    }),
    [
      acrescimoAtivo,
      acrescimoValor,
      acrescimoObservacao,
      gratificacaoAtiva,
      gratificacaoValor,
      gratificacaoObservacao,
      descontoManualAtivo,
      descontoManualValor,
      descontoManualObservacao,
      extras,
    ]
  );

  const selections = useMemo(
    () => ({
      diariaIds,
      acertoIds,
      recorrenteCommitmentIds,
      parcelaCommitmentIds,
      descontoValores,
    }),
    [diariaIds, acertoIds, recorrenteCommitmentIds, parcelaCommitmentIds, descontoValores]
  );

  const preview = useMemo(() => {
    if (!funcionario) return null;
    return buildPaymentPreview({
      funcionario,
      funcionarioId: funcionario.id,
      diarias,
      valoresAcerto,
      fechamentosPagamento,
      selections,
      referenceDate: dataPagamento,
      ajustesManuais,
    });
  }, [
    funcionario,
    diarias,
    valoresAcerto,
    fechamentosPagamento,
    selections,
    dataPagamento,
    ajustesManuais,
  ]);

  const toggleAcerto = (id) => {
    setAcertoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleRecorrente = (id) => {
    setRecorrenteCommitmentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleParcela = (id) => {
    setParcelaCommitmentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const descontoMarcado = (item) =>
    item.modalidade === 'parcelado'
      ? parcelaCommitmentIds.includes(item.commitmentId)
      : recorrenteCommitmentIds.includes(item.commitmentId);

  const toggleDesconto = (item) => {
    const marcado = descontoMarcado(item);
    if (item.modalidade === 'parcelado') toggleParcela(item.commitmentId);
    else toggleRecorrente(item.commitmentId);
    if (!marcado) {
      setDescontoValores((prev) => ({
        ...prev,
        [item.commitmentId]: prev[item.commitmentId] ?? String(item.sugerido ?? item.valor ?? ''),
      }));
    }
  };

  const handleConfirm = async () => {
    if (!preview || !canConfirmFechamento(preview, selections, null, ajustesManuais)) {
      setError('Seleccione diárias, descontos ou valores manuais para fechar o pagamento.');
      return;
    }

    if (acrescimoAtivo) {
      const valor = parseFloat(acrescimoValor);
      if (Number.isNaN(valor) || valor <= 0) {
        setError('Informe um valor válido para o acréscimo manual.');
        return;
      }
    }

    if (descontoManualAtivo) {
      const valor = parseFloat(descontoManualValor);
      if (Number.isNaN(valor) || valor <= 0) {
        setError('Informe um valor válido para o desconto manual.');
        return;
      }
    }

    if (gratificacaoAtiva) {
      const valor = parseFloat(gratificacaoValor);
      if (Number.isNaN(valor) || valor <= 0) {
        setError('Informe um valor válido para a gratificação.');
        return;
      }
    }

    for (const extra of extras) {
      const valor = parseFloat(extra.valor);
      if (!extra.descricao?.trim() || Number.isNaN(valor) || valor <= 0) {
        setError('Cada ajuste extra precisa de descrição e valor.');
        return;
      }
    }

    const descontosEscolhidos = [
      ...(preview?.parcelasSelecionadas || []),
      ...(preview?.recorrentesSelecionados || []),
    ];
    const acimaDoSaldo = descontosEscolhidos.find((item) => item.valor - (item.saldo || 0) > 0.009);
    if (acimaDoSaldo) {
      setError(`O valor de ${acimaDoSaldo.descricao} é maior do que o saldo.`);
      return;
    }

    const hasDescontos =
      recorrenteCommitmentIds.length > 0 || parcelaCommitmentIds.length > 0;
    if (tipoPagamento === TIPO_PAGAMENTO.SEMANAL && hasDescontos && !semanaMes) {
      setError('Seleccione a semana em que os descontos serão aplicados.');
      return;
    }

    setSubmitting(true);
    setError('');

    const result = await onConfirm({
      funcionarioId: funcionario.id,
      tipoPagamento,
      referencia,
      observacao,
      data: dataPagamento,
      semanaMes: tipoPagamento === TIPO_PAGAMENTO.SEMANAL ? semanaMes : null,
      selections,
      ajustesManuais,
    });

    setSubmitting(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    onClose();
  };

  if (!funcionario || !preview) return null;

  const previewRows = [
    preview.totalAcertoAdicional > 0
      ? ['Valor adicional (adiantamento)', `+ ${formatCurrency(preview.totalAcertoAdicional)}`, 'positivo']
      : null,
  ].filter(Boolean);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Fechar pagamento de ${funcionario.nome}?`}
      size="lg"
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'A processar...' : 'Confirmar pagamento'}
          </Button>
        </FormActions>
      }
    >
      <div className={styles.tipoGroup}>
        {[
          TIPO_PAGAMENTO.SEMANAL,
          TIPO_PAGAMENTO.QUINZENAL,
          TIPO_PAGAMENTO.MENSAL,
          TIPO_PAGAMENTO.OUTRO,
        ].map((tipo) => (
          <label key={tipo} className={styles.tipoOption}>
            <input
              type="radio"
              name="tipoPagamento"
              value={tipo}
              checked={tipoPagamento === tipo}
              onChange={() => setTipoPagamento(tipo)}
            />
            {tipo}
          </label>
        ))}
      </div>

      <FormRow>
        <FormGroup label="Data do pagamento">
          <Input
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
          />
        </FormGroup>
        <div />
      </FormRow>

      {tipoPagamento === TIPO_PAGAMENTO.SEMANAL && (
        <>
          <p className={styles.sectionLabel}>Semana do pagamento</p>
          <div className={styles.semanaGroup}>
            {SEMANAS_MES.map((semana) => (
              <label key={semana} className={styles.semanaOption}>
                <input
                  type="radio"
                  name="semanaMes"
                  value={semana}
                  checked={semanaMes === semana}
                  onChange={() => setSemanaMes(semana)}
                />
                {getSemanaLabel(semana)}
              </label>
            ))}
          </div>
        </>
      )}

      {(tipoPagamento === TIPO_PAGAMENTO.MENSAL ||
        tipoPagamento === TIPO_PAGAMENTO.QUINZENAL ||
        tipoPagamento === TIPO_PAGAMENTO.OUTRO) && (
        <FormGroup label="Referência (opcional)">
          <Input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder={
              tipoPagamento === TIPO_PAGAMENTO.MENSAL
                ? 'Ex.: Pagamento mensal — Agosto/2026'
                : tipoPagamento === TIPO_PAGAMENTO.QUINZENAL
                  ? 'Ex.: Pagamento quinzenal — 1.ª quinzena'
                  : 'Ex.: Pagamento especial'
            }
          />
        </FormGroup>
      )}

      <p className={styles.sectionLabel}>Descontos deste pagamento</p>
      <p className={styles.infoText} style={{ marginTop: 0 }}>
        A parcela cadastrada é só uma sugestão. Pode mudar o valor ou não descontar nada.
        O saldo só muda quando confirmar o pagamento.
      </p>
      {(preview.descontosDisponiveis || []).length === 0 ? (
        <p className={styles.infoText}>Nenhum desconto ativo neste funcionário.</p>
      ) : (
        <div className={styles.checkboxGroup}>
          {(preview.descontosDisponiveis || []).map((item) => {
            const marcado = descontoMarcado(item);
            return (
              <div key={item.commitmentId} className={styles.descontoOpcao}>
                <label className={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => toggleDesconto(item)}
                  />
                  <span>
                    <strong>{item.descricao}</strong>
                    <span className={styles.descontoMeta}>
                      Saldo: {formatCurrency(item.saldo)} · Sugerido: {formatCurrency(item.sugerido)}
                    </span>
                  </span>
                </label>
                {marcado ? (
                  <FormGroup label="Valor">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={descontoValores[item.commitmentId] ?? String(item.sugerido ?? '')}
                      onChange={(e) =>
                        setDescontoValores((prev) => ({
                          ...prev,
                          [item.commitmentId]: e.target.value,
                        }))
                      }
                    />
                  </FormGroup>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {preview.acertosPendentes.length > 0 ? (
        <div className={styles.checkboxGroup}>
          {preview.acertosPendentes.map((acerto) => {
            const devolver = getValorADevolver(acerto);
            return (
              <label key={acerto.id} className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={acertoIds.includes(acerto.id)}
                  onChange={() => toggleAcerto(acerto.id)}
                />
                <span>
                  Adiantamento: {acerto.motivo}
                  {devolver > 0 ? ` − ${formatCurrency(devolver)}` : ''}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}

      <p className={styles.sectionLabel}>
        Diárias ainda não pagas
        <HelpTip text={HELP.diaria.fecharPagamento} />
      </p>
      <p className={styles.infoText} style={{ marginTop: 0 }}>
        Seleccione exactamente as diárias deste pagamento. As que ficar de fora continuam
        pendentes. As observações, extras e horas a mais/menos continuam visíveis para decidir
        os ajustes manualmente.
      </p>
      <DiariasPagamentoSelector
        diarias={preview.diariasPendentes}
        selectedIds={diariaIds}
        onChange={setDiariaIds}
      />

      <p className={styles.sectionLabel}>
        Acréscimo / horas extras
        <HelpTip text={HELP.diaria.extrasAjustes} />
      </p>
      <div className={styles.tipoGroup}>
        <label className={styles.tipoOption}>
          <input
            type="radio"
            name="acrescimoAtivo"
            checked={!acrescimoAtivo}
            onChange={() => setAcrescimoAtivo(false)}
          />
          Não
        </label>
        <label className={styles.tipoOption}>
          <input
            type="radio"
            name="acrescimoAtivo"
            checked={acrescimoAtivo}
            onChange={() => setAcrescimoAtivo(true)}
          />
          Sim
        </label>
      </div>

      {acrescimoAtivo && (
        <>
          <FormGroup label="Valor a acrescentar (€)" required>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={acrescimoValor}
              onChange={(e) => setAcrescimoValor(e.target.value)}
              placeholder="Ex.: 20"
            />
          </FormGroup>
          <FormGroup label="Motivo / observação (opcional)">
            <Textarea
              value={acrescimoObservacao}
              onChange={(e) => setAcrescimoObservacao(e.target.value)}
              placeholder='Ex.: "1 hora extra durante a semana"'
              rows={2}
            />
          </FormGroup>
        </>
      )}

      <p className={styles.sectionLabel}>
        Desconto / horas a menos
        <HelpTip text={HELP.diaria.extrasAjustes} />
      </p>
      <div className={styles.tipoGroup}>
        <label className={styles.tipoOption}>
          <input
            type="radio"
            name="descontoManualAtivo"
            checked={!descontoManualAtivo}
            onChange={() => setDescontoManualAtivo(false)}
          />
          Não
        </label>
        <label className={styles.tipoOption}>
          <input
            type="radio"
            name="descontoManualAtivo"
            checked={descontoManualAtivo}
            onChange={() => setDescontoManualAtivo(true)}
          />
          Sim
        </label>
      </div>

      {descontoManualAtivo && (
        <>
          <FormGroup label="Valor a descontar (€)" required>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={descontoManualValor}
              onChange={(e) => setDescontoManualValor(e.target.value)}
              placeholder="Ex.: 20"
            />
          </FormGroup>
          <FormGroup label="Motivo / observação (opcional)">
            <Textarea
              value={descontoManualObservacao}
              onChange={(e) => setDescontoManualObservacao(e.target.value)}
              placeholder='Ex.: "Trabalhou 2 horas a menos"'
              rows={2}
            />
          </FormGroup>
        </>
      )}

      <p className={styles.sectionLabel}>
        Gratificação / bónus
        <HelpTip text={HELP.diaria.gratificacao} />
      </p>
      <div className={styles.tipoGroup}>
        <label className={styles.tipoOption}>
          <input
            type="radio"
            name="gratificacaoAtiva"
            checked={!gratificacaoAtiva}
            onChange={() => setGratificacaoAtiva(false)}
          />
          Não
        </label>
        <label className={styles.tipoOption}>
          <input
            type="radio"
            name="gratificacaoAtiva"
            checked={gratificacaoAtiva}
            onChange={() => setGratificacaoAtiva(true)}
          />
          Sim
        </label>
      </div>
      {gratificacaoAtiva && (
        <>
          <FormGroup label="Valor da gratificação (€)" required>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={gratificacaoValor}
              onChange={(e) => setGratificacaoValor(e.target.value)}
              placeholder="Ex.: 30"
            />
          </FormGroup>
          <FormGroup label="Motivo (opcional)">
            <Input
              value={gratificacaoObservacao}
              onChange={(e) => setGratificacaoObservacao(e.target.value)}
              placeholder="Gratificação"
            />
          </FormGroup>
        </>
      )}

      <p className={styles.sectionLabel}>Outros ajustes</p>
      {extras.map((extra, index) => (
        <div key={extra.id || index} className={styles.previewRow} style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.5rem' }}>
          <FormGroup label="Descrição">
            <Input
              value={extra.descricao}
              onChange={(e) =>
                setExtras((prev) =>
                  prev.map((item, i) => (i === index ? { ...item, descricao: e.target.value } : item))
                )
              }
              placeholder="Ex.: Ajuda adicional"
            />
          </FormGroup>
          <FormGroup label="Tipo">
            <Select
              value={extra.tipo}
              onChange={(e) =>
                setExtras((prev) =>
                  prev.map((item, i) => (i === index ? { ...item, tipo: e.target.value } : item))
                )
              }
            >
              <option value="acrescimo">Acréscimo</option>
              <option value="desconto">Desconto</option>
            </Select>
          </FormGroup>
          <FormGroup label="Valor (€)">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={extra.valor}
              onChange={(e) =>
                setExtras((prev) =>
                  prev.map((item, i) => (i === index ? { ...item, valor: e.target.value } : item))
                )
              }
            />
          </FormGroup>
          {extra.tipo === 'desconto' ? (
            <FormGroup label="Data (opcional)" hint="Se for adiantamento">
              <Input
                type="date"
                value={extra.data || ''}
                onChange={(e) =>
                  setExtras((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, data: e.target.value } : item))
                  )
                }
              />
            </FormGroup>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setExtras((prev) => prev.filter((_, i) => i !== index))}
          >
            Remover
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() =>
          setExtras((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, tipo: 'acrescimo', descricao: '', valor: '', data: '' }])
        }
      >
        Adicionar ajuste
      </Button>

      <p className={styles.infoText}>
        As observações das diárias são apenas informativas. Os valores financeiros são
        definidos por si neste momento.
      </p>

      <p className={styles.sectionLabel}>Resumo antes de confirmar</p>
      <div className={confirmStyles.details}>
        <div className={styles.previewList}>
          <div className={styles.previewRow}>
            <span>Valor das diárias</span>
            <span>{formatCurrency(preview.totalDiarias)}</span>
          </div>
          <div className={styles.previewRow}>
            <span>Bónus / gratificação</span>
            <span className={styles.positivo}>+ {formatCurrency(preview.totalGratificacao || 0)}</span>
          </div>
          <div className={styles.previewRow}>
            <span>Ajustes</span>
            <span>
              {(preview.totalAcrescimoBase || 0) - (preview.totalDescontoManualBase || 0) >= 0 ? '+ ' : '− '}
              {formatCurrency(
                Math.abs((preview.totalAcrescimoBase || 0) - (preview.totalDescontoManualBase || 0))
              )}
            </span>
          </div>
          <div className={styles.previewRow}>
            <span>Descontos</span>
            <span className={styles.negativo}>− {formatCurrency(preview.totalDescontos || 0)}</span>
          </div>
          {[...preview.parcelasSelecionadas, ...preview.recorrentesSelecionados].map((item) => (
            <div key={item.commitmentId} className={styles.previewRow}>
              <span>{item.descricao}</span>
              <span className={styles.negativo}>− {formatCurrency(item.valor)}</span>
            </div>
          ))}
          {(preview.acertosDetalhe || [])
            .filter((item) => item.utilizado > 0)
            .map((item) => (
              <div key={item.valorAcertoId} className={styles.previewRow}>
                <span>{item.motivo}</span>
                <span className={styles.negativo}>− {formatCurrency(item.utilizado)}</span>
              </div>
            ))}
          {previewRows.map(([label, value, tone], index) => (
            <div key={`${label}-${index}`} className={styles.previewRow}>
              <span>{label}</span>
              <span
                className={
                  tone === 'negativo'
                    ? styles.negativo
                    : tone === 'positivo'
                      ? styles.positivo
                      : ''
                }
              >
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.previewTotal}>
          <span>A PAGAR</span>
          <span>{formatCurrency(preview.totalPago)}</span>
        </div>
      </div>

      <FormGroup label="Observação">
        <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </FormGroup>

      <p className={styles.infoText}>
        Só ao confirmar o pagamento é que o desconto entra no histórico e reduz o saldo.
        Se ainda houver saldo, volta a aparecer no próximo fecho.
      </p>

      {error && (
        <p className={styles.infoText} style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
