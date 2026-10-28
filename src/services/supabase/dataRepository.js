import { supabase } from '../../lib/supabase';
import {
  mapObraToDb,
  mapObraFromDb,
  mapFuncionarioToDb,
  mapFuncionarioFromDb,
  mapDiariaToDb,
  mapDiariaFromDb,
  mapAdiantamentoToDb,
  mapAdiantamentoFromDb,
  mapEmprestimoToDb,
  mapEmprestimoFromDb,
  mapGastoToDb,
  mapGastoFromDb,
  mapPagamentoToDb,
  mapPagamentoFromDb,
} from './mappers';

export async function fetchAllData(empresaId) {
  const [obras, funcionarios, diarias, adiantamentos, emprestimos, gastos, pagamentos] = await Promise.all([
    supabase.from('obras').select('*').eq('empresa_id', empresaId),
    supabase.from('funcionarios').select('*').eq('empresa_id', empresaId),
    supabase.from('diarias').select('*').eq('empresa_id', empresaId),
    supabase.from('adiantamentos').select('*').eq('empresa_id', empresaId),
    supabase.from('emprestimos').select('*').eq('empresa_id', empresaId),
    supabase.from('gastos').select('*').eq('empresa_id', empresaId),
    supabase.from('pagamentos').select('*').eq('empresa_id', empresaId),
  ]);

  const errors = [obras, funcionarios, diarias, adiantamentos, emprestimos, gastos, pagamentos]
    .map((r) => r.error)
    .filter(Boolean);

  if (errors.length > 0) {
    throw errors[0];
  }

  return {
    obras: (obras.data || []).map(mapObraFromDb),
    funcionarios: (funcionarios.data || []).map(mapFuncionarioFromDb),
    diarias: (diarias.data || []).map(mapDiariaFromDb),
    adiantamentos: (adiantamentos.data || []).map(mapAdiantamentoFromDb),
    emprestimos: (emprestimos.data || []).map(mapEmprestimoFromDb),
    gastos: (gastos.data || []).map(mapGastoFromDb),
    pagamentos: (pagamentos.data || []).map(mapPagamentoFromDb),
  };
}

export async function countObras(empresaId) {
  const { count, error } = await supabase
    .from('obras')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId);

  if (error) throw error;
  return count || 0;
}

export async function upsertObra(empresaId, obra) {
  const { error } = await supabase.from('obras').upsert(mapObraToDb(obra, empresaId));
  if (error) throw error;
}

export async function deleteObraRecord(empresaId, obraId) {
  await supabase.from('diarias').delete().eq('empresa_id', empresaId).eq('obra_id', obraId);
  await supabase.from('gastos').delete().eq('empresa_id', empresaId).eq('obra_id', obraId);
  await supabase.from('pagamentos').delete().eq('empresa_id', empresaId).eq('obra_id', obraId);
  const { error } = await supabase.from('obras').delete().eq('empresa_id', empresaId).eq('id', obraId);
  if (error) throw error;
}

export async function upsertFuncionario(empresaId, func) {
  const { error } = await supabase.from('funcionarios').upsert(mapFuncionarioToDb(func, empresaId));
  if (error) throw error;
}

export async function deleteFuncionarioRecord(empresaId, funcionarioId) {
  const { data: obras } = await supabase.from('obras').select('id, funcionarios').eq('empresa_id', empresaId);
  if (obras) {
    await Promise.all(
      obras
        .filter((o) => (o.funcionarios || []).includes(funcionarioId))
        .map((o) =>
          supabase
            .from('obras')
            .update({ funcionarios: o.funcionarios.filter((id) => id !== funcionarioId) })
            .eq('id', o.id)
        )
    );
  }
  const { error } = await supabase.from('funcionarios').delete().eq('empresa_id', empresaId).eq('id', funcionarioId);
  if (error) throw error;
}

export async function upsertDiaria(empresaId, diaria) {
  const { error } = await supabase.from('diarias').upsert(mapDiariaToDb(diaria, empresaId));
  if (error) throw error;
}

export async function deleteDiariaRecord(empresaId, diariaId) {
  const { error } = await supabase.from('diarias').delete().eq('empresa_id', empresaId).eq('id', diariaId);
  if (error) throw error;
}

export async function insertAdiantamento(empresaId, adv) {
  const { error } = await supabase.from('adiantamentos').insert(mapAdiantamentoToDb(adv, empresaId));
  if (error) throw error;
}

export async function insertEmprestimo(empresaId, emp) {
  const { error } = await supabase.from('emprestimos').insert(mapEmprestimoToDb(emp, empresaId));
  if (error) throw error;
}

export async function upsertEmprestimo(empresaId, emp) {
  const { error } = await supabase.from('emprestimos').upsert(mapEmprestimoToDb(emp, empresaId));
  if (error) throw error;
}

export async function insertGasto(empresaId, gasto) {
  const { error } = await supabase.from('gastos').insert(mapGastoToDb(gasto, empresaId));
  if (error) throw error;
}

export async function insertPagamento(empresaId, pag) {
  const { error } = await supabase.from('pagamentos').insert(mapPagamentoToDb(pag, empresaId));
  if (error) throw error;
}

export async function deleteAllBusinessData(empresaId) {
  const tables = ['pagamentos', 'gastos', 'emprestimos', 'adiantamentos', 'diarias', 'funcionarios', 'obras'];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('empresa_id', empresaId);
    if (error) throw error;
  }
}

export async function bulkInsertAll(empresaId, data) {
  if (data.obras?.length) {
    const { error } = await supabase.from('obras').insert(data.obras.map((o) => mapObraToDb(o, empresaId)));
    if (error) throw error;
  }
  if (data.funcionarios?.length) {
    const { error } = await supabase.from('funcionarios').insert(data.funcionarios.map((f) => mapFuncionarioToDb(f, empresaId)));
    if (error) throw error;
  }
  if (data.diarias?.length) {
    const { error } = await supabase.from('diarias').insert(data.diarias.map((d) => mapDiariaToDb(d, empresaId)));
    if (error) throw error;
  }
  if (data.adiantamentos?.length) {
    const { error } = await supabase.from('adiantamentos').insert(data.adiantamentos.map((a) => mapAdiantamentoToDb(a, empresaId)));
    if (error) throw error;
  }
  if (data.emprestimos?.length) {
    const { error } = await supabase.from('emprestimos').insert(data.emprestimos.map((e) => mapEmprestimoToDb(e, empresaId)));
    if (error) throw error;
  }
  if (data.gastos?.length) {
    const { error } = await supabase.from('gastos').insert(data.gastos.map((g) => mapGastoToDb(g, empresaId)));
    if (error) throw error;
  }
  if (data.pagamentos?.length) {
    const { error } = await supabase.from('pagamentos').insert(data.pagamentos.map((p) => mapPagamentoToDb(p, empresaId)));
    if (error) throw error;
  }
}
