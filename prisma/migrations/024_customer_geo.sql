-- Geolocalização aproximada do cliente por IP (estimativa de estado, fins estatísticos).
alter table orders add column if not exists "customer_ip" text;
alter table orders add column if not exists "customer_state" text;
