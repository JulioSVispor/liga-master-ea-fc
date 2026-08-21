# Contribuindo

## Início

Requer Node.js compatível com Next.js 16. Copie as variáveis privadas para `.env.local` (nunca as versione), instale dependências com `npm ci` e execute `npm run dev`. Use `npm run lint` e `npm run build` antes de abrir PR.

## Fluxo

1. Leia `AGENTS.md`, o documento de domínio relevante em `docs/` e os arquivos relacionados.
2. Reutilize UI, hooks, actions e RPCs existentes; proponha refatoração quando a tela passar do limite aceitável.
3. Mantenha UI sem regra financeira. Para banco, crie migration pelo Supabase CLI, revise RLS e documente a mudança em `DATABASE.md`/`DECISIONS.md`.
4. Teste os fluxos afetados, lint e build. Inclua impacto em permissões, cache e responsividade no PR.

## Checklist de PR

- [ ] regra de negócio validada no servidor/banco quando crítica
- [ ] RLS, constraints e RPC revisadas
- [ ] sem segredos ou service role no cliente
- [ ] estados loading/erro/vazio e navegação por teclado considerados
- [ ] documentação atualizada e testes/validação reportados
