-- Cópia completa dos dados do sistema.
-- A tabela não é legível pelo navegador. Só uma sessão aberta com a senha pode ler ou gravar.

create table if not exists public.app_estado (
  id int primary key default 1 check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_sessao (
  token text primary key,
  expires_at timestamptz not null
);

alter table public.app_estado enable row level security;
alter table public.app_sessao enable row level security;

create or replace function public.abrir_sessao(senha text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  novo text;
begin
  if not public.entrar_com_senha(senha) then
    return null;
  end if;

  delete from public.app_sessao where expires_at <= now();
  novo := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.app_sessao (token, expires_at)
  values (novo, now() + interval '12 hours');
  return novo;
end;
$$;

create or replace function public.ler_estado(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_sessao
    where app_sessao.token = ler_estado.token
      and expires_at > now()
  ) then
    raise exception 'Sessão expirada.';
  end if;

  return (select payload from public.app_estado where id = 1);
end;
$$;

create or replace function public.guardar_estado(token text, payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  limpo jsonb;
begin
  if not exists (
    select 1 from public.app_sessao
    where app_sessao.token = guardar_estado.token
      and expires_at > now()
  ) then
    raise exception 'Sessão expirada.';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Estado inválido.';
  end if;

  limpo := payload - 'emerson_pinturas_auth';

  if jsonb_typeof(limpo->'ep_obras') = 'array'
     and jsonb_array_length(limpo->'ep_obras') = 0
     and exists (
       select 1 from public.app_estado
       where id = 1
         and jsonb_typeof(app_estado.payload->'ep_obras') = 'array'
         and jsonb_array_length(app_estado.payload->'ep_obras') > 0
     ) then
    raise exception 'Recusa gravar um estado vazio por cima dos dados.';
  end if;

  insert into public.app_estado (id, payload, updated_at)
  values (1, limpo, now())
  on conflict (id) do update
    set payload = excluded.payload,
        updated_at = now();
  return true;
end;
$$;

create or replace function public.guardar_estado_inicial(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  limpo jsonb;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Estado inválido.';
  end if;

  if exists (select 1 from public.app_estado where id = 1) then
    return jsonb_build_object('ok', false, 'motivo', 'ja_existe');
  end if;

  limpo := payload - 'emerson_pinturas_auth';

  if jsonb_typeof(limpo->'ep_obras') <> 'array'
     or jsonb_array_length(limpo->'ep_obras') = 0
     or not exists (
       select 1
       from jsonb_array_elements(limpo->'ep_obras') obra
       where obra->>'id' not in ('obra-1', 'obra-2', 'obra-3', 'obra-4')
     ) then
    raise exception 'Estes não são os dados reais da empresa.';
  end if;

  insert into public.app_estado (id, payload, updated_at)
  values (1, limpo, now());

  return jsonb_build_object(
    'ok', true,
    'obras', case when jsonb_typeof(limpo->'ep_obras') = 'array' then jsonb_array_length(limpo->'ep_obras') else 0 end,
    'funcionarios', case when jsonb_typeof(limpo->'ep_funcionarios') = 'array' then jsonb_array_length(limpo->'ep_funcionarios') else 0 end,
    'diarias', case when jsonb_typeof(limpo->'ep_diarias') = 'array' then jsonb_array_length(limpo->'ep_diarias') else 0 end,
    'gastos', case when jsonb_typeof(limpo->'ep_gastos') = 'array' then jsonb_array_length(limpo->'ep_gastos') else 0 end,
    'gastos_empresa', case when jsonb_typeof(limpo->'ep_gastos_empresa') = 'array' then jsonb_array_length(limpo->'ep_gastos_empresa') else 0 end,
    'pagamentos', case when jsonb_typeof(limpo->'ep_pagamentos') = 'array' then jsonb_array_length(limpo->'ep_pagamentos') else 0 end
  );
end;
$$;

revoke all on function public.abrir_sessao(text) from public;
revoke all on function public.ler_estado(text) from public;
revoke all on function public.guardar_estado(text, jsonb) from public;
revoke all on function public.guardar_estado_inicial(jsonb) from public;

grant execute on function public.abrir_sessao(text) to anon, authenticated;
grant execute on function public.ler_estado(text) to anon, authenticated;
grant execute on function public.guardar_estado(text, jsonb) to anon, authenticated;
grant execute on function public.guardar_estado_inicial(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
