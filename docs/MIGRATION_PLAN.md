# Plano de migração: localStorage → Supabase

## Estado actual

| Componente | Estado |
|------------|--------|
| Autenticação Supabase | ✅ Implementada |
| Schema SQL + RLS | ✅ Pronto (`supabase/migrations/`) |
| Serviços de dados Supabase | ✅ Implementados |
| Migração automática no login | ✅ Implementada |
| Fallback localStorage | ✅ Mantido quando Supabase não configurado |

## Dados no localStorage

| Chave | Conteúdo | Após migração |
|-------|----------|---------------|
| `ep_obras` | Obras | Migrado → limpo |
| `ep_funcionarios` | Funcionários | Migrado → limpo |
| `ep_diarias` | Diárias | Migrado → limpo |
| `ep_adiantamentos` | Adiantamentos | Migrado → limpo |
| `ep_emprestimos` | Empréstimos | Migrado → limpo |
| `ep_gastos` | Gastos | Migrado → limpo |
| `ep_pagamentos` | Pagamentos | Migrado → limpo |
| `ep_configuracoes` | Configurações | Cache local mantido |
| `ep_initialized` | Flag init | Mantido |
| `ep_migrated_to_supabase` | Flag migração | Definido após migração |

## Fase 2 — Concluída

- [x] Schema `empresas` + `profiles`
- [x] Tabelas de negócio com `empresa_id`
- [x] RLS em todas as tabelas
- [x] Bootstrap de perfil no primeiro login
- [x] Sync de configurações com Supabase

## Fase 3 — Concluída

- [x] Leitura/escrita Supabase para todos os módulos
- [x] Migração one-time do localStorage
- [x] Fallback localStorage sem Supabase configurado

## Fase 4 — Parcial

- [x] "Zerar dados" apaga no Supabase quando `dataSource === 'supabase'`
- [ ] Restringir zerar dados apenas a Administradores (futuro)

## Próximos passos opcionais

1. Remover fallback localStorage quando todos os utilizadores estiverem no Supabase
2. Implementar perfis de permissão (Funcionário vs Administrador)
3. Sincronização offline / cache avançado
4. Convites de utilizadores para mesma empresa

## Instruções de setup

Ver `docs/SUPABASE_SETUP.md`
