# Emerson Pinturas — Sistema de Gestão

Aplicação web de gestão para empresa de pinturas e obras.

## Tecnologias

- **React** + **Vite** — interface e build
- **React Router** — navegação entre páginas
- **Recharts** — gráficos no dashboard e relatórios
- **Lucide React** — ícones
- **localStorage** — persistência temporária (preparado para API futura)

## Como executar

```bash
npm install
npm run dev
```

Abrir [http://localhost:5173](http://localhost:5173)

## Estrutura

Mapa interno do código (pastas, rotas, parceria, persistência): [`docs/MAPA_TECNICO.md`](docs/MAPA_TECNICO.md).

```
src/
  components/   # Componentes reutilizáveis (Layout, Card, Modal, etc.)
  pages/        # Páginas da aplicação
  context/      # Estado global (AppContext)
  services/     # Camada de persistência (storageService)
  data/         # Dados mock iniciais
  utils/        # Formatação, validação, cálculos
  styles/       # Estilos globais
```

## Funcionalidades

- Dashboard com resumo financeiro e acções rápidas
- Gestão de obras, funcionários, diárias, adiantamentos, empréstimos, gastos e pagamentos
- Páginas de detalhe para obras e funcionários
- Relatórios com filtros e gráficos
- Configurações da empresa
- Interface em português de Portugal (€)
- Layout responsivo (desktop, tablet, mobile)

## Migrar para backend

Substituir as funções em `src/services/storageService.js` por chamadas API. O `AppContext` centraliza toda a lógica de estado — basta trocar os métodos `add*` e `update*` por fetch/axios.
