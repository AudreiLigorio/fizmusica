-- ============================================================
-- MIGRATION 068 — Funções SECURITY DEFINER só para o servidor
-- ============================================================
--
-- Mesmo furo fechado na 067 para as palmas: estas funções rodam com os
-- privilégios do dono (SECURITY DEFINER) e estavam executáveis por `anon` e
-- `authenticated` — ou seja, por qualquer pessoa com a chave pública do site
-- (que fica no navegador), chamando a RPC direto no Supabase, sem passar
-- pelas rotas /api e suas travas.
--
--   registrar_play     — a mais séria: registrava reprodução pra QUALQUER
--                        pedido (inclusive privado ou fora da Rede) e
--                        inflava o Top 10, pulando a trava "na Rede" de
--                        app/api/musicas/play.
--   contagem_plays     — devolviam a lista de TODOS os pedidos com
--   contagem_aplausos    reproduções/palmas, inclusive os privados.
--   destaque_aplauso   — ranking da Rede; leitura, mas não há por que expor.
--
-- Consumidores conferidos (2026-10-10): só rotas do servidor com o client
-- de service role (app/api/musicas/play, app/api/catalog,
-- app/api/minhas-musicas/desempenho). Nenhuma chamada do navegador.

revoke all on function public.registrar_play(text, text) from public, anon, authenticated;
revoke all on function public.contagem_plays() from public, anon, authenticated;
revoke all on function public.contagem_aplausos() from public, anon, authenticated;
revoke all on function public.destaque_aplauso(integer, integer) from public, anon, authenticated;

grant execute on function public.registrar_play(text, text) to service_role;
grant execute on function public.contagem_plays() to service_role;
grant execute on function public.contagem_aplausos() to service_role;
grant execute on function public.destaque_aplauso(integer, integer) to service_role;
