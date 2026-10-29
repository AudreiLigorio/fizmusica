-- Conserta a trava do débito de crédito.
--
-- A 071 tentava travar com `select sum(delta) ... for update`, e o Postgres
-- recusa: "FOR UPDATE is not allowed with aggregate functions". A função
-- estourava em TODA chamada — descoberto ao testar o comportamento, não ao
-- conferir que ela existia.
--
-- A trava agora é um advisory lock por usuário. Ele resolve dois casos que o
-- `for update` não resolveria nem se fosse aceito:
--
--   1. usuário SEM nenhuma linha ainda — não há o que travar, e duas
--      transações simultâneas passariam pela leitura juntas;
--   2. o `for update` trava as linhas existentes, mas não impede a INSERÇÃO
--      de uma nova por outra transação.
--
-- O advisory lock é por chave, não por linha: a segunda chamada do mesmo
-- usuário espera a primeira terminar, haja linha ou não. Ele é liberado
-- sozinho no fim da transação (`_xact_`), então não há risco de ficar preso.
create or replace function gastar_credito(
  p_user_id uuid,
  p_order_id text,
  p_quantidade integer default 1,
  p_descricao text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo integer;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'quantidade precisa ser positiva';
  end if;

  -- Serializa por usuário até o fim da transação.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select coalesce(sum(delta), 0) into v_saldo
    from credit_transactions
   where user_id = p_user_id;

  if v_saldo < p_quantidade then
    return false;
  end if;

  insert into credit_transactions (user_id, order_id, delta, origem, descricao)
  values (p_user_id, p_order_id, -p_quantidade, 'consumo', p_descricao);

  return true;
end;
$$;

revoke all on function gastar_credito(uuid, text, integer, text) from public, anon, authenticated;
