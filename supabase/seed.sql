-- Seed local mínimo. Não contém dados pessoais nem tenta reproduzir produção.
insert into public.settings (key, value)
values
  ('default_budget', '50000000'),
  ('default_wage_cap', '15000'),
  ('market_status', 'closed')
on conflict (key) do nothing;
