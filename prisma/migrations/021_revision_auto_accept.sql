-- Parametriza a aceitação da SOLICITAÇÃO de revisão do cliente (separado do modo
-- de produção da música, que já existe em composer_settings.suno_mode).
-- Automático: assim que o cliente pede revisão, o pedido já é duplicado/aceito
-- (a criação da música segue o modo de produção configurado). Manual (default,
-- comportamento atual): o admin recebe o alerta e decide quando aceitar.
ALTER TABLE composer_settings ADD COLUMN IF NOT EXISTS revision_auto_accept boolean NOT NULL DEFAULT false;
