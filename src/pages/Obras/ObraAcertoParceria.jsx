import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileDown, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../../components/Button/Button';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import { FormGroup, Input } from '../../components/Form/Form';
import { formatCurrency, formatDate, getTodayISO } from '../../utils/formatters';
import {
  getTipoObra,
  isPartnershipObra,
  TIPO_OBRA,
} from '../../utils/obraSpecial';
import {
  agruparCustosPendentesAcerto,
  apagarAcertoParceria,
  calcularAcertoParceriaSelecao,
  calculoFromAcertoFechado,
  confirmarAcertoParceria,
  excluirRascunhoAcertoParceria,
  getAcertoParceriaById,
  getAcertosParceria,
  ligarRecebimentoAoAcerto,
  montarRecebimentoDoAcerto,
  getProximoNumeroAcertoParceria,
  getRascunhoAcertoParceria,
  getReservaDisponivelParceria,
  listarPendentesAcertoParceria,
  parseMontanteAcerto,
  salvarRascunhoAcertoParceria,
  tituloAcertoParceria,
} from '../../utils/obraParceriaAcertos';
import { gerarRelatorioAcertoParceriaPdf } from '../../utils/gerarRelatorioAcertoParceriaPdf';
import shared from '../shared.module.css';
import styles from './ObraAcertoParceria.module.css';

