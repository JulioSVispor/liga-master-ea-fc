# SQL histórico — não executável

Os scripts SQL avulsos presentes na raiz de `supabase/` antecedem o workflow versionado. Eles podem divergir da base remota e alguns recriam tabelas ou acumulam políticas permissivas. São somente material de investigação até serem consolidados e removidos em uma mudança revisada.

Nunca usar `schema.sql` ou `99_apply_all_updates.sql` como migration, seed ou rollback.
