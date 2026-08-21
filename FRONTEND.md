# Frontend

## Convenções atuais

Páginas em `src/app` encaminham para telas de `src/features` apenas em alguns domínios; muitas páginas administrativas ainda contêm toda a implementação. Os aliases `@/` apontam para `src`. Estilos usam Tailwind com cores hexadecimais e utilitários globais em `globals.css`.

`QueryProvider` existe com `staleTime` de cinco minutos, mas o dashboard principal também possui carregamento manual. Não foram encontrados `Suspense`, streaming, `dynamic()` ou lazy loading.

## Renderização e dados

- `layout.js` raiz é Server Component; layouts de admin/dashboard e quase todas as telas protegidas usam `"use client"`.
- Auth é obtida com `supabase.auth.getSession()` no browser; layouts redirecionam depois da montagem.
- React Query está configurado, mas só `useDashboardData` o utiliza claramente.
- Imagens remotas de EA, SoFIFA e Supabase são permitidas no `next.config.mjs`.

## Diretrizes

Use os componentes em `src/components/ui` antes de criar variantes locais. Prefira Server Components para leitura inicial, `Suspense` para limites de carregamento e React Query apenas para estado cliente que realmente precisa de cache/refetch. Páginas grandes em `dashboard/market`, `dashboard/matches`, `dashboard/standings` e `admin/leagues` devem ser divididas antes de ganhar novas responsabilidades.

## Acessibilidade e responsividade

Os layouts possuem navegação mobile; `Modal` define `role="dialog"` e `aria-modal`. Não há foco preso, restauração de foco ou estratégia comum de teclado documentada. Todo novo modal deve incluí-los e botões iconográficos devem ter `aria-label`.
