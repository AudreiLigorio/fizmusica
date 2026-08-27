-- ============================================================
-- 054 — Personagem da carreira (masculino/feminino)
-- ============================================================
-- A spec pede "uma versão masculina e feminina de cada nível" e aponta que
-- este campo é NOVO: voiceType do wizard é a voz da MÚSICA, não a pessoa —
-- não dá pra reaproveitar.
--
-- Nulo até o cliente escolher, de propósito. Assumir um padrão erraria com
-- metade das pessoas logo na tela que deveria ser a mais divertida do app.
--
-- A spec levanta uma terceira opção neutra e deixa em aberto. Não entrou aqui
-- porque exigiria arte que não existe (as 10 em public/carreira/ são 5 M + 5 F).
-- Quando houver arte, é só ampliar o check.
alter table profiles
  add column if not exists personagem text
  check (personagem in ('m','f'));
