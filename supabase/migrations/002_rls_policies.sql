-- Emerson Pinturas — Row Level Security
-- Executar APÓS 001_schema.sql

alter table public.empresas enable row level security;
alter table public.profiles enable row level security;
alter table public.obras enable row level security;
alter table public.funcionarios enable row level security;
alter table public.diarias enable row level security;
alter table public.adiantamentos enable row level security;
alter table public.emprestimos enable row level security;
alter table public.gastos enable row level security;
alter table public.pagamentos enable row level security;

-- Profiles
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Empresas (acesso via profile)
create policy "empresas_select"
  on public.empresas for select
  using (id in (select empresa_id from public.profiles where id = auth.uid()));

create policy "empresas_insert"
  on public.empresas for insert
  with check (true);

create policy "empresas_update"
  on public.empresas for update
  using (id in (select empresa_id from public.profiles where id = auth.uid()));

-- Macro para tabelas de negócio
-- Obras
create policy "obras_all" on public.obras for all
  using (empresa_id = public.get_user_empresa_id())
  with check (empresa_id = public.get_user_empresa_id());

create policy "funcionarios_all" on public.funcionarios for all
  using (empresa_id = public.get_user_empresa_id())
  with check (empresa_id = public.get_user_empresa_id());

create policy "diarias_all" on public.diarias for all
  using (empresa_id = public.get_user_empresa_id())
  with check (empresa_id = public.get_user_empresa_id());

create policy "adiantamentos_all" on public.adiantamentos for all
  using (empresa_id = public.get_user_empresa_id())
  with check (empresa_id = public.get_user_empresa_id());

create policy "emprestimos_all" on public.emprestimos for all
  using (empresa_id = public.get_user_empresa_id())
  with check (empresa_id = public.get_user_empresa_id());

create policy "gastos_all" on public.gastos for all
  using (empresa_id = public.get_user_empresa_id())
  with check (empresa_id = public.get_user_empresa_id());

create policy "pagamentos_all" on public.pagamentos for all
  using (empresa_id = public.get_user_empresa_id())
  with check (empresa_id = public.get_user_empresa_id());
