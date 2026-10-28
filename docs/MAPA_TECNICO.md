# Mapa técnico — Emerson Pinturas

Documento interno para localizar código. **Não descreve alterações de produto.** O site continua a usar os mesmos ecrãs, as mesmas chaves de `localStorage` e as mesmas funções de cálculo.

Última actualização: organização interna apenas (sem mudança de comportamento).

---

## Arranque

| Ficheiro | Papel |
|---|---|
| `src/main.jsx` | React root + `global.css` |
| `src/App.jsx` | Rotas |
| `src/context/AuthContext.jsx` | Login / senha local |
| `src/context/AppContext.jsx` | Estado da empresa (obras, diárias, gastos, pagamentos, etc.) |
| `src/components/Layout/Layout.jsx` | Sidebar, cabeçalho, Error Boundary |
| `src/services/storageService.js` | Leitura/escrita `localStorage` (`ep_*`) |

Os dados reais ficam no browser, nas chaves `ep_obras`, `ep_funcionarios`, `ep_diarias`, `ep_gastos`, `ep_pagamentos`, e restantes em `STORAGE_KEYS`. **Não migrar estas chaves sem tarefa específica.**

---

## Rotas (o que o utilizador abre)

| URL | Página | Pasta |
|---|---|---|
| `/` | Dashboard | `src/pages/Dashboard/` |
| `/obras` | Lista de obras | `src/pages/Obras/Obras.jsx` |
| `/obras/:id` | Detalhes da obra | `src/pages/Obras/ObraDetalhes.jsx` |
| `/funcionarios` | Lista | `src/pages/Funcionarios/` |
| `/funcionarios/:id` | Detalhe | `src/pages/Funcionarios/FuncionarioDetalhes.jsx` |
| `/diarias` | Diárias | `src/pages/Diarias/` |
| `/gastos` | Gastos | `src/pages/Gastos/` |
| `/gastos-empresa` | Despesas da empresa | `src/pages/GastosEmpresa/` |
| `/iva` | IVA | `src/pages/Iva/` |
| `/pagamentos` | Pagamentos | `src/pages/Pagamentos/` |
| `/devedores` | Devedores | `src/pages/Devedores/` |
| `/lucros` | Lucros | `src/pages/Lucros/` |
| `/relatorios` | Relatórios | `src/pages/Relatorios/` |
| `/configuracoes` | Configurações | `src/pages/Configuracoes/` |
| `/login` | Login | `src/pages/Login/` |
| `/comprovativo` | Comprovativo público | `src/pages/ComprovativoPublico/` |

`/adiantamentos` e `/emprestimos` redireccionam para `/funcionarios`.

---

## Onde está cada domínio

### Obras (todas)

- Lista / formulário: `src/pages/Obras/`, `src/components/ObraForm/`
- Detalhe (secções no ecrã): `src/components/ObraDetalhes/`
- Tipo (normal, parceria, crédito, Tavira): `src/utils/obraTipo.js`, `src/utils/obraSpecial.js`
- Estado da obra: `src/utils/obraStatus.js`
- Formulário (payload): `src/utils/obraForm.js`

### Obras em parceria (zona crítica)

Estas obras acabaram de ser recuperadas. **Não mover nem fundir estes ficheiros sem tarefa própria.**

| O quê | Ficheiro |
|---|---|
| Ecrã de detalhes | `src/pages/Obras/ObraDetalhes.jsx` — monta `ObraParceriaSection` se `tipoObra === parceria` |
| Painel resumo / acerto entre sócios / repasse | `src/components/ObraDetalhes/ObraParceriaSection.jsx` |
| Gastos / compras (colunas Emerson / sócios) | `src/components/ObraDetalhes/ObraGastosSection.jsx` |
| Diárias na obra | `src/components/ObraDetalhes/ObraDiariasSection.jsx` |
| Motor de parceria (percentagens, resumo, pagador) | `src/utils/obraPartnership.js` |
| Reexportação para o resto da app | `src/utils/obraSpecial.js` |
| Motor de acertos/caixa (ficheiro existente; **não está nas rotas** neste momento) | `src/utils/obraParceriaAcertos.js`, `src/pages/Obras/ObraAcertoParceria.jsx` |

Compatibilidade: `normalizePartnership` / `isPartnershipObra` em `obraPartnership.js` devem continuar a aceitar obras antigas sem campos novos de acerto/caixa.

### Funcionários, diárias, pagamentos, descontos

- Páginas: `src/pages/Funcionarios/`, `src/pages/Diarias/`
- Secções do detalhe: `src/components/FuncionarioDetalhes/`
- Cálculos de fechamento / compromissos: `src/utils/fechamentoPagamentoCalculations.js`, `src/utils/commitmentCalculations.js`, `src/utils/acertoCalculations.js`
- Alocação de diária a obras: `src/utils/diariaObraAlocacao.js`
- Tipo parceiro vs funcionário: `src/utils/funcionarioTipo.js`

### Gastos, fornecedores, IVA, empresa

- Gastos de obra: `src/pages/Gastos/`, `src/components/GastoForm/`, `src/utils/gastoForm.js`
- Empresa / veículos / fornecedores / IVA: `src/pages/GastosEmpresa/`, `src/pages/Iva/`, `src/utils/empresaIvaRules.js`, `src/utils/empresaFornecedores.js`, `src/utils/gastoEmersonIva.js`

### Relatórios e PDFs

- Ecrã: `src/pages/Relatorios/`
- PDFs de obra: `src/utils/gerarRelatorioObraPdf.js` (pode delegar parceria)
- PDF parceria: `src/utils/gerarRelatorioObraParceriaPdf.js`
- PDF acerto (código existente, não ligado às rotas agora): `src/utils/gerarRelatorioAcertoParceriaPdf.js`

### Cálculos gerais

- Agregados de obra / histórico / lucros: `src/utils/calculations.js`
- Formatação: `src/utils/formatters.js`
- Colecções seguras: `src/utils/safeCollections.js`

---

## Fluxo de uma obra em parceria (abrir detalhes)

1. `AppContext` lê `ep_obras` (e restantes chaves). Não deve reescrever acertos no arranque.
2. `ObraDetalhes` obtém a obra por id.
3. `getTipoObra` (`obraSpecial.js`) decide se é parceria.
4. Secções comuns (info, diárias, gastos, histórico) + `ObraParceriaSection`.
5. Resumo financeiro: `calcPartnershipSummary` em `obraPartnership.js` (falhas de cálculo não devem apagar dados).

---

## O que **não** foi reorganizado de propósito

Estas mudanças exigiriam mexer em muitos imports ou em caminhos de cálculo/persistência. Ficam para tarefas futuras, uma de cada vez:

- Dividir `AppContext.jsx` (é grande, mas é a única fonte de estado).
- Separar `obraSpecial.js` vs `obraPartnership.js` (já há reexportações; mover nomes quebra imports).
- Voltar a ligar rotas `/obras/:id/acerto` (código existe; não foi reactivado aqui).
- Unificar PDFs ou CSS.
- Renomear pastas `components/` / `utils/`.
- Qualquer “padronização” de dados antigos.

---

## Regra para o próximo trabalho

Se a tarefa for **corrigir regras** (Acerto, caixa, valores Braga 4): tratar como tarefa à parte, sem reorganização geral no mesmo passo.

Se a tarefa for **organizar código**: não tocar em `obraPartnership.js`, `ObraParceriaSection.jsx`, `ObraGastosSection.jsx` nem `AppContext` de persistência no mesmo PR.
