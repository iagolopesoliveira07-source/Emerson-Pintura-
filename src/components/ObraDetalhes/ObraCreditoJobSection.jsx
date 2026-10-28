import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import ProgressBar from '../ProgressBar/ProgressBar';
import Modal from '../Modal/Modal';
import { FormGroup, Input, FormActions } from '../Form/Form';
import ObraFinanceiroLedger from './ObraFinanceiroLedger';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { calcCreditJobSummary, createParcelaCredito, createCreditJobConfig } from '../../utils/obraCreditJob';
import { saldoObraComExtras } from '../../utils/obraExtras';
import { buildObraFinanceiroLedger } from '../../utils/obraCustos';
import styles from './ObraTipo.module.css';

const STATUS_LABEL = { pendente: 'Pendente', parcial: 'Parcial', pago: 'Pago' };

export default function ObraCreditoJobSection({ obra }) {
  const { gastos, gastosEmpresa = [], diarias, pagamentos, funcionarios, updateObra } = useApp();
  const [parcelaOpen, setParcelaOpen] = useState(false);
  const [parcelaForm, setParcelaForm] = useState({ valor: '', dataPrevista: '', observacao: '' });

  const summary = useMemo(() => {
    try {
      return calcCreditJobSummary(obra, { gastos, diarias, pagamentos, gastosEmpresa });
    } catch (err) {
      console.error('[obra crédito] Falha ao calcular o resumo', err);
      return null;
    }
  }, [obra, gastos, diarias, pagamentos, gastosEmpresa]);
  const movimentos = useMemo(
    () =>
      buildObraFinanceiroLedger(obra, {
        gastos,
        diarias,
        gastosEmpresa,
        pagamentos,
        funcionarios,
      }),
    [obra, gastos, diarias, gastosEmpresa, pagamentos, funcionarios]
  );

  if (!summary) return null;

  const saldoExtras = saldoObraComExtras(obra, summary.totalRecebido || 0);
  const temExtras = saldoExtras.extras.total > 0.004;
  const valorObra = temExtras ? saldoExtras.valorAtualizado : summary.valorAcordado;
  const faltaReceber = temExtras ? saldoExtras.valorRestante : summary.aindaAReceber;

  const handleParcela = (e) => {
    e.preventDefault();
    const atuais = Array.isArray(obra.creditJob?.parcelas) ? obra.creditJob.parcelas : [];
    const parcela = createParcelaCredito({
      numero: atuais.length + 1,
      valor: parcelaForm.valor,
      dataPrevista: parcelaForm.dataPrevista || null,
      observacao: parcelaForm.observacao,
    });
    updateObra({
      ...obra,
      creditJob: createCreditJobConfig({ enabled: true, parcelas: [...atuais, parcela] }),
      updatedAt: new Date().toISOString(),
    });
    setParcelaOpen(false);
    setParcelaForm({ valor: '', dataPrevista: '', observacao: '' });
  };

  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>Resumo financeiro</h3>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>{temExtras ? 'Valor atualizado' : 'Valor acordado / previsto'}</span>
          <strong>{valorObra != null && (temExtras || summary.temValorAcordado) ? formatCurrency(valorObra) : 'Não informado'}</strong>
        </div>
        <div className={styles.stat}>
          <span>Valor recebido</span>
          <strong>{formatCurrency(summary.totalRecebido)}</strong>
        </div>
        <div className={styles.stat}>
          <span>{temExtras ? 'Falta receber' : 'Ainda a receber'}</span>
          <strong>
            {faltaReceber != null ? formatCurrency(faltaReceber) : 'Não informado'}
          </strong>
        </div>
        <div className={`${styles.stat} ${styles.statHighlight}`}>
          <span>Total investido até agora</span>
          <strong>{formatCurrency(summary.totalInvestido)}</strong>
        </div>
      </div>

      <h3 className={styles.panelTitle}>Custos da obra</h3>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>Diárias</span>
          <strong>{formatCurrency(summary.totalDiarias)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Materiais</span>
          <strong>{formatCurrency(summary.totalMateriais)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Outros gastos</span>
          <strong>{formatCurrency(summary.totalOutros)}</strong>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>Resultado de caixa atual</span>
          <strong>{formatCurrency(summary.resultadoCaixa)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Margem teórica restante</span>
          <strong>
            {summary.margemTeorica != null ? formatCurrency(summary.margemTeorica) : 'Não informada'}
          </strong>
        </div>
      </div>
      <p className={styles.hint}>
        O resultado de caixa usa o que já entrou menos o que já foi gasto. A margem teórica usa o
        valor acordado menos o custo acumulado, mesmo que ainda falte receber.
      </p>

      {summary.temValorAcordado ? (
        <div className={styles.progressWrap}>
          <div className={styles.progressLabel}>
            <span>
              Custo acumulado {formatCurrency(summary.totalInvestido)} de{' '}
              {formatCurrency(summary.valorAcordado)}
            </span>
            <span>{summary.progressoCusto}%</span>
          </div>
          <ProgressBar value={summary.progressoCusto || 0} showLabel={false} />
        </div>
      ) : null}

      <h3 className={styles.panelTitle}>Parcelas / recebimentos previstos</h3>
      {(summary.parcelas || []).length === 0 ? (
        <p className={styles.hint}>Sem parcelas previstas. Os recebimentos reais vêm dos pagamentos da obra.</p>
      ) : (
        <div className={styles.equipaList}>
          {summary.parcelas.map((parcela) => (
            <div key={parcela.id} className={styles.equipaRow}>
              <span>
                Parcela {parcela.numero}
                {parcela.dataPrevista ? ` · prevista ${formatDate(parcela.dataPrevista)}` : ''}
                {parcela.observacao ? ` · ${parcela.observacao}` : ''}
              </span>
              <span>
                {formatCurrency(parcela.valorRecebido || 0)} / {formatCurrency(parcela.valor)}{' '}
                <Badge variant={parcela.status === 'pago' ? 'success' : parcela.status === 'parcial' ? 'info' : 'warning'}>
                  {STATUS_LABEL[parcela.status]}
                </Badge>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => {
            setParcelaForm({ valor: '', dataPrevista: '', observacao: '' });
            setParcelaOpen(true);
          }}
        >
          Adicionar parcela prevista
        </Button>
      </div>

      <h3 className={styles.panelTitle} style={{ marginTop: '1.25rem' }}>
        Evolução financeira
      </h3>
      <ObraFinanceiroLedger movimentos={movimentos} />

      <Modal
        isOpen={parcelaOpen}
        onClose={() => setParcelaOpen(false)}
        title="Parcela prevista"
        footer={
          <FormActions>
            <Button variant="secondary" type="button" onClick={() => setParcelaOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="parcela-credito-form">
              Guardar parcela
            </Button>
          </FormActions>
        }
      >
        <form id="parcela-credito-form" onSubmit={handleParcela}>
          <p className={styles.hint}>Isto é só o plano. O valor recebido continua a vir dos pagamentos já registados.</p>
          <FormGroup label="Valor previsto (€)" required>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={parcelaForm.valor}
              onChange={(e) => setParcelaForm((prev) => ({ ...prev, valor: e.target.value }))}
              required
            />
          </FormGroup>
          <FormGroup label="Data prevista">
            <Input
              type="date"
              value={parcelaForm.dataPrevista}
              onChange={(e) => setParcelaForm((prev) => ({ ...prev, dataPrevista: e.target.value }))}
            />
          </FormGroup>
          <FormGroup label="Observação">
            <Input
              value={parcelaForm.observacao}
              onChange={(e) => setParcelaForm((prev) => ({ ...prev, observacao: e.target.value }))}
              placeholder="Ex.: 1.ª parcela"
            />
          </FormGroup>
        </form>
      </Modal>
    </section>
  );
}
