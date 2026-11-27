# Liga Master EA FC

Plataforma para organizar campeonatos reais de EA FC: clubes, treinadores, mercado, partidas, classificação, financeiro, temporadas e histórico.

O projeto usa Next.js 16 (App Router), React 19, JavaScript, Supabase Auth/PostgreSQL/Storage e RPCs transacionais para operações críticas.

## Desenvolvimento

Requisitos:

- Node.js compatível com o Next.js 16;
- Docker Desktop ou Podman para o Supabase local;
- variáveis de ambiente em `.env.local`, sem chaves versionadas.

```bash
npm install
npm run dev
```

A aplicação inicia em modo somente leitura por padrão. Para habilitar mutações em um ambiente seguro e já migrado, configure `NEXT_PUBLIC_READ_ONLY_MODE=false`.

## Verificação

```bash
npm run lint
npm test
npm run test:e2e
npm run audit:migrations
npm run audit:premium
npm run lint:design
npm run build
```

O CI executa os testes autenticados em desktop e mobile com um simulador local. Para executar a mesma suíte, defina `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder` e `SUPABASE_SERVICE_ROLE_KEY=ci-placeholder` no ambiente do build e dos testes. Execute `npm run build`, instale o Chromium com `npx playwright install chromium` e rode `npm run test:e2e` com `E2E_AUTH_FIXTURE=true`. Deixe livres as portas 3000 e 54321.

Os testes de banco exigem o Supabase local em execução:

```bash
npx supabase start
npm run test:db
```

## Banco e rollout

As migrations executáveis ficam exclusivamente em `supabase/migrations`. Scripts antigos estão em `supabase/legacy/historical` e não devem ser aplicados.

Nunca execute `supabase/schema.sql`, `supabase/security_hardening.sql` ou agregadores históricos em produção. O procedimento obrigatório de backup, contenção, validação e reativação gradual está em [docs/recovery-rollout.md](docs/recovery-rollout.md).

## Documentação

- [PRODUCT.md](PRODUCT.md): produto e público-alvo;
- [ARCHITECTURE.md](ARCHITECTURE.md): arquitetura;
- [DATABASE.md](DATABASE.md): modelo de dados;
- [DESIGN.md](DESIGN.md): sistema visual;
- [UX-CONTRACT.md](UX-CONTRACT.md): contratos de interação;
- [DECISIONS.md](DECISIONS.md): decisões arquiteturais;
- [ROADMAP.md](ROADMAP.md): prioridades e dívida técnica.
