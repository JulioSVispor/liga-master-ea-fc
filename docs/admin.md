# Administração

O layout `/admin` valida sessão e papel `admin` ou `master` no servidor antes de renderizar. O menu cobre competições, janela, encerramento de temporada, usuários/clubes, convites, espera, arbitragem, importação, notícias, troféus, patrocínios, escudos, auditoria e configurações.

## Responsabilidades

- criar/organizar temporada, divisão, participantes e fixtures;
- liberar rodadas e resolver disputas/W.O.;
- importar a base de jogadores e manter o conteúdo editorial;
- controlar configurações e auditar intervenções financeiras.

O cliente não é autoridade. Operações de domínio usam RPC autorizada e transacional; CRUD administrativo simples usa Route Handler com `requireAdminUser`, validação fechada e service role apenas no servidor. Componentes não fazem mutação direta de tabelas.
