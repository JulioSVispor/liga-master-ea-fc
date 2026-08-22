---
version: 1.0.0
name: "Liga Master"
description: "Um caderno técnico de competição: sóbrio, rápido e orientado à próxima decisão do treinador ou administrador."
colors:
  background: "#090D16"
  surface: "#111827"
  surface-raised: "#1F2937"
  border: "#273244"
  text: "#F3F4F6"
  text-muted: "#9CA3AF"
  primary: "#10B981"
  primary-hover: "#059669"
  info: "#3B82F6"
  warning: "#F59E0B"
  danger: "#EF4444"
typography:
  sans:
    fontFamily: "var(--font-geist-sans), Arial, sans-serif"
  mono:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
rounded:
  DEFAULT: "0.5rem"
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
spacing:
  control-height: "2.5rem"
  section-gap: "2rem"
  page-max: "90rem"
components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
  dialog:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
  table:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
  toast:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.background}"
  button-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.background}"
  focus-ring:
    backgroundColor: "{colors.info}"
    textColor: "{colors.background}"
  warning-toast:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.background}"
  border-rule:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text}"
---

# Liga Master Design System

## Overview

### Creative North Star

Uma súmula de jogo bem impressa sobre a mesa de um diretor de futebol: hierarquia editorial, números alinhados, divisórias precisas e uma única marca de ação em verde. A expressão aparece no “docket” de rodada e nos registros de mercado; fluxos rotineiros permanecem silenciosos.

### Product context and register

- **Audience and primary job:** adultos de 25 a 45 anos que organizam comunidades de EA FC em sessões curtas; precisam identificar a próxima obrigação, decidir e sair.
- **Target market and evidence:** comunidades brasileiras, conforme [PRODUCT.md](./PRODUCT.md), `AGENTS.md` e o domínio versionado em `docs/`.
- **Locale and language policy:** `pt-BR`; nomes próprios são preservados; texto de produto passa por revisão de um mantenedor nativo.
- **Usage scene:** desktop e celular, poucos minutos por acesso, alta urgência em rodada/mercado e densidade moderada.
- **Register:** híbrido. A landing é institucional; `/dashboard` e `/admin` são produto operacional.
- **Memorable signature:** cabeçalho de rodada em formato de súmula técnica, com monoespaçada apenas para placares, valores e IDs curtos.
- **Restraint:** formulários, tabelas, permissões e confirmações usam padrões familiares sem decoração competitiva.
- **Anti-references:** Ultimate Team, jogos mobile, neon, cartas colecionáveis, glassmorphism expressivo, ERP e painel governamental.
- **Token ownership/runtime mapping:** o runtime em [globals.css](./src/app/globals.css) e `tailwind.config.js` é canônico; este arquivo espelha decisões aceitas. `npm run lint` e a auditoria premium são o gate de drift.

## Colors

O produto é dark-first. `background` sustenta a página, `surface` e `surface-raised` criam apenas dois níveis. `primary` identifica ação principal e sucesso; não colore grandes áreas. `info`, `warning` e `danger` são semânticos. Texto normal deve atingir AA; foco visível usa anel `info` de 2 px com offset. Seleção e gráficos nunca dependem somente da cor.

## Typography

Geist Sans é a família efetiva e suporta o conteúdo latino da aplicação. Pesos 400, 500, 600 e 700; corpo 14–16 px com altura de linha mínima 1.45. Geist Mono é restrita a placares, valores tabulares, timestamps e identificadores. Títulos usam sentence case; caixa alta fica limitada a rótulos curtos de seção com espaçamento de letras.

## Layout

Conteúdo autenticado tem largura máxima de 90 rem e ritmo vertical de 2 rem. A sidebar é persistente em `lg`; abaixo disso vira navegação horizontal compacta e, na evolução, drawer. Controles têm 40 px de altura mínima. Tabelas mantêm cabeçalho/colunas estáveis; no celular priorizam colunas essenciais e oferecem detalhe por linha. Skeletons reservam a geometria final e imagens sempre declaram dimensões.

## Elevation & Depth

Hierarquia vem de tom e borda, não de blur. Cards rotineiros não se movem no hover. Sombra é reservada a dialogs, drawers e menus. Sticky header/banner usa fundo opaco. Elevação é proibida em células de tabela, badges e agrupamentos internos.

## Shapes

Raios de 6–12 px, sem pílulas em containers. Pílulas ficam restritas a status curtos. Ícones usam caixa quadrada; divisores têm 1 px. O placar pode usar cantos de 6 px para lembrar uma etiqueta de súmula.

## Components

### Foundational visual states

Todo componente cobre default, hover, `focus-visible`, pressed, selected, disabled, read-only, busy e erro. Busy preserva largura e combina spinner pequeno com rótulo. O loading padrão é spinner somente para espera curta; listas usam skeleton. `prefers-reduced-motion` remove translação e animação não essencial.

### Buttons and actions

Um único botão primário por região. `primary`, `secondary`, `ghost` e `outline` definem ênfase; `danger` define intenção. `type="button"` é padrão, submit deve ser explícito. Ícone acompanha texto salvo em controles universalmente reconhecíveis com `aria-label`. Destrutivas ficam separadas e exigem confirmação proporcional.

### Navigation and data display

Rota ativa usa contraste, borda e `aria-current`, não emoji. Tabs preservam URL quando representam estado compartilhável. Tabelas têm paginação, ordenação explícita e números alinhados à direita. Badge representa estado, nunca ação.

### Forms and overlays

Campo contém label persistente, ajuda opcional e erro associado por `aria-describedby`. Select nativo é aceito temporariamente; o authored select canônico deve implementar teclado completo. Dialog usa foco inicial seguro, trap de foco, Escape, retorno ao gatilho e título acessível. Toast não substitui erro inline.

### Iconography

Ícones funcionais devem migrar para uma única família SVG de traço 1.75 px, em 16/20/24 px. Emoji não é ícone funcional. Ações ambíguas mantêm texto.

### Motion

Feedback: 120–160 ms; conteúdo/overlay: 180–240 ms; easing `cubic-bezier(0.2, 0, 0, 1)`. Movimento comunica mudança de estado e pode ser interrompido. Não há hover scale em ações operacionais.

### Content and data visualization

Voz direta: “Confirmar resultado”, “Abrir disputa”, “Anunciar jogador”. Moeda usa `Intl.NumberFormat('pt-BR', { currency: 'BRL' })`; datas usam `pt-BR` e timezone `America/Sao_Paulo`. Gráficos sempre incluem tabela/descrição equivalente.

## Do's and Don'ts

- **Do:** mostrar primeiro a próxima ação ou exceção relevante.
- **Do:** reutilizar os componentes em `src/components/ui` e os tokens do runtime.
- **Don't:** usar cartas coloridas, brilhos, gradientes decorativos ou animações arcade.
- **Don't:** esconder foco, truncar sem acesso ao valor completo ou comunicar estado apenas por cor/emoji.
