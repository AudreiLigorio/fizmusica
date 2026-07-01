-- Guarda o e-mail informado no checkout do Mercado Pago (pagador) quando ele difere
-- do e-mail do pedido (wizard). Serve de rede de segurança: o e-mail de acesso
-- ("aprove sua letra") passa a ser enviado também para este endereço.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer_email text;
