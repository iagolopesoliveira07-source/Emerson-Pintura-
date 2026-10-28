import { getValorRecebidoPagamento } from './debtCalculations';
import { isGastoEmpresaEfetivo } from './gastoEmpresaCalculations';
import { GASTO_CATEGORIAS_DIARIA_LEGACY } from './gastoDiariaIntegration';
import { getGastoValorAssinado } from './gastoDocumentoSinal';
import { getGastoCustoEmpresa } from './gastoDocumentoTipo';
import { calcDiariaValorPagavel, isDiariaDeParceiro } from './funcionarioTipo';
import { roundMoney } from './ivaCalculations';
import { extraRecebidoNoPeriodo, getObraExtras } from './obraExtras';
import { isObraPagamentoRecebido } from './obraPagamentoCalculations';
import { getAcertosParceria } from './obraParceriaAcertos';
import { GASTO_PAGADOR, isPartnershipObra, resolveGastoPagadorId } from './obraPartnership';
import { isDateInPeriod } from './periodFilter';
import { asRecordList } from './safeCollections';

function dataIso(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function idLista(value) {
  return asRecordList(value)
    .map((item) => String(item?.id || item || '').trim())
    .filter(Boolean);
}

function linhasDoRecebimento(pagamento) {
  const historico = asRecordList(pagamento?.historicoPagamentos);
  if (historico.length) {
    return historico
      .map((entry) => ({
        data: dataIso(entry?.data),
        valor: roundMoney(Number(entry?.valor) || 0),
      }))
      .filter((entry) => entry.data && Math.abs(entry.valor) > 0.004);
  }
  const data = dataIso(pagamento?.data);
  const valor = roundMoney(getValorRecebidoPagamento(pagamento));
  if (!data || Math.abs(valor) <= 0.004) return [];
  return [{ data, valor }];
}

function snapshotAcerto(acerto) {
  return acerto?.snapshot && typeof acerto.snapshot === 'object' ? acerto.snapshot : {};
}

function pessoaEmerson(acerto) {
  const snap = snapshotAcerto(acerto);
  const pessoas = asRecordList(snap.pessoas?.length ? snap.pessoas : acerto?.pessoas);
  return pessoas.find((pessoa) => pessoa?.key === 'emerson') || null;
}

function mapaAcertos(obra) {
  const gastos = new Set();
  const diarias = new Set();
  const recebimentos = new Set();
  let ultimoAcerto = '';
  let temIdsRecebimento = false;

  getAcertosParceria(obra).forEach((acerto) => {
    const snap = snapshotAcerto(acerto);
    asRecordList(snap.custosDescontados || acerto.custosDescontados).forEach((item) => {
      const id = String(item?.id || '').trim();
      if (!id) return;
      if (item.tipo === 'gasto') gastos.add(id);
      else diarias.add(id);
    });
    const ids = idLista(acerto.recebimentoIds?.length ? acerto.recebimentoIds : snap.recebimentoIds);
    if (ids.length) temIdsRecebimento = true;
    ids.forEach((id) => recebimentos.add(id));
    const data = dataIso(acerto.data);
    if (data > ultimoAcerto) ultimoAcerto = data;
  });

  return { gastos, diarias, recebimentos, ultimoAcerto, temIdsRecebimento };
}

function recebimentoAindaNaoAcertado(info, pagamentoId, data) {
  if (info.recebimentos.has(String(pagamentoId))) return false;
  if (info.temIdsRecebimento) return true;
  if (!info.ultimoAcerto) return true;
  return data > info.ultimoAcerto;
}

function gastoEhDaEmpresa(gasto, obra, acertos) {
  if (!obra || !isPartnershipObra(obra)) return true;
  const pagador = resolveGastoPagadorId(gasto, obra);
  if (
    pagador === GASTO_PAGADOR.FABIO ||
    pagador === GASTO_PAGADOR.JULIANO ||
    pagador === GASTO_PAGADOR.CAIXA
  ) {
    return false;
  }
  if (acertos.gastos.has(String(gasto.id))) return false;
  return true;
}

/**
 * Leitura interna da Emerson Pinturas num período.
 * Não grava dados e não recalcula Acertos históricos.
 */
export function buildResultadoInternoEmpresa({
  obras = [],
  gastos = [],
  gastosEmpresa = [],
  diarias = [],
  pagamentos = [],
  funcionarios = [],
  range = null,
} = {}) {
  const obrasLista = asRecordList(obras).filter(Boolean);
  const obraPorId = new Map(obrasLista.map((obra) => [obra.id, obra]));
  const acertosPorObra = new Map(obrasLista.map((obra) => [obra.id, mapaAcertos(obra)]));

  const entradas = [];
  const pendentes = [];
  const partes = [];
  const reembolsos = [];
  const gastosLinhas = [];
  const porObra = new Map();

  function obraRow(obra, empresa = false) {
    const id = empresa ? 'empresa' : obra?.id || 'sem-obra';
    if (!porObra.has(id)) {
      porObra.set(id, {
        id,
        nome: empresa ? 'Gastos da empresa' : obra?.nome || 'Sem obra',
        parceria: obra ? isPartnershipObra(obra) : false,
        entrada: 0,
        gastos: 0,
        parteEmerson: 0,
        reembolso: 0,
        pendente: 0,
      });
    }
    return porObra.get(id);
  }

  obrasLista.forEach((obra) => {
    const parceria = isPartnershipObra(obra);
    const info = acertosPorObra.get(obra.id);

    asRecordList(pagamentos)
      .filter((pagamento) => pagamento?.obraId === obra.id && isObraPagamentoRecebido(pagamento))
      .forEach((pagamento) => {
        linhasDoRecebimento(pagamento).forEach((linha) => {
          if (!isDateInPeriod(linha.data, range)) return;
          const item = {
            id: `${pagamento.id}-${linha.data}`,
            obraId: obra.id,
            obra: obra.nome,
            data: linha.data,
            valor: linha.valor,
            parceria,
            descricao: 'Recebimento',
          };
          entradas.push(item);
          const row = obraRow(obra);
          row.entrada = roundMoney(row.entrada + linha.valor);
          if (parceria && recebimentoAindaNaoAcertado(info, pagamento.id, linha.data)) {
            pendentes.push(item);
            row.pendente = roundMoney(row.pendente + linha.valor);
          }
        });
      });

    getObraExtras(obra).forEach((extra) => {
      const valor = extraRecebidoNoPeriodo(extra, range);
      if (Math.abs(valor) <= 0.004) return;
      const data = dataIso(extra.recebidoAt || extra.updatedAt || extra.data);
      const item = {
        id: extra.id,
        obraId: obra.id,
        obra: obra.nome,
        data,
        valor,
        parceria,
        descricao: extra.descricao || 'Extra recebido',
      };
      entradas.push(item);
      const row = obraRow(obra);
      row.entrada = roundMoney(row.entrada + valor);
      if (parceria) {
        pendentes.push(item);
        row.pendente = roundMoney(row.pendente + valor);
      }
    });

    if (!parceria) return;
    getAcertosParceria(obra).forEach((acerto) => {
      const data = dataIso(acerto.data);
      if (!isDateInPeriod(data, range)) return;
      const emerson = pessoaEmerson(acerto);
      const lucro = roundMoney(Number(emerson?.lucro) || 0);
      const reembolso = roundMoney(Number(emerson?.reembolso) || 0);
      const row = obraRow(obra);
      if (Math.abs(lucro) > 0.004) {
        partes.push({
          id: acerto.id,
          obraId: obra.id,
          obra: obra.nome,
          data,
          valor: lucro,
          descricao: acerto.titulo || `Acerto ${acerto.numero || ''}`.trim(),
        });
        row.parteEmerson = roundMoney(row.parteEmerson + lucro);
      }
      if (Math.abs(reembolso) > 0.004) {
        reembolsos.push({
          id: `${acerto.id}-reembolso`,
          obraId: obra.id,
          obra: obra.nome,
          data,
          valor: reembolso,
          descricao: acerto.titulo || `Acerto ${acerto.numero || ''}`.trim(),
        });
        row.reembolso = roundMoney(row.reembolso + reembolso);
      }
    });
  });

  asRecordList(gastos)
    .filter((gasto) => gasto && !GASTO_CATEGORIAS_DIARIA_LEGACY.includes(gasto.categoria))
    .forEach((gasto) => {
      const data = dataIso(gasto.data);
      if (!isDateInPeriod(data, range)) return;
      const obra = obraPorId.get(gasto.obraId) || null;
      const acertos = obra ? acertosPorObra.get(obra.id) : null;
      if (!gastoEhDaEmpresa(gasto, obra, acertos || mapaAcertos(null))) return;
      const valor = roundMoney(getGastoCustoEmpresa(gasto));
      if (Math.abs(valor) <= 0.004) return;
      gastosLinhas.push({
        id: gasto.id,
        obraId: obra?.id || '',
        obra: obra?.nome || 'Sem obra',
        data,
        valor,
        descricao: gasto.descricao || gasto.categoria || 'Gasto',
      });
      obraRow(obra).gastos = roundMoney(obraRow(obra).gastos + valor);
    });

  asRecordList(gastosEmpresa)
    .filter((gasto) => isGastoEmpresaEfetivo(gasto) && (!gasto.estado || gasto.estado === 'pago'))
    .forEach((gasto) => {
      const data = dataIso(gasto.data);
      if (!isDateInPeriod(data, range)) return;
      const valor = roundMoney(getGastoValorAssinado(gasto));
      if (Math.abs(valor) <= 0.004) return;
      gastosLinhas.push({
        id: gasto.id,
        obraId: '',
        obra: 'Empresa',
        data,
        valor,
        descricao: gasto.descricao || gasto.categoria || 'Gasto da empresa',
      });
      obraRow(null, true).gastos = roundMoney(obraRow(null, true).gastos + valor);
    });

  asRecordList(diarias).forEach((diaria) => {
    if (isDiariaDeParceiro(diaria, funcionarios)) return;
    const data = dataIso(diaria.data);
    if (!isDateInPeriod(data, range)) return;
    const obra = obraPorId.get(diaria.obraId) || null;
    const acertos = obra ? acertosPorObra.get(obra.id) : null;
    if (obra && isPartnershipObra(obra) && acertos?.diarias.has(String(diaria.id))) return;
    const valor = roundMoney(calcDiariaValorPagavel(diaria, funcionarios));
    if (Math.abs(valor) <= 0.004) return;
    gastosLinhas.push({
      id: diaria.id,
      obraId: obra?.id || '',
      obra: obra?.nome || 'Sem obra',
      data,
      valor,
      descricao: 'Diária',
    });
    obraRow(obra).gastos = roundMoney(obraRow(obra).gastos + valor);
  });

  const entradasNormais = roundMoney(
    entradas.filter((item) => !item.parceria).reduce((sum, item) => sum + item.valor, 0)
  );
  const entradasReais = roundMoney(entradas.reduce((sum, item) => sum + item.valor, 0));
  const parteEmerson = roundMoney(partes.reduce((sum, item) => sum + item.valor, 0));
  const reembolsosEmerson = roundMoney(reembolsos.reduce((sum, item) => sum + item.valor, 0));
  const parceriaPendente = roundMoney(pendentes.reduce((sum, item) => sum + item.valor, 0));
  const gastosInternos = roundMoney(gastosLinhas.reduce((sum, item) => sum + item.valor, 0));
  const resultadoInterno = roundMoney(entradasNormais - gastosInternos + parteEmerson);

  const obrasRows = [...porObra.values()]
    .map((row) => ({
      ...row,
      resultado: roundMoney((row.parceria ? 0 : row.entrada) - row.gastos + row.parteEmerson),
    }))
    .filter((row) => row.entrada || row.gastos || row.parteEmerson || row.pendente);

  return {
    entradasReais,
    entradasNormais,
    parteEmerson,
    reembolsosEmerson,
    parceriaPendente,
    gastosInternos,
    resultadoInterno,
    entradas: entradas.sort((a, b) => String(a.data).localeCompare(String(b.data))),
    pendentes: pendentes.sort((a, b) => String(a.data).localeCompare(String(b.data))),
    partes: partes.sort((a, b) => String(a.data).localeCompare(String(b.data))),
    reembolsos: reembolsos.sort((a, b) => String(a.data).localeCompare(String(b.data))),
    gastosLinhas: gastosLinhas.sort((a, b) => String(a.data).localeCompare(String(b.data))),
    obras: obrasRows.sort((a, b) => b.resultado - a.resultado),
  };
}
