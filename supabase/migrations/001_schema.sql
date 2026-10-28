-- Emerson Pinturas — Schema completo
-- Executar no SQL Editor do Supabase (Dashboard → SQL → New query)

create extension if not exists "pgcrypto";

-- ============================================================
-- EMPRESAS E PERFIS
-- ============================================================

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nif text,
  morada text,
  telefone text,
  email text,
  moeda text default 'EUR',
  preferencias jsonb default '{"notificacoes": true, "temaEscuro": false}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  cargo text default 'Administrador',
  role text default 'Administrador' check (role in ('Administrador', 'Funcionário')),
  created_at timestamptz default now()
);

create index if not exists profiles_empresa_id_idx on public.profiles(empresa_id);

-- ============================================================
-- DADOS DE NEGÓCIO (IDs text para compatibilidade com localStorage)
-- ============================================================

create table if not exists public.obras (
  id text primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  cliente text not null,
  telefone text default '',
  morada text default '',
  valor_contratado numeric(12,2) default 0,
  data_inicio date,
  data_prevista_termino date,
  estado text not null,
  observacoes text default '',
  funcionarios text[] default '{}',
  historico_alteracoes jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists public.funcionarios (
  id text primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  telefone text default '',
  valor_diaria numeric(12,2) not null,
  data_entrada date not null,
  estado text not null,
  observacoes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists public.diarias (
  id text primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funcionario_id text not null references public.funcionarios(id) on delete restrict,
  obra_id text not null references public.obras(id) on delete restrict,
  data date not null,
  quantidade numeric(8,2) not null,
  valor_diaria numeric(12,2) not null,
  observacao text default '',
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists public.adiantamentos (
  id text primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funcionario_id text not null references public.funcionarios(id) on delete restrict,
  data date not null,
  valor numeric(12,2) not null,
  motivo text not null,
  observacao text default '',
  created_at timestamptz default now()
);

create table if not exists public.emprestimos (
  id text primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funcionario_id text not null references public.funcionarios(id) on delete restrict,
  valor numeric(12,2) not null,
  valor_pago numeric(12,2) default 0,
  data date not null,
  motivo text not null,
  forma_pagamento text default '',
  observacoes text default '',
  estado text not null,
  created_at timestamptz default now()
);

create table if not exists public.gastos (
  id text primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  descricao text not null,
  categoria text not null,
  valor numeric(12,2) not null,
  data date not null,
  obra_id text references public.obras(id) on delete set null,
  fornecedor text default '',
  observacao text default '',
  created_at timestamptz default now()
);

create table if not exists public.pagamentos (
  id text primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null,
  descricao text not null,
  valor numeric(12,2) not null,
  data date not null,
  obra_id text references public.obras(id) on delete set null,
  pessoa_relacionada text default '',
  metodo_pagamento text default '',
  observacao text default '',
  created_at timestamptz default now()
);

create index if not exists obras_empresa_id_idx on public.obras(empresa_id);
create index if not exists funcionarios_empresa_id_idx on public.funcionarios(empresa_id);
create index if not exists diarias_empresa_id_idx on public.diarias(empresa_id);
create index if not exists adiantamentos_empresa_id_idx on public.adiantamentos(empresa_id);
create index if not exists emprestimos_empresa_id_idx on public.emprestimos(empresa_id);
create index if not exists gastos_empresa_id_idx on public.gastos(empresa_id);
create index if not exists pagamentos_empresa_id_idx on public.pagamentos(empresa_id);

-- ============================================================
-- FUNÇÃO AUXILIAR
-- ============================================================

create or replace function public.get_user_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.profiles where id = auth.uid();
$$;
