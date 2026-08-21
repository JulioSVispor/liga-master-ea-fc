# Administração

O layout `/admin` só exibe o painel após sessão e papel `admin` ou `master` no cliente. O menu cobre competições, janela, encerramento de temporada, usuários/clubes, convites, espera, arbitragem, importação, notícias, troféus, patrocínios, escudos, auditoria e configurações.

## Responsabilidades

- criar/organizar temporada, divisão, participantes e fixtures;
- liberar rodadas e resolver disputas/W.O.;
- importar a base de jogadores e manter o conteúdo editorial;
- controlar configurações e auditar intervenções financeiras.

Autorização client-side melhora UX, mas não é controle suficiente. Toda ação administrativa precisa de RLS/RPC/route handler que valide o papel no servidor.
