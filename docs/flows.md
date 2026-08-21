# Fluxos principais

## Contratação de agente livre

```mermaid
flowchart TD
 A["Treinador escolhe jogador livre"] --> B["RPC buy_free_agent"]
 B --> C{"Temporada ativa?"}
 C -- não --> X["Retorna erro"]
 C -- sim --> D{"Jogador livre, saldo e folha válidos?"}
 D -- não --> X
 D -- sim --> E["Debita budget e atribui players.team_id"]
 E --> F["Retorna sucesso"]
```

## Confirmação de partida

```mermaid
sequenceDiagram
  participant A as Admin/arbitragem
  participant R as RPC confirm_match
  participant M as matches
  participant L as league_teams
  participant S as suspensions
  A->>R: p_match_id
  R->>M: lê e evita duplicidade
  R->>M: status = confirmed
  R->>L: atualiza tabela se competição é liga
  R->>S: cria suspensão para vermelho/3 amarelos
  R-->>A: JSON de sucesso/erro
```

## Cadastro por convite

1. Registro consulta `api/auth/validate-email`.
2. A rota com service role procura e-mail normalizado em `allowed_emails` e rejeita ausente/usado.
3. Após uso, `api/auth/mark-email-used` marca o convite. O trigger de Auth cria o perfil.

## Importação

Admin inicia a tela de importação, que chama rotas EA/SoFIFA. Elas mapeiam campos para `players` e fazem `upsert`. É um fluxo administrativo pretendido, mas a autorização server-side não está comprovada — ver [BACKEND.md](../BACKEND.md).