function toggleId(set, id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function valorCustoLinhaDiaria(item) {
  if (!item) return 0;
  if (item.incluidoNosGastos) return 0;
  if (item.papel === 'funcionario') return Number(item.valorCusto) || 0;
  return Number(item.valorReembolso ?? item.valorCusto) || 0;
}

function aplicarIds(setter, ids, marcar) {
  setter((prev) => {
    const next = new Set(prev);
    ids.forEach((id) => {
      if (marcar) next.add(id);
      else next.delete(id);
    });
    return next;
  });
}

function CategoriaCustos({ titulo, items, selected, onToggle, onMarcar, onLimpar, descricaoDe, valorDe }) {
  if (!items.length) return null;
  return (
    <div className={styles.block}>
      <div className={styles.catHead}>
        <p className={styles.blockLabel}>{titulo}</p>
        <button type="button" className={styles.linkBtn} onClick={onMarcar}>
          Selecionar
        </button>
        <button type="button" className={styles.linkBtn} onClick={onLimpar}>
          Limpar
        </button>
      </div>
      {items.map((item) => (
        <label key={item.id} className={styles.costRow}>
          <input type="checkbox" checked={selected.has(item.id)} onChange={() => onToggle(item.id)} />
          <span>{item.data ? formatDate(item.data) : '—'}</span>
          <span title={descricaoDe(item)}>{descricaoDe(item)}</span>
          <strong>{formatCurrency(valorDe(item))}</strong>
        </label>
      ))}
    </div>
  );
}

function valorBloco(bloco, campo) {
  return Number(bloco?.[campo]) || 0;
}

function LinhasEscolhaCustos({ custosDisponiveis, custosSelecionados }) {
  if (custosDisponiveis == null) return null;
  const continuam = Math.max(0, Math.round((custosDisponiveis - custosSelecionados) * 100) / 100);
  return (
    <>
      <div>
        <span>Custos disponíveis</span>
        <strong>{formatCurrency(custosDisponiveis)}</strong>
      </div>
      <div>
        <span>Custos selecionados</span>
        <strong>{formatCurrency(custosSelecionados)}</strong>
      </div>
      <div>
        <span>Continuarão pendentes</span>
        <strong>{formatCurrency(continuam)}</strong>
      </div>
    </>
  );
}

function LinhasReserva({ fechamento }) {
  const f = fechamento || {};
  if (f.custosPagosPelaReserva == null) return null;
  return (
    <>
      <div>
        <span>Valor dos custos pago pela reserva</span>
        <strong>{formatCurrency(f.custosPagosPelaReserva || 0)}</strong>
      </div>
      <div>
        <span>Valor dos custos coberto pelo dinheiro novo</span>
        <strong>{formatCurrency(f.custosCobertosPeloDinheiroNovo || 0)}</strong>
      </div>
      <div>
        <span>Nova reserva deixada</span>
        <strong>{formatCurrency(f.novaReservaDeixada || 0)}</strong>
      </div>
      <div>
        <span>Reserva restante</span>
        <strong>{formatCurrency(f.reservaRestante || 0)}</strong>
      </div>
    </>
  );
}

function ResumoFechamento({ fechamento, calculo, custosDisponiveis = null }) {
  const f = fechamento || {};
  const gastos =
    valorBloco(calculo?.emerson, 'gastosValor') +
    valorBloco(calculo?.fabio, 'gastosValor') +
    valorBloco(calculo?.juliano, 'gastosValor') +
    valorBloco(calculo?.caixa, 'gastosValor');
  const diariasSocios =
    valorBloco(calculo?.emerson, 'diariasPropriasValor') +
    valorBloco(calculo?.fabio, 'diariasPropriasValor') +
    valorBloco(calculo?.juliano, 'diariasPropriasValor');
  const maoDeObra = valorBloco(calculo?.emerson, 'funcionariosValor');
  const semLucro = f.semDistribuicao === true;
  const linhasPessoa = [
    ['Gastos Emerson', valorBloco(calculo?.emerson, 'gastosValor')],
    ['Diárias Emerson', valorBloco(calculo?.emerson, 'diariasPropriasValor')],
    ['Mão de obra dos funcionários', maoDeObra],
    ['Gastos Fábio', valorBloco(calculo?.fabio, 'gastosValor')],
    ['Diárias Fábio', valorBloco(calculo?.fabio, 'diariasPropriasValor')],
    ['Gastos Juliano', valorBloco(calculo?.juliano, 'gastosValor')],
    ['Diárias Juliano', valorBloco(calculo?.juliano, 'diariasPropriasValor')],
    ['Gastos do caixa', valorBloco(calculo?.caixa, 'gastosValor')],
  ].filter(([, valor]) => Math.abs(valor) > 0.004);

  if (semLucro) {
    return (
      <div className={styles.resultList}>
        <div>
          <span>Novo pagamento</span>
          <strong>{formatCurrency(f.pagamento || 0)}</strong>
        </div>
        <div>
          <span>Reserva utilizada</span>
          <strong>{formatCurrency(f.reservaUtilizada || 0)}</strong>
        </div>
        <LinhasEscolhaCustos custosDisponiveis={custosDisponiveis} custosSelecionados={f.custos || 0} />
        {linhasPessoa.map(([nome, valor]) => (
          <div key={nome}>
            <span>{nome}</span>
            <strong>{formatCurrency(valor)}</strong>
          </div>
        ))}
        <div>
          <span>Gastos acertados</span>
          <strong>{formatCurrency(gastos)}</strong>
        </div>
        <div>
          <span>Diárias dos sócios acertadas</span>
          <strong>{formatCurrency(diariasSocios)}</strong>
        </div>
        <div>
          <span>Mão de obra dos funcionários acertada</span>
          <strong>{formatCurrency(maoDeObra)}</strong>
        </div>
        <div className={styles.resultTotal}>
          <span>Total acertado</span>
          <strong>{formatCurrency(f.custos || 0)}</strong>
        </div>
        <LinhasReserva fechamento={f} />
        <div>
          <span>Reserva final</span>
          <strong>{formatCurrency(f.reservaFinal || 0)}</strong>
        </div>
        <div className={styles.resultTotal}>
          <span>Distribuição de lucro</span>
          <strong>Não realizada</strong>
        </div>
        <p className={styles.info}>Sem distribuição de lucro neste Acerto.</p>
        {(f.saldoRemanescente || 0) > 0.004 ? (
          <div>
            <span>Saldo remanescente (não distribuído)</span>
            <strong>{formatCurrency(f.saldoRemanescente || 0)}</strong>
          </div>
        ) : null}
      </div>
    );
  }

  if (custosDisponiveis != null) {
    return (
      <div className={styles.resultList}>
        <div>
          <span>Novo pagamento</span>
          <strong>{formatCurrency(f.pagamento || 0)}</strong>
        </div>
        <div>
          <span>Reserva utilizada</span>
          <strong>{formatCurrency(f.reservaUtilizada || 0)}</strong>
        </div>
        <LinhasEscolhaCustos custosDisponiveis={custosDisponiveis} custosSelecionados={f.custos || 0} />
        <LinhasReserva fechamento={f} />
        <div>
          <span>Reserva final</span>
          <strong>{formatCurrency(f.reservaFinal || 0)}</strong>
        </div>
        <div className={styles.resultTotal}>
          <span>Valor para divisão</span>
          <strong>{formatCurrency(f.lucroDistribuido ?? f.valorDivisao ?? 0)}</strong>
        </div>
        {f.semLucroDisponivel ? (
          <p className={styles.info}>Não há lucro positivo para distribuir. Os custos não são repartidos em percentagens.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.resultList}>
      <p className={styles.blockLabel}>Entradas</p>
      <div>
        <span>Novo pagamento</span>
        <strong>{formatCurrency(f.pagamento || 0)}</strong>
      </div>
      <div>
        <span>Reserva anterior utilizada</span>
        <strong>{formatCurrency(f.reservaUtilizada || 0)}</strong>
      </div>
      <div className={styles.resultTotal}>
        <span>Total considerado</span>
        <strong>{formatCurrency(f.totalConsiderado || 0)}</strong>
      </div>
      <p className={styles.blockLabel}>Custos selecionados</p>
      <div>
        <span>Gastos acertados</span>
        <strong>{formatCurrency(gastos)}</strong>
      </div>
      <div>
        <span>Diárias dos sócios</span>
        <strong>{formatCurrency(diariasSocios)}</strong>
      </div>
      <div>
        <span>Mão de obra dos funcionários</span>
        <strong>{formatCurrency(maoDeObra)}</strong>
      </div>
      <div>
        <span>Total de custos</span>
        <strong>{formatCurrency(f.custos || 0)}</strong>
      </div>
      <LinhasReserva fechamento={f} />
      <p className={styles.blockLabel}>Reserva final</p>
      <div>
        <span>{f.custosPagosPelaReserva != null ? 'Reserva final' : 'Valor deixado como reserva'}</span>
        <strong>{formatCurrency(f.reservaFinal || 0)}</strong>
      </div>
      <div className={styles.resultTotal}>
        <span>Distribuição de lucro</span>
        <strong>{formatCurrency(f.lucroDistribuido ?? f.valorDivisao ?? 0)}</strong>
      </div>
      {f.semLucroDisponivel ? (
        <p className={styles.info}>Não há lucro positivo para distribuir. Os custos não são repartidos em percentagens.</p>
      ) : null}
    </div>
  );
}

function SecaoDivisao({ fechamento, pessoas }) {
  if (fechamento?.semDistribuicao) {
    return (
      <section className={styles.card}>
        <h2>Sem distribuição de lucro neste Acerto</h2>
        <p className={styles.lead}>
          Este Acerto regista os custos, diárias e mão de obra escolhidos. As percentagens da parceria não são aplicadas.
        </p>
        <div className={styles.resultTotal}>
          <span>Distribuição de lucro</span>
          <strong>0,00 €</strong>
        </div>
      </section>
    );
  }
  if (fechamento?.semLucroDisponivel) {
    return (
      <section className={styles.card}>
        <h2>Divisão</h2>
        <p className={styles.lead}>Não há lucro positivo para distribuir. Nenhum sócio recebe percentagem neste Acerto.</p>
        <div className={styles.resultTotal}>
          <span>Distribuição de lucro</span>
          <strong>{formatCurrency(0)}</strong>
        </div>
      </section>
    );
  }
  if (fechamento?.distribuicaoConhecida === false) {
    return (
      <section className={styles.card}>
        <h2>Divisão</h2>
        <div className={styles.splitGrid}>
          {(pessoas || []).map((pessoa) => (
            <article key={pessoa.key}>
              <h3>
                {pessoa.nome}
                {pessoa.percentagem != null ? ` — ${pessoa.percentagem}%` : ''}
              </h3>
              <strong>{formatCurrency(pessoa.lucro || 0)}</strong>
            </article>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className={styles.card}>
      <h2>Divisão</h2>
      <p className={styles.lead}>Percentagens configuradas nesta obra, aplicadas só ao lucro deste Acerto.</p>
      <div className={styles.splitGrid}>
        {(pessoas || []).map((pessoa) => (
          <article key={pessoa.key}>
            <h3>
              {pessoa.nome} — {pessoa.percentagem}%
            </h3>
            <strong>{formatCurrency(pessoa.lucro || 0)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResultadoAcerto({ pessoas }) {
  return (
    <section className={styles.card}>
      <h2>Resultado do Acerto</h2>
      <div className={styles.splitGrid}>
        {(pessoas || []).map((pessoa) => {
          const reembolso = Number(pessoa.reembolso) || 0;
          const divisao = Number(pessoa.lucro) || 0;
          const total =
            pessoa.totalDestinado != null ? Number(pessoa.totalDestinado) : reembolso + divisao;
          return (
            <article key={pessoa.key}>
              <h3>{pessoa.nome}</h3>
              <p>
                Reembolso <strong>{formatCurrency(reembolso)}</strong>
              </p>
              <p>
                Divisão <strong>{formatCurrency(divisao)}</strong>
              </p>
              <p>
                Total recebido no Acerto <strong>{formatCurrency(total)}</strong>
              </p>
            </article>
          );
        })}
      </div>
      <div className={styles.resultTotal}>
        <span>Status</span>
        <strong>Concluído</strong>
      </div>
    </section>
  );
}

export default function ObraAcertoParceria() {
  const { id, acertoId } = useParams();
  const navigate = useNavigate();
  const {
    getObraById,
    updateObra,
    addPagamento,
    gastos,
    gastosEmpresa = [],
    diarias,
    pagamentos,
    funcionarios,
    configuracoes,
  } = useApp();
  const confirmando = useRef(false);
  const obra = getObraById(id);
  const acertoFechado = obra ? getAcertoParceriaById(obra, acertoId) : null;
  const leitura = Boolean(acertoId);

  const pendentes = useMemo(() => {
    if (!obra || leitura) return { diarias: [], gastos: [], recebimentos: [], repasses: [] };
    return listarPendentesAcertoParceria(obra, { gastos, gastosEmpresa, diarias, pagamentos, funcionarios });
  }, [obra, gastos, gastosEmpresa, diarias, pagamentos, funcionarios, leitura]);

  const gruposCustos = useMemo(() => agruparCustosPendentesAcerto(pendentes), [pendentes]);
  const custosDisponiveis = useMemo(() => {
    const gastosValor = (pendentes.gastos || []).reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
    const diariasValor = (pendentes.diarias || []).reduce((sum, item) => sum + valorCustoLinhaDiaria(item), 0);
    return Math.round((gastosValor + diariasValor) * 100) / 100;
  }, [pendentes]);
  const reservaAnterior = obra && !leitura ? getReservaDisponivelParceria(obra) : 0;

  const [diariaIds, setDiariaIds] = useState(() => new Set());
  const [gastoIds, setGastoIds] = useState(() => new Set());
  const [data, setData] = useState(getTodayISO());
  const [recebidoInformado, setRecebidoInformado] = useState('');
  const [usarReserva, setUsarReserva] = useState(false);
  const [reservaUtilizada, setReservaUtilizada] = useState('');
  const [reservaFinal, setReservaFinal] = useState('');
  const [distribuirLucro, setDistribuirLucro] = useState(false);
  const [modo, setModo] = useState('custos');
  const [etapa, setEtapa] = useState('editar');
  const [aviso, setAviso] = useState('');
  const [rascunhoAtivo, setRascunhoAtivo] = useState(false);
  const [pdfEstado, setPdfEstado] = useState('idle');
  const [apagarAberto, setApagarAberto] = useState(false);
  const [acertoParaApagar, setAcertoParaApagar] = useState(null);

  useEffect(() => {
    if (!obra || leitura) return;
    const rascunho = getRascunhoAcertoParceria(obra);
    if (!rascunho) {
      setRascunhoAtivo(false);
      return;
    }
    setRecebidoInformado(String(rascunho.pagamento ?? ''));
    setUsarReserva(Boolean(rascunho.usarReserva));
    setReservaUtilizada(String(rascunho.reservaUtilizada ?? ''));
    setReservaFinal(String(rascunho.reservaFinal ?? ''));
    const modoGuardado =
      rascunho.modo === 'dividir' || rascunho.modo === 'custos-lucro' || rascunho.modo === 'custos'
        ? rascunho.modo
        : rascunho.distribuirLucro === true
          ? 'custos-lucro'
          : 'custos';
    const temSelecao = (rascunho.gastoIds || []).length > 0 || (rascunho.diariaIds || []).length > 0;
    const modoFinal = modoGuardado === 'dividir' && temSelecao ? 'custos-lucro' : modoGuardado;
    setModo(modoFinal);
    setDistribuirLucro(modoFinal !== 'custos');
    setGastoIds(new Set(rascunho.gastoIds || []));
    setDiariaIds(new Set(rascunho.diariaIds || []));
    setEtapa('editar');
    setRascunhoAtivo(true);
  }, [obra?.id, acertoId, leitura]);

  const pagamentoCampo = parseMontanteAcerto(recebidoInformado);
  const reservaUsadaCampo = parseMontanteAcerto(usarReserva ? reservaUtilizada : '');
  const reservaFinalCampo = parseMontanteAcerto(reservaFinal);
  const numerosInvalidos = !pagamentoCampo.ok || !reservaUsadaCampo.ok || !reservaFinalCampo.ok;

  const calculo = useMemo(() => {
    if (!obra) return null;
    if (leitura && acertoFechado) return calculoFromAcertoFechado(obra, acertoFechado);
    if (leitura) return null;
    return calcularAcertoParceriaSelecao(
      obra,
      pendentes,
      { diariaIds: [...diariaIds], gastoIds: [...gastoIds], recebimentoIds: [] },
      {
        recebidoInformado: pagamentoCampo.ok ? pagamentoCampo.valor : 0,
        reservaAnterior,
        usarReservaAnterior: usarReserva,
        reservaUtilizada: usarReserva && reservaUsadaCampo.ok ? reservaUsadaCampo.valor : 0,
        reservaFinal: reservaFinalCampo.ok ? reservaFinalCampo.valor : 0,
        distribuirLucro,
        numero: getProximoNumeroAcertoParceria(obra),
        titulo: tituloAcertoParceria(getProximoNumeroAcertoParceria(obra)),
      }
    );
  }, [
    obra,
    leitura,
    acertoFechado,
    pendentes,
    diariaIds,
    gastoIds,
    pagamentoCampo.ok,
    pagamentoCampo.valor,
    reservaAnterior,
    usarReserva,
    reservaUsadaCampo.ok,
    reservaUsadaCampo.valor,
    reservaFinalCampo.ok,
    reservaFinalCampo.valor,
    distribuirLucro,
  ]);

  if (!obra) {
    return (
      <div>
        <Link to="/obras" className={shared.backLink}>
          <ArrowLeft size={16} /> Voltar
        </Link>
        <p>Obra não encontrada.</p>
      </div>
    );
  }

  if (!isPartnershipObra(obra) && getTipoObra(obra) !== TIPO_OBRA.PARCERIA) {
    return (
      <div>
        <Link to={`/obras/${obra.id}`} className={shared.backLink}>
          <ArrowLeft size={16} /> Voltar à obra
        </Link>
        <p>Esta obra não é de parceria.</p>
      </div>
    );
  }

  if (leitura && !acertoFechado) {
    return (
      <div>
        <Link to={`/obras/${obra.id}`} className={shared.backLink}>
          <ArrowLeft size={16} /> Voltar à obra
        </Link>
        <p>Acerto não encontrado.</p>
      </div>
    );
  }

  if (!calculo) return null;

  const fechamento = calculo.fechamento || {};
  const custosContinuam = Math.max(0, Math.round((custosDisponiveis - (fechamento.custos || 0)) * 100) / 100);
  const avisoPendentes = !leitura && distribuirLucro && custosContinuam > 0.004;
  const titulo = leitura ? acertoFechado?.titulo || 'Acerto' : 'Novo Acerto';
  const temAlgo =
    (fechamento.pagamento || 0) > 0.004 ||
    (fechamento.reservaUtilizada || 0) > 0.004 ||
    (fechamento.custos || 0) > 0.004 ||
    (fechamento.reservaFinal || 0) > 0.004;
  const podeConfirmar = !numerosInvalidos && !fechamento.reservaExcede && temAlgo;

  const confirmar = () => {
    if (leitura || !podeConfirmar || confirmando.current) return;
    confirmando.current = true;
    const next = confirmarAcertoParceria(obra, calculo, { data });
    if (next === obra) {
      confirmando.current = false;
      return;
    }
    const novoAcerto = getAcertosParceria(next).slice(-1)[0];
    const recebimento = montarRecebimentoDoAcerto(obra, novoAcerto, pagamentos);
    const gravado = recebimento ? addPagamento(recebimento) : null;
    const obraFinal = gravado
      ? ligarRecebimentoAoAcerto(next, novoAcerto.id, gravado.id)
      : next;
    updateObra(obraFinal);
    navigate(`/obras/${obra.id}`, { state: { successMessage: 'Acerto confirmado.' } });
  };

  const confirmarApagar = () => {
    const alvo = acertoParaApagar || acertoFechado;
    if (!alvo?.id) return;
    updateObra(apagarAcertoParceria(obra, alvo.id));
    setApagarAberto(false);
    setAcertoParaApagar(null);
    navigate(`/obras/${obra.id}`, { state: { successMessage: 'Acerto apagado com sucesso.' } });
  };

  const guardarRascunho = () => {
    updateObra(
      salvarRascunhoAcertoParceria(obra, {
        pagamento: recebidoInformado,
        usarReserva,
        reservaUtilizada,
        reservaFinal,
        distribuirLucro,
        modo,
        gastoIds: [...gastoIds],
        diariaIds: [...diariaIds],
      })
    );
    setRascunhoAtivo(true);
    setAviso('Rascunho guardado. Podes sair e continuar depois.');
  };

  const excluirRascunho = () => {
    updateObra(excluirRascunhoAcertoParceria(obra));
    setRascunhoAtivo(false);
    setRecebidoInformado('');
    setUsarReserva(false);
    setReservaUtilizada('');
    setReservaFinal('');
    setDistribuirLucro(false);
    setModo('custos');
    setGastoIds(new Set());
    setDiariaIds(new Set());
    setAviso('Rascunho excluído.');
  };

  const notarSelecao = () => {
    setModo((atual) => (atual === 'dividir' ? 'custos-lucro' : atual));
  };

  const selecionarTodosCustos = () => {
    notarSelecao();
    setGastoIds(new Set((pendentes.gastos || []).map((item) => item.id)));
    setDiariaIds(new Set((pendentes.diarias || []).map((item) => item.id)));
  };

  const desmarcarTodosCustos = () => {
    setGastoIds(new Set());
    setDiariaIds(new Set());
  };

  const escolherModo = (next) => {
    setModo(next);
    if (next === 'custos') {
      setDistribuirLucro(false);
      return;
    }
    setDistribuirLucro(true);
    if (next === 'dividir') desmarcarTodosCustos();
  };

  const marcarGrupo = (grupo, marcar) => {
    if (marcar) notarSelecao();
    aplicarIds(setGastoIds, grupo.gastos.map((item) => item.id), marcar);
    aplicarIds(
      setDiariaIds,
      [...grupo.diarias, ...grupo.funcionarios].map((item) => item.id),
      marcar
    );
  };

  const gerarPdfAcerto = async (acerto) => {
    if (!acerto?.id) return;
    setPdfEstado(acerto.id);
    try {
      await gerarRelatorioAcertoParceriaPdf({ obra, acerto, configuracoes });
    } catch (error) {
      console.error(error);
    } finally {
      setPdfEstado('idle');
    }
  };

  const custosLista = acertoFechado?.snapshot?.custosDescontados || calculo.custosDescontados || [];

  return (
    <div className={styles.page}>
      <Link to={`/obras/${obra.id}`} className={shared.backLink}>
        <ArrowLeft size={16} /> Voltar à obra
      </Link>

      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>{titulo}</h1>
          <p className={styles.meta}>
            Obra: {obra.nome}
            {leitura ? (
              <>
                <br />
                Data: {acertoFechado?.data ? formatDate(acertoFechado.data) : '—'}
              </>
            ) : (
              <>
                <br />
                {tituloAcertoParceria(calculo.numero || getProximoNumeroAcertoParceria(obra))}
              </>
            )}
          </p>
        </div>
        {leitura && acertoFechado ? (
          <div className={styles.topActions}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={FileDown}
              onClick={() => gerarPdfAcerto(acertoFechado)}
              disabled={pdfEstado !== 'idle'}
            >
              {pdfEstado === acertoFechado.id ? 'A gerar PDF…' : 'Gerar PDF do Acerto'}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => {
                setAcertoParaApagar(acertoFechado);
                setApagarAberto(true);
              }}
            >
              Apagar Acerto
            </Button>
          </div>
        ) : null}
      </header>

      {leitura ? (
        <>
          {calculo.reembolsoConsolidadoHistorico ? (
            <aside className={styles.callout}>
              <strong>Reembolso consolidado Emerson</strong>
              <p>{formatCurrency(calculo.reembolsoConsolidadoEmerson || 0)}</p>
              <p>{calculo.notaHistorica}</p>
            </aside>
          ) : calculo.valoresConsolidados ? (
            <aside className={styles.callout}>
              <strong>Acerto histórico.</strong>
              Este é o registo guardado. Os valores não são recalculados com lançamentos novos.
            </aside>
          ) : null}
          <section className={styles.card} id="resumo-acerto">
            <h2>Resumo do Acerto</h2>
            {calculo.reembolsoConsolidadoHistorico ? (
              <div className={styles.resultList}>
                <div>
                  <span>Pagamento recebido</span>
                  <strong>{formatCurrency(fechamento.pagamento || 0)}</strong>
                </div>
                <div>
                  <span>Reembolso consolidado Emerson</span>
                  <strong>− {formatCurrency(calculo.reembolsoConsolidadoEmerson || 0)}</strong>
                </div>
                <div className={styles.resultTotal}>
                  <span>Restante</span>
                  <strong>{formatCurrency(fechamento.lucroDistribuido ?? fechamento.valorDivisao ?? 0)}</strong>
                </div>
              </div>
            ) : acertoFechado?.tipoHistorico === 'divisao-direta' ? (
              <div className={styles.resultList}>
                <div>
                  <span>Recebido</span>
                  <strong>{formatCurrency(fechamento.pagamento || 0)}</strong>
                </div>
                <div>
                  <span>Custos considerados</span>
                  <strong>{formatCurrency(0)}</strong>
                </div>
                <div className={styles.resultTotal}>
                  <span>Valor dividido</span>
                  <strong>{formatCurrency(fechamento.lucroDistribuido ?? fechamento.valorDivisao ?? 0)}</strong>
                </div>
              </div>
            ) : (
              <ResumoFechamento fechamento={fechamento} calculo={calculo} />
            )}
          </section>
          <SecaoDivisao fechamento={fechamento} pessoas={calculo.pessoas} />
          <ResultadoAcerto pessoas={calculo.pessoas} />
          <section className={styles.card}>
            <h2>Itens incluídos neste Acerto</h2>
            {custosLista.length === 0 ? (
              <p className={styles.empty}>
                {calculo.reembolsoConsolidadoHistorico
                  ? calculo.notaHistorica
                  : (fechamento.custos || 0) > 0.004
                    ? 'Este Acerto guardou o total de custos, sem a lista individual de lançamentos.'
                    : 'Nenhum custo foi selecionado neste Acerto.'}
              </p>
            ) : (
              <div className={styles.costList}>
                {custosLista.map((item) => (
                  <div key={`${item.tipo}-${item.id}`} className={styles.costRowRead}>
                    <span>{item.tipoLabel || item.tipo}</span>
                    <span>{item.data ? formatDate(item.data) : '—'}</span>
                    <span title={item.descricao}>
                      {item.pessoaNome ? `${item.pessoaNome} — ${item.descricao}` : item.descricao}
                    </span>
                    <strong>{formatCurrency(item.valor)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : etapa === 'confirmar' ? (
        <section className={styles.card}>
          <h2>Confirmar Acerto</h2>
          <p className={styles.lead}>Confere os valores. Nada fica gravado até confirmares.</p>
          <ResumoFechamento fechamento={fechamento} calculo={calculo} custosDisponiveis={custosDisponiveis} />
          {avisoPendentes ? (
            <p className={styles.info}>
              Existem {formatCurrency(custosContinuam)} em custos pendentes que não serão incluídos neste Acerto.
            </p>
          ) : null}
          <SecaoDivisao fechamento={fechamento} pessoas={calculo.pessoas} />
          <div className={styles.footer}>
            <Button variant="secondary" type="button" onClick={() => setEtapa('editar')}>
              Voltar e editar
            </Button>
            <Button type="button" onClick={confirmar} disabled={!podeConfirmar}>
              Confirmar Acerto
            </Button>
          </div>
        </section>
      ) : (
        <>
          {rascunhoAtivo ? (
            <aside className={styles.callout}>
              <strong>Acerto em rascunho</strong>
              As escolhas guardadas foram recuperadas. O histórico e a reserva oficial não mudam enquanto isto for rascunho.
              <div className={styles.costActions}>
                <Button type="button" size="sm" variant="secondary" onClick={excluirRascunho}>
                  Excluir rascunho
                </Button>
              </div>
            </aside>
          ) : null}
          {aviso ? <p className={styles.info}>{aviso}</p> : null}

          <section className={styles.card}>
            <h2>1. Pagamento recebido</h2>
            <FormGroup label="Novo pagamento recebido">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={recebidoInformado}
                onChange={(e) => setRecebidoInformado(e.target.value)}
                placeholder="0.00"
              />
            </FormGroup>
            {!pagamentoCampo.ok ? <p className={styles.warn}>Indica um valor válido para o pagamento.</p> : null}
            <FormGroup label="Data do acerto">
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </FormGroup>
          </section>

          <section className={styles.card}>
            <h2>2. Reserva anterior</h2>
            <p className={styles.lead}>
              Valor deixado no Acerto anterior para continuar a obra até um novo pagamento. Não é, por si, uma conta bancária separada.
            </p>
            <div className={styles.resultList}>
              <div>
                <span>Reserva anterior</span>
                <strong>{formatCurrency(reservaAnterior)}</strong>
              </div>
            </div>
            <label className={styles.checkLine}>
              <input
                type="checkbox"
                checked={usarReserva}
                disabled={reservaAnterior <= 0.004}
                onChange={(e) => {
                  setUsarReserva(e.target.checked);
                  if (!e.target.checked) setReservaUtilizada('');
                }}
              />
              Utilizar reserva anterior neste Acerto
            </label>
            {reservaAnterior <= 0.004 ? <p className={styles.empty}>Não há reserva anterior.</p> : null}
            {usarReserva ? (
              <FormGroup label="Valor da reserva a utilizar">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  max={reservaAnterior}
                  value={reservaUtilizada}
                  onChange={(e) => setReservaUtilizada(e.target.value)}
                  placeholder="0.00"
                />
              </FormGroup>
            ) : (
              <p className={styles.info}>Nenhuma reserva anterior foi utilizada.</p>
            )}
            {!reservaUsadaCampo.ok ? <p className={styles.warn}>Indica um valor válido para a reserva utilizada.</p> : null}
            {fechamento.reservaExcede ? (
              <p className={styles.warn}>
                A reserva utilizada não pode ser maior que a reserva disponível ({formatCurrency(reservaAnterior)}).
              </p>
            ) : null}
            <div className={styles.resultList}>
              <div>
                <span>Novo pagamento</span>
                <strong>{formatCurrency(fechamento.pagamento || 0)}</strong>
              </div>
              <div>
                <span>Reserva anterior utilizada</span>
                <strong>{formatCurrency(fechamento.reservaUtilizada || 0)}</strong>
              </div>
              <div>
                <span>Reserva restante</span>
                <strong>{formatCurrency(fechamento.reservaRestante || 0)}</strong>
              </div>
            </div>
            <p className={styles.info}>
              A reserva utilizada paga parte dos custos selecionados. Não conta como dinheiro novo deste pagamento.
            </p>
          </section>

          <section className={styles.card}>
            <h2>3. Custos a considerar</h2>
            <p className={styles.lead}>
              Um gasto cadastrado só entra neste Acerto se o selecionares. Os restantes continuam pendentes para um Acerto futuro.
            </p>
            <div className={styles.resultList}>
              <div>
                <span>Custos disponíveis</span>
                <strong>{formatCurrency(custosDisponiveis)}</strong>
              </div>
              <div>
                <span>Custos selecionados neste Acerto</span>
                <strong>{formatCurrency(fechamento.custos || 0)}</strong>
              </div>
              <div>
                <span>Custos que continuarão pendentes</span>
                <strong>{formatCurrency(custosContinuam)}</strong>
              </div>
            </div>
            <div className={styles.costActions}>
              <Button type="button" size="sm" variant="secondary" onClick={selecionarTodosCustos}>
                Selecionar todos
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={desmarcarTodosCustos}>
                Desmarcar todos
              </Button>
            </div>
            {fechamento.nenhumCusto ? (
              <p className={styles.info}>Custos selecionados: 0,00 €. Podes continuar sem descontar nenhum custo.</p>
            ) : null}
            {gruposCustos.length === 0 ? (
              <p className={styles.empty}>Não há custos pendentes nesta obra.</p>
            ) : (
              gruposCustos.map((grupo) => {
                const selecionado =
                  grupo.key === 'emerson'
                    ? calculo.emerson?.totalCusto || 0
                    : grupo.key === 'fabio'
                      ? calculo.fabio?.totalCusto || 0
                      : grupo.key === 'juliano'
                        ? calculo.juliano?.totalCusto || 0
                        : calculo.caixa?.gastosValor || 0;
                return (
                  <details key={grupo.key} className={styles.costGroup} open>
                    <summary className={styles.groupSummary}>
                      <span>{grupo.nome}</span>
                      <strong>Selecionado: {formatCurrency(selecionado)}</strong>
                    </summary>
                    <div className={styles.costActions}>
                      <Button type="button" size="sm" variant="secondary" onClick={() => marcarGrupo(grupo, true)}>
                        Selecionar nesta secção
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => marcarGrupo(grupo, false)}>
                        Limpar nesta secção
                      </Button>
                    </div>
                    <CategoriaCustos
                      titulo="Gastos / compras"
                      items={grupo.gastos}
                      selected={gastoIds}
                      onToggle={(itemId) => {
                        if (!gastoIds.has(itemId)) notarSelecao();
                        setGastoIds((prev) => toggleId(prev, itemId));
                      }}
                      onMarcar={() => {
                        notarSelecao();
                        aplicarIds(setGastoIds, grupo.gastos.map((item) => item.id), true);
                      }}
                      onLimpar={() => aplicarIds(setGastoIds, grupo.gastos.map((item) => item.id), false)}
                      descricaoDe={(item) => item.descricao || 'Gasto'}
                      valorDe={(item) => item.valor}
                    />
                    <CategoriaCustos
                      titulo={grupo.key === 'emerson' ? 'Diária própria' : 'Diárias'}
                      items={grupo.diarias}
                      selected={diariaIds}
                      onToggle={(itemId) => {
                        if (!diariaIds.has(itemId)) notarSelecao();
                        setDiariaIds((prev) => toggleId(prev, itemId));
                      }}
                      onMarcar={() => {
                        notarSelecao();
                        aplicarIds(setDiariaIds, grupo.diarias.map((item) => item.id), true);
                      }}
                      onLimpar={() => aplicarIds(setDiariaIds, grupo.diarias.map((item) => item.id), false)}
                      descricaoDe={(item) => item.nome || 'Diária'}
                      valorDe={valorCustoLinhaDiaria}
                    />
                    <CategoriaCustos
                      titulo="Mão de obra dos funcionários"
                      items={grupo.funcionarios}
                      selected={diariaIds}
                      onToggle={(itemId) => {
                        if (!diariaIds.has(itemId)) notarSelecao();
                        setDiariaIds((prev) => toggleId(prev, itemId));
                      }}
                      onMarcar={() => {
                        notarSelecao();
                        aplicarIds(setDiariaIds, grupo.funcionarios.map((item) => item.id), true);
                      }}
                      onLimpar={() => aplicarIds(setDiariaIds, grupo.funcionarios.map((item) => item.id), false)}
                      descricaoDe={(item) => item.nome || 'Funcionário'}
                      valorDe={valorCustoLinhaDiaria}
                    />
                  </details>
                );
              })
            )}
            <div className={styles.resultTotal}>
              <span>Total de custos selecionados</span>
              <strong>{formatCurrency(fechamento.custos || 0)}</strong>
            </div>
          </section>

          <section className={styles.card}>
            <h2>4. Nova reserva</h2>
            <p className={styles.lead}>
              Valor deste pagamento que queres guardar. Soma-se à reserva que sobrou depois da utilização. Não substitui a reserva que já existia.
            </p>
            <FormGroup label="Nova reserva deixada deste pagamento">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={reservaFinal}
                onChange={(e) => setReservaFinal(e.target.value)}
                placeholder="0.00"
              />
            </FormGroup>
            {!reservaFinalCampo.ok ? <p className={styles.warn}>Indica um valor válido para a nova reserva.</p> : null}
            <div className={styles.resultList}>
              <div>
                <span>Reserva depois de utilizar</span>
                <strong>{formatCurrency(fechamento.reservaRestante || 0)}</strong>
              </div>
              <div>
                <span>Nova reserva deixada</span>
                <strong>{formatCurrency(fechamento.novaReservaDeixada || 0)}</strong>
              </div>
              <div className={styles.resultTotal}>
                <span>Reserva final</span>
                <strong>{formatCurrency(fechamento.reservaFinal || 0)}</strong>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <h2>5. O que quero fazer neste Acerto?</h2>
            <label className={styles.checkLine}>
              <input
                type="radio"
                name="tipoFechamentoAcerto"
                checked={modo === 'custos'}
                onChange={() => escolherModo('custos')}
              />
              Acertar custos / diárias sem distribuir lucro
            </label>
            <label className={styles.checkLine}>
              <input
                type="radio"
                name="tipoFechamentoAcerto"
                checked={modo === 'custos-lucro'}
                onChange={() => escolherModo('custos-lucro')}
              />
              Acertar custos e distribuir o lucro restante
            </label>
            <label className={styles.checkLine}>
              <input
                type="radio"
                name="tipoFechamentoAcerto"
                checked={modo === 'dividir'}
                onChange={() => escolherModo('dividir')}
              />
              Dividir pagamento sem descontar custos
            </label>
            <p className={styles.lead}>
              Estas opções organizam o ecrã. Podes continuar a escolher custos, reserva e pagamento à mão. Um gasto só entra se estiver marcado.
            </p>
            {avisoPendentes ? (
              <div>
                <p className={styles.info}>
                  Existem {formatCurrency(custosContinuam)} em custos pendentes que não serão incluídos neste Acerto.
                </p>
                <Button type="button" size="sm" variant="secondary" onClick={() => setEtapa('confirmar')} disabled={!podeConfirmar}>
                  Continuar
                </Button>
              </div>
            ) : null}
          </section>

          <section className={styles.card} id="resumo-acerto">
            <h2>6. Resumo do Acerto</h2>
            <ResumoFechamento fechamento={fechamento} calculo={calculo} custosDisponiveis={custosDisponiveis} />
          </section>

          <SecaoDivisao fechamento={fechamento} pessoas={calculo.pessoas} />

          {!temAlgo ? <p className={styles.warn}>Indica um pagamento, uma reserva ou custos para fechar o Acerto.</p> : null}

          <div className={styles.footer}>
            <Button variant="secondary" type="button" onClick={() => navigate(`/obras/${obra.id}`)}>
              Cancelar
            </Button>
            <Button variant="secondary" type="button" onClick={guardarRascunho}>
              Salvar rascunho
            </Button>
            <Button type="button" onClick={() => setEtapa('confirmar')} disabled={!podeConfirmar}>
              Rever e confirmar
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={apagarAberto}
        onClose={() => setApagarAberto(false)}
        onConfirm={confirmarApagar}
        title="Tem certeza que deseja apagar este Acerto?"
        confirmLabel="Apagar Acerto"
        cancelLabel="Cancelar"
      >
        <p className={styles.lead}>Os gastos, diárias e mão de obra originais não serão apagados.</p>
      </ConfirmDialog>
    </div>
  );
}
