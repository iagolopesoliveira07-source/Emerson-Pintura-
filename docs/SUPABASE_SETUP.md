# Configuração do Supabase — Emerson Pinturas

## 1. Criar projeto no Supabase

1. Aceda a [https://supabase.com](https://supabase.com) e crie uma conta/projeto
2. Anote o **Project URL** e a **anon public key** (Settings → API)

## 2. Configurar variáveis de ambiente

Na raiz do projeto, crie o ficheiro `.env`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

**Nunca** coloque a `service_role key` no frontend.

Reinicie o servidor de desenvolvimento após criar o `.env`:

```bash
npm run dev
```

## 3. Executar migrations SQL

No Supabase Dashboard → **SQL Editor**, execute na ordem:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`

## 4. Criar utilizador de teste

1. Dashboard → **Authentication** → **Users** → **Add user**
2. Email + password
3. (Opcional) User Metadata:

```json
{
  "full_name": "Emerson",
  "role": "Administrador"
}
```

## 5. Configurar URLs de autenticação

Em **Authentication** → **URL Configuration**:

- **Site URL:** `http://localhost:5173` (dev) ou URL de produção
- **Redirect URLs:** incluir `http://localhost:5173/login`

## 6. Testar

1. Abrir a aplicação → deve aparecer o Login
2. Entrar com email/senha criados
3. Se existirem dados no localStorage, serão migrados automaticamente no primeiro login
4. Verificar dados em **Table Editor** no Supabase

## Migração automática

No **primeiro login** com Supabase configurado:

- Cria `empresa` + `profile` para o utilizador
- Se houver dados no localStorage e o Supabase estiver vazio, migra automaticamente
- Marca migração como concluída (`ep_migrated_to_supabase`)
- Limpa dados de negócio do localStorage (configurações locais mantidas como cache)

## Segurança

- Senhas geridas pelo Supabase Auth (hash no servidor)
- Row Level Security (RLS) activo em todas as tabelas
- Cada utilizador acede apenas dados da sua empresa

## Resolução de problemas

| Problema | Solução |
|----------|---------|
| "Autenticação não configurada" | Criar `.env` com as variáveis VITE_SUPABASE_* |
| Erro ao carregar dados | Verificar se SQL migrations foram executadas |
| Email ou senha incorretos | Confirmar utilizador no Dashboard Auth |
| Dados não migram | Verificar RLS e se tabelas existem |
