# Design System

## Linguagem visual existente

Tema escuro compacto: fundo `#090d16`, cards azul-escuro, bordas de baixo contraste, primário esmeralda `#10b981`, secundário azul `#3b82f6` e alerta dourado `#f59e0b`. Tipografia declarada: Geist no layout e fallback `Outfit`, `Inter`, system no CSS. O espaçamento predominante usa escala Tailwind (`p-4`, `p-6`, `gap-4/6/8`) e raios `rounded-lg/xl/2xl`.

## Componentes base

| Componente | Uso |
|---|---|
| `Button` | variantes primária, secundária, destructive, ghost e outline |
| `Card` | `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` |
| `Badge` | default, success, warning, danger, info |
| `Modal` | overlay, cabeçalho e conteúdo rolável |

As telas também usam `glass-panel`, `glass-card` e `transition-smooth` de `globals.css`. Não há primitives dedicados de Input, Table, Drawer, Toast ou Skeleton: esses padrões estão duplicados em telas.

## Direção futura

A interface deve lembrar Football Manager, Transfermarkt, Sofascore, Linear, Vercel e Notion: densa, sóbria e orientada a decisão. Não introduzir cartas, gradientes chamativos ou microanimações que sugiram Ultimate Team. Ao repetir uma estrutura visual três vezes, extraia-a para `components/ui`.
