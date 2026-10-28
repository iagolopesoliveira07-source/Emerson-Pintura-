import { useMemo, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import { FormActions } from '../Form/Form';
import { formatCurrency, formatDateOrNotInformed } from '../../utils/formatters';
import { getGastoValorAssinado } from '../../utils/gastoDocumentoTipo';
import { getGastoEmpresaValor } from '../../utils/gastoEmpresaCalculations';
import { getGastoEmpresaFornecedorLabel } from '../../utils/gastoEmpresaSeguranca';
import { HELP } from '../../utils/helpTexts';
import { HelpLabel } from '../HelpTip/HelpTip';
import {
  CONTROLE_CUSTOS,
  getIntervencaoNome,
  getIntervencaoRecords,
  getIntervencaoStatusLabel,
  isIntervencaoAbatida,
} from '../../utils/obraPrepaidCredit';
import styles from './ObraCredito.module.css';

function formatDatas(datas = []) {
  const list = Array.isArray(datas) ? datas.filter(Boolean) : [];
  if (!list.length) return '—';
  if (list.length <= 4) return list.map((item) => formatDateOrNotInformed(item)).join(', ');
  return `${list.slice(0, 3).map((item) => formatDateOrNotInformed(item)).join(', ')}… (${list.length})`;
}

function resultadoClass(row, stylesMap) {
  if (!row) return '';
  if (row.resultadoExibicaoTipo === 'lucro' || (row.resultadoExibicaoValor != null && row.resultadoExibicaoValor >= 0)) {
    return stylesMap.valorPositivo;
  }
  if (row.resultadoExibicaoTipo === 'prejuizo' || (row.resultadoExibicaoValor != null && row.resultadoExibicaoValor < 0)) {
    return stylesMap.valorNegativo;
  }
  return '';
}

export default function IntervencaoDetalheModal({
  isOpen,
  onClose,
  servico,
  obra,
  diarias = [],
  gastos = [],
  gastosEmpresa = [],
  getFuncionarioNome,
  historico = false,
  onEdit,
  onDelete,
  onAddDiarias,
  onAddGastos,
  onMarcarCustosCompletos,
}) {
  const [tab, setTab] = useState('relatorio');
  const records = useMemo(
    () => (servico ? getIntervencaoRecords(servico.id, { diarias, gastos, gastosEmpresa }) : { diarias: [], gastos: [], gastosEmpresa: [] }),
    [servico, diarias, gastos, gastosEmpresa]
  );

  if (!servico) return null;

  const abatido = isIntervencaoAbatida(servico);
  const funcionarios = (servico.funcionariosDetalhe || []).filter(Boolean).map((row) => ({
    ...row,
    nome: getFuncionarioNome?.(row.funcionarioId) || 'Sem funcionário',
  }));

  const gastosRows = [
    ...records.gastos.filter(Boolean).map((item) => ({
      id: item.id,
      data: item.data,
      fornecedor: item.fornecedorNome || item.fornecedor || '—',
      categoria: item.categoria || item.descricao || '—',
      valor: getGastoValorAssinado(item),
    })),
    ...records.gastosEmpresa.filter(Boolean).map((item) => ({
      id: item.id,
      data: item.data,
      fornecedor: getGastoEmpresaFornecedorLabel(item) || item.fornecedorNome || '—',
      categoria: item.categoria || item.descricao || '—',
      valor: getGastoEmpresaValor(item),
    })),
  ].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getIntervencaoNome(servico)}
      size="xl"
      footer={
        <FormActions>
          {!historico ? (
            <>
              <Button variant="secondary" type="button" onClick={onAddDiarias}>
                Adicionar diárias
              </Button>
              <Button variant="secondary" type="button" onClick={onAddGastos}>
                Adicionar gastos
              </Button>
              <Button variant="secondary" type="button" onClick={onEdit}>
                Editar
              </Button>
            </>
          ) : null}
          <Button variant="danger" type="button" onClick={onDelete}>
            Excluir serviço
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            Fechar
          </Button>
        </FormActions>
      }
    >
      <div className={styles.detailBadges}>
        <Badge variant={abatido ? 'success' : servico.statusCanonico === 'em_andamento' ? 'primary' : 'purple'}>
          {getIntervencaoStatusLabel(servico)}
        </Badge>
        {abatido ? <Badge variant="success">Abatido no crédito</Badge> : <Badge variant="default">Ainda não abatido</Badge>}
      </div>

      <div className={styles.servicoGrid}>
        <div>
          <span>Período</span>
          <b>{typeof servico.periodoLabel === 'string' && servico.periodoLabel ? servico.periodoLabel : 'Ainda sem lançamentos'}</b>
        </div>
        <div>
          <span>Valor do serviço</span>
          <b>{servico.valorDefinido ? formatCurrency(servico.valorDefinido) : 'Ainda sem valor'}</b>
        </div>
        <div>
          <span>
            <HelpLabel text={HELP.obra.abatidoCredito}>Abatimento</HelpLabel>
          </span>
          <b>{abatido ? formatCurrency(servico.valorAbatido) : 'Não'}</b>
        </div>
        {abatido ? (
          <>
            <div>
              <span>Saldo da obra antes</span>
              <b>{formatCurrency(servico.creditoAntesAbatimento ?? servico.creditoRestanteAntes)}</b>
            </div>
            <div>
              <span>Saldo da obra depois</span>
              <b>{formatCurrency(servico.creditoDepoisAbatimento ?? servico.creditoRestante)}</b>
            </div>
          </>
        ) : null}
        <div>
          <span>N.º de diárias</span>
          <b>{servico.quantidadeDiarias || 0}</b>
        </div>
        <div>
          <span>Custo das diárias</span>
          <b>{formatCurrency(servico.totalDiarias || 0)}</b>
        </div>
        <div>
          <span>Gastos</span>
          <b>{formatCurrency(servico.totalGastos || 0)}</b>
        </div>
        <div>
          <span>Custo total real</span>
          <b>{formatCurrency(servico.custoTotal || 0)}</b>
        </div>
        <div>
          <span>
            <HelpLabel text={HELP.obra.resultadoServico}>Resultado do serviço</HelpLabel>
          </span>
          <b className={resultadoClass(servico, styles)}>
            {servico.resultadoExibicaoTipo === 'historico'
              ? servico.resultadoExibicaoLabel
              : servico.resultadoExibicaoValor == null
                ? 'Defina o valor do serviço para ver a margem'
                : formatCurrency(servico.resultadoExibicaoValor)}
          </b>
        </div>
      </div>

      {servico.observacoes ? <p className={styles.hint}>{servico.observacoes}</p> : null}

      {historico ? (
        <p className={styles.hint}>Serviço histórico da planilha. Os custos detalhados não estão registados.</p>
      ) : null}

      {!historico && servico.controleCustos !== CONTROLE_CUSTOS.COMPLETO && servico.hasCostRecords ? (
        <Button variant="secondary" size="sm" type="button" onClick={onMarcarCustosCompletos}>
          Marcar custos como completos
        </Button>
      ) : null}

      <div className={styles.tabRow} role="tablist">
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'relatorio' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('relatorio')}
        >
          Relatório
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'diarias' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('diarias')}
        >
          Funcionários
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'gastos' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('gastos')}
        >
          Gastos
        </button>
      </div>

      {tab === 'relatorio' ? (
        <p className={styles.hint}>
          O período usa automaticamente as datas das diárias e gastos associados. Diárias e gastos
          continuam na obra principal.
        </p>
      ) : null}

      {tab === 'diarias' ? (
        funcionarios.length === 0 ? (
          <p className={styles.hint}>Ainda não há diárias neste serviço.</p>
        ) : (
          <div className={styles.reportTableWrap}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>N.º de diárias</th>
                  <th>Datas</th>
                  <th>Custo</th>
                </tr>
              </thead>
              <tbody>
                {funcionarios.map((row) => (
                  <tr key={row.funcionarioId || 'sem'}>
                    <td>{row.nome}</td>
                    <td>{row.quantidade}</td>
                    <td>{formatDatas(row.datas)}</td>
                    <td>{formatCurrency(row.custo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'gastos' ? (
        gastosRows.length === 0 ? (
          <p className={styles.hint}>Ainda não há gastos neste serviço.</p>
        ) : (
          <div className={styles.reportTableWrap}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Fornecedor</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {gastosRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateOrNotInformed(row.data)}</td>
                    <td>{row.fornecedor}</td>
                    <td>{row.categoria}</td>
                    <td>{formatCurrency(row.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </Modal>
  );
}
