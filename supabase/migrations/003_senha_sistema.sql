-- Senha única do sistema. Não fica no navegador.
-- Executar depois de 002_rls_policies.sql

create extension if not exists pgcrypto;

create table if not exists public.app_senha (
  id int primary key default 1 check (id = 1),
  password_hash text not null,
  configured_at timestamptz not null default now()
);

alter table public.app_senha enable row level security;

create or replace function public.senha_esta_configurada()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_senha where id = 1);
$$;

create or replace function public.definir_senha(senha text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if senha is null or char_length(senha) < 4 then
    raise exception 'A senha deve ter pelo menos 4 caracteres.';
  end if;

  if exists (select 1 from public.app_senha where id = 1) then
    return false;
  end if;

  insert into public.app_senha (id, password_hash)
  values (1, crypt(senha, gen_salt('bf')));
  return true;
exception
  when unique_violation then
    return false;
end;
$$;

create or replace function public.entrar_com_senha(senha text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_senha
    where id = 1
      and password_hash = crypt(senha, password_hash)
  );
$$;

create or replace function public.alterar_senha(senha_atual text, senha_nova text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.entrar_com_senha(senha_atual) then
    return false;
  end if;

  if senha_nova is null or char_length(senha_nova) < 4 then
    raise exception 'A senha deve ter pelo menos 4 caracteres.';
  end if;

  update public.app_senha
  set password_hash = crypt(senha_nova, gen_salt('bf')),
      configured_at = now()
  where id = 1;
  return true;
end;
$$;

revoke all on function public.senha_esta_configurada() from public;
revoke all on function public.definir_senha(text) from public;
revoke all on function public.entrar_com_senha(text) from public;
revoke all on function public.alterar_senha(text, text) from public;

grant execute on function public.senha_esta_configurada() to anon, authenticated;
grant execute on function public.definir_senha(text) to anon, authenticated;
grant execute on function public.entrar_com_senha(text) to anon, authenticated;
grant execute on function public.alterar_senha(text, text) to anon, authenticated;
