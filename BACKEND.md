# Backend

## Interfaces

| Interface | Uso |
|---|---|
| Route Handlers | `api/ea/import`, `api/sofifa/sync`, `api/sofifa/sync-team`, validação/consumo de e-mail permitido |
| Server Actions | `applyWalkover`, `toggleShortlist`, `getShortlistedPlayerIds` |
| RPC PostgreSQL | transferências, leilão, partidas, empréstimos, reset e financeiro |
| Cliente Supabase | consultas e mutações diretas de telas cliente |

## Auth e autorização

Supabase Auth cria `profiles` via trigger. Os layouts verificam sessão e papel `admin`/`master` no browser. As políticas RLS e RPCs são a camada que precisa garantir autorização no servidor. `createServerClient()` em `src/lib/supabase/server.js` usa service role e é usado pelas rotas de whitelist; Actions usam `@supabase/ssr` com cookies e chave anônima.

## Validação e erros

As rotas validam parâmetros essenciais e retornam JSON. Não há schema validation compartilhada nem formato de erro unificado. Tabelas e RPCs devem ser a fonte de validação final para regras críticas.

## Pontos que exigem correção antes de exposição pública

- As rotas de importação usam chave anônima para `upsert` em `players`; seu acesso depende de uma policy permissiva.
- As rotas de SoFIFA contêm uma credencial de fornecedor no código. Mova-a para variável privada e rotacione-a.
- A importação e sync são `GET` sem uma verificação de administrador observável. Proteja-as no servidor.
- Nem toda RPC `SECURITY DEFINER` vista nos scripts valida `auth.uid()`; trate parâmetros de time como não confiáveis.
