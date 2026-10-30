-- 078 — uso do Storage numa consulta só
--
-- A tela de Logs somava os buckets ANDANDO ARQUIVO POR ARQUIVO pela API do
-- Storage: uma chamada `list()` por pasta, recursiva. Medido em 30/10/2026:
-- 457 chamadas sequenciais, 133 SEGUNDOS. Como a página é `force-dynamic`,
-- isso rodava inteiro a cada clique — e estourava o tempo de função da
-- Vercel antes de renderizar. Da tela, parecia que o menu "Logs" não
-- funcionava.
--
-- O Supabase já guarda o tamanho de cada objeto em `storage.objects`
-- (`metadata->>'size'`). Somar lá é uma varredura só, no banco.
--
-- `security definer` porque o schema `storage` não é exposto ao PostgREST e
-- a role da aplicação não o alcança. `search_path` fixo e vazio, com os nomes
-- qualificados: função SECURITY DEFINER sem isso é porta de entrada para
-- sequestro de search_path (a varredura de RLS de 23/06 já cobriu as outras).
--
-- Só LÊ metadado de tamanho, agrupado por bucket. Não devolve nome de
-- arquivo, caminho nem dono — nada que identifique cliente.

create or replace function public.uso_do_storage()
returns table (bucket text, bytes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id::text,
         coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
    from storage.objects o
   where o.bucket_id in ('order-photos', 'product-images', 'songs')
   group by o.bucket_id
$$;

revoke all on function public.uso_do_storage() from public, anon, authenticated;
grant execute on function public.uso_do_storage() to service_role;
