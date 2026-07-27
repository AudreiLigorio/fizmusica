-- Narração e música de fundo são duas faixas, não uma. Guardar as duas
-- separadas deixa o worker fazer a mixagem com ducking (a música abaixa
-- sozinha quando a voz entra) — mixar antes seria irreversível.
alter table video_jobs
  add column if not exists narration_url text;

comment on column video_jobs.narration_url is
  'Voz sintética (WAV). Quando presente, song_url passa a ser a música de FUNDO.';
