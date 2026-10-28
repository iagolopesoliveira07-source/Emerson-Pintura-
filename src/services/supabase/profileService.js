import { supabase } from '../../lib/supabase';
import { mapConfiguracoesToEmpresa } from './mappers';

function getDisplayName(user, configuracoes) {
  const metadata = user.user_metadata || {};
  return metadata.full_name || metadata.nome || configuracoes?.utilizador?.nome || user.email?.split('@')[0] || 'Utilizador';
}

function getUserRole(user, configuracoes) {
  return user.user_metadata?.role || configuracoes?.utilizador?.cargo || 'Administrador';
}

export async function fetchUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, empresas(*)')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function ensureUserProfile(user, configuracoes) {
  const existing = await fetchUserProfile(user.id);

  if (existing) {
    return {
      empresaId: existing.empresa_id,
      profile: existing,
      empresa: existing.empresas,
    };
  }

  const empresaPayload = mapConfiguracoesToEmpresa(configuracoes);

  const { data: empresa, error: empresaError } = await supabase
    .from('empresas')
    .insert(empresaPayload)
    .select()
    .single();

  if (empresaError) throw empresaError;

  const profilePayload = {
    id: user.id,
    empresa_id: empresa.id,
    nome: getDisplayName(user, configuracoes),
    cargo: configuracoes?.utilizador?.cargo || 'Administrador',
    role: getUserRole(user, configuracoes),
  };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert(profilePayload)
    .select()
    .single();

  if (profileError) throw profileError;

  return { empresaId: empresa.id, profile, empresa };
}

export async function updateEmpresaConfig(empresaId, configuracoes) {
  const empresaPayload = mapConfiguracoesToEmpresa(configuracoes);

  const { error: empresaError } = await supabase
    .from('empresas')
    .update(empresaPayload)
    .eq('id', empresaId);

  if (empresaError) throw empresaError;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      nome: configuracoes.utilizador.nome,
      cargo: configuracoes.utilizador.cargo,
    })
    .eq('empresa_id', empresaId);

  if (profileError) throw profileError;
}
