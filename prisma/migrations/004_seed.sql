-- FizMusica — Seed de dados iniciais (Fase 2)
-- Produtos + estrutura completa do Wizard
-- Rode no SQL Editor do Supabase após as migrations 001, 002 e 003

-- ============================================================
-- PRODUTOS
-- ============================================================

insert into products (id, name, description, price, featured, active, "sortOrder", "updatedAt") values
  ('prod-digital',  'Música Digital',   'Sua música personalizada em MP3 + letra + imagem exclusiva. Entregue via WhatsApp em até 3 dias úteis.', 97.00,  true,  true, 1, now()),
  ('prod-premium',  'Box Premium',      'Música digital + QR Code impresso + Carta manuscrita personalizada + Embalagem premium.',               197.00, false, true, 2, now()),
  ('prod-qrcode',   'QR Code Musical',  'Plaquinha com QR Code embutido que toca sua música ao ser escaneada. Perfeita para presentear.',        127.00, false, true, 3, now()),
  ('prod-spotify',  'Spotify Frame',    'Quadro estilo Spotify com a capa da sua música personalizada. Decoração + emoção.',                     147.00, false, true, 4, now())
on conflict (id) do nothing;

-- ============================================================
-- WIZARD — OCASIÕES
-- ============================================================

insert into wizard_occasions (id, label, emoji, slug, sort_order) values
  (gen_random_uuid(), 'Amor & Relacionamentos', '❤️', 'amor-relacionamentos', 1),
  (gen_random_uuid(), 'Família',                '👨‍👩‍👧', 'familia',              2),
  (gen_random_uuid(), 'Gravidez Revelação',     '👶', 'gravidez-revelacao',   3),
  (gen_random_uuid(), 'Outras Homenagens',      '🕊️', 'outras-homenagens',    4),
  (gen_random_uuid(), 'Pets',                   '🐶', 'pets',                 5)
on conflict (slug) do nothing;

-- ============================================================
-- WIZARD — SUBCATEGORIAS
-- ============================================================

insert into wizard_subcategories (id, occasion_id, label, emoji, slug, sort_order)
select gen_random_uuid(), o.id, s.label, s.emoji, s.slug, s.sort_order
from wizard_occasions o
join (values
  -- Amor & Relacionamentos
  ('amor-relacionamentos', 'Dia dos Namorados',          '💖', 'dia-dos-namorados',          1),
  ('amor-relacionamentos', 'Pedido em Namoro',           '💌', 'pedido-em-namoro',           2),
  ('amor-relacionamentos', 'Pedido em Casamento',        '💍', 'pedido-em-casamento',        3),
  ('amor-relacionamentos', 'Aniversário de Casamento',   '👰', 'aniversario-de-casamento',   4),
  ('amor-relacionamentos', 'Aniversário de Namoro',      '🎂', 'aniversario-de-namoro',      5),
  ('amor-relacionamentos', 'Reconciliação',              '🌹', 'reconciliacao',              6),
  ('amor-relacionamentos', 'Pedido de Desculpas',        '❤️', 'pedido-de-desculpas',        7),
  ('amor-relacionamentos', 'Surpresa Romântica',         '🌹', 'surpresa-romantica',         8),
  ('amor-relacionamentos', 'História de Superação Juntos','💞','historia-superacao-juntos',  9),
  ('amor-relacionamentos', 'Homenagem para um Amigo(a)', '🤝', 'homenagem-amigo',           10),
  -- Família
  ('familia', 'Homenagem para a Mãe',     '👩',  'homenagem-mae',     1),
  ('familia', 'Homenagem para o Pai',     '👨',  'homenagem-pai',     2),
  ('familia', 'Homenagem para o Filho(a)','👨',  'homenagem-filho',   3),
  ('familia', 'Homenagem para os Avós',   '👵',  'homenagem-avos',    4),
  -- Gravidez Revelação
  ('gravidez-revelacao', 'Revelando para o Marido', '🤰', 'revelando-marido',   1),
  ('gravidez-revelacao', 'Surpresa para a Mulher',  '🤰', 'surpresa-mulher',    2),
  ('gravidez-revelacao', 'Chá Revelação',           '👶', 'cha-revelacao',      3),
  ('gravidez-revelacao', 'Homenagem para a Família','🍼', 'homenagem-familia',  4),
  -- Outras Homenagens
  ('outras-homenagens', 'Saudade Especial',                '💖', 'saudade-especial',  1),
  ('outras-homenagens', 'De Força no Momento - Falecimento','🕊️','forca-falecimento', 2),
  -- Pets
  ('pets', 'Homenagem Pet', '🐶', 'homenagem-pet',  1),
  ('pets', 'Despedida Pet', '🌈', 'despedida-pet',  2)
) as s(occasion_slug, label, emoji, slug, sort_order)
  on o.slug = s.occasion_slug
on conflict (slug) do nothing;

-- ============================================================
-- WIZARD — PERGUNTAS
-- ============================================================

insert into wizard_questions (id, subcategory_id, label, sort_order)
select gen_random_uuid(), sc.id, q.label, q.sort_order
from wizard_subcategories sc
join (values
  -- Dia dos Namorados
  ('dia-dos-namorados', 'Quem vai receber essa música? ❤️', 1),
  ('dia-dos-namorados', 'Como vocês se conheceram?', 2),
  ('dia-dos-namorados', 'O que mais te faz lembrar essa pessoa?', 3),
  ('dia-dos-namorados', 'Qual foi o momento mais especial do relacionamento?', 4),
  ('dia-dos-namorados', 'O que você mais ama nessa pessoa?', 5),
  ('dia-dos-namorados', 'Existe alguma viagem, música ou memória marcante?', 6),
  ('dia-dos-namorados', 'Como essa pessoa mudou sua vida?', 7),
  ('dia-dos-namorados', 'Tem alguma frase ou apelido especial?', 8),
  -- Pedido em Namoro
  ('pedido-em-namoro', 'Quem será homenageado?', 1),
  ('pedido-em-namoro', 'Qual o apelido carinhoso?', 2),
  ('pedido-em-namoro', 'O que você gostaria que essa pessoa sentisse ouvindo essa música?', 3),
  ('pedido-em-namoro', 'O que torna essa pessoa tão especial?', 4),
  ('pedido-em-namoro', 'Qual foi o momento em que percebeu esse sentimento?', 5),
  ('pedido-em-namoro', 'Existe algo que nunca teve coragem de falar?', 6),
  ('pedido-em-namoro', 'Qual memória mais representa vocês?', 7),
  ('pedido-em-namoro', 'Tem alguma frase especial?', 8),
  ('pedido-em-namoro', 'Como essa pessoa mudou sua vida?', 9),
  ('pedido-em-namoro', 'O que você imagina para o futuro juntos?', 10),
  -- Pedido em Casamento
  ('pedido-em-casamento', 'Quem vai receber essa música? ❤️', 1),
  ('pedido-em-casamento', 'Tem algum apelido carinhoso que gostaria de destacar?', 2),
  ('pedido-em-casamento', 'Como essa história começou?', 3),
  ('pedido-em-casamento', 'Qual momento nunca saiu da sua memória?', 4),
  ('pedido-em-casamento', 'O que essa pessoa representa pra você?', 5),
  ('pedido-em-casamento', 'Se você fosse pedir em casamento agora, o que falaria?', 6),
  ('pedido-em-casamento', 'Existe alguma frase ou detalhe especial?', 7),
  ('pedido-em-casamento', 'Como você imagina esse momento acontecendo?', 8),
  -- Aniversário de Casamento
  ('aniversario-de-casamento', 'Para quem será essa homenagem?', 1),
  ('aniversario-de-casamento', 'São quantos anos de relacionamento?', 2),
  ('aniversario-de-casamento', 'Como vocês chegaram até esse momento?', 3),
  ('aniversario-de-casamento', 'Qual momento marcou a história de vocês?', 4),
  ('aniversario-de-casamento', 'O que você sentiu ao perceber que era amor verdadeiro?', 5),
  ('aniversario-de-casamento', 'O que essa pessoa representa na sua vida?', 6),
  ('aniversario-de-casamento', 'Como você imagina o futuro juntos?', 7),
  ('aniversario-de-casamento', 'Tem alguma promessa ou frase especial?', 8),
  ('aniversario-de-casamento', 'Qual lembrança nunca sai da sua cabeça?', 9),
  -- Aniversário de Namoro
  ('aniversario-de-namoro', 'Quem vai receber essa música?', 1),
  ('aniversario-de-namoro', 'Qual apelido carinhoso?', 2),
  ('aniversario-de-namoro', 'Há quanto tempo vocês estão juntos?', 3),
  ('aniversario-de-namoro', 'Qual momento mais marcou essa história?', 4),
  ('aniversario-de-namoro', 'O que mudou na sua vida desde que essa pessoa apareceu?', 5),
  ('aniversario-de-namoro', 'Qual foi a maior superação de vocês?', 6),
  ('aniversario-de-namoro', 'O que você mais admira nessa pessoa?', 7),
  ('aniversario-de-namoro', 'Tem alguma lembrança engraçada ou especial?', 8),
  ('aniversario-de-namoro', 'Como você descreveria esse amor?', 9),
  -- Reconciliação
  ('reconciliacao', 'Quem vai receber essa música?', 1),
  ('reconciliacao', 'O que aconteceu entre vocês?', 2),
  ('reconciliacao', 'O que fez você querer recomeçar?', 3),
  ('reconciliacao', 'O que essa pessoa significa pra você?', 4),
  ('reconciliacao', 'Existe algo que gostaria de dizer e nunca conseguiu?', 5),
  ('reconciliacao', 'Qual memória faz você acreditar nesse amor?', 6),
  ('reconciliacao', 'O que você espera daqui pra frente?', 7),
  ('reconciliacao', 'Tem alguma frase especial entre vocês?', 8),
  -- Pedido de Desculpas
  ('pedido-de-desculpas', 'Quem vai receber essa música?', 1),
  ('pedido-de-desculpas', 'Tem algum apelido carinhoso?', 2),
  ('pedido-de-desculpas', 'O que aconteceu entre vocês?', 3),
  ('pedido-de-desculpas', 'O que você gostaria de pedir desculpas?', 4),
  ('pedido-de-desculpas', 'O que essa pessoa representa pra você?', 5),
  ('pedido-de-desculpas', 'Qual memória faz você querer lutar por esse amor?', 6),
  ('pedido-de-desculpas', 'O que você aprendeu com tudo isso?', 7),
  ('pedido-de-desculpas', 'O que gostaria de reconstruir?', 8),
  ('pedido-de-desculpas', 'Existe alguma frase importante entre vocês?', 9),
  -- Surpresa Romântica
  ('surpresa-romantica', 'Quem será surpreendido?', 1),
  ('surpresa-romantica', 'Qual apelido carinhoso?', 2),
  ('surpresa-romantica', 'O que essa pessoa representa pra você?', 3),
  ('surpresa-romantica', 'Qual momento marcou a história de vocês?', 4),
  ('surpresa-romantica', 'O que você gostaria que ela sentisse ouvindo essa música?', 5),
  ('surpresa-romantica', 'Existe alguma viagem ou lembrança especial?', 6),
  ('surpresa-romantica', 'Tem algum detalhe único entre vocês?', 7),
  ('surpresa-romantica', 'Qual música lembra essa pessoa?', 8),
  ('surpresa-romantica', 'Como você descreveria esse amor?', 9),
  -- História de Superação Juntos
  ('historia-superacao-juntos', 'Quem vai receber essa música?', 1),
  ('historia-superacao-juntos', 'Tem algum apelido carinho que gostaria de chamar?', 2),
  ('historia-superacao-juntos', 'Qual foi a maior dificuldade enfrentada por vocês?', 3),
  ('historia-superacao-juntos', 'O que fez vocês continuarem juntos?', 4),
  ('historia-superacao-juntos', 'Qual momento mostrou a força desse amor?', 5),
  ('historia-superacao-juntos', 'O que essa pessoa representa na sua vida?', 6),
  ('historia-superacao-juntos', 'Como vocês mudaram juntos?', 7),
  ('historia-superacao-juntos', 'O que você mais admira nessa trajetória?', 8),
  ('historia-superacao-juntos', 'Existe alguma frase especial que resume tudo?', 9),
  -- Homenagem para um Amigo
  ('homenagem-amigo', 'Qual o nome?', 1),
  ('homenagem-amigo', 'Qual o apelido carinhoso?', 2),
  ('homenagem-amigo', 'Qual lembrança mais representa vocês?', 3),
  ('homenagem-amigo', 'O que fazia ele(a) tão especial?', 4),
  ('homenagem-amigo', 'Existe algum conselho inesquecível?', 5),
  ('homenagem-amigo', 'O que você mais admirava nele(a)?', 6),
  ('homenagem-amigo', 'Qual momento mais te emociona?', 7),
  ('homenagem-amigo', 'Existe alguma história engraçada?', 8),
  ('homenagem-amigo', 'O que gostaria de dizer através dessa música?', 9),
  -- Homenagem para a Mãe
  ('homenagem-mae', 'Qual o nome da sua mãe?', 1),
  ('homenagem-mae', 'Qual o apelido carinhoso?', 2),
  ('homenagem-mae', 'Como sua mãe impactou sua vida?', 3),
  ('homenagem-mae', 'Qual lembrança mais especial vocês viveram juntos?', 4),
  ('homenagem-mae', 'O que você mais admira nela?', 5),
  ('homenagem-mae', 'Existe algum ensinamento inesquecível?', 6),
  ('homenagem-mae', 'Qual momento te emociona quando lembra dela?', 7),
  ('homenagem-mae', 'Tem alguma frase especial?', 8),
  ('homenagem-mae', 'O que gostaria de agradecer?', 9),
  ('homenagem-mae', 'O que você gostaria que ela sentisse ouvindo essa música?', 10),
  -- Homenagem para o Pai
  ('homenagem-pai', 'Qual o nome do seu pai?', 1),
  ('homenagem-pai', 'Qual o apelido carinhoso?', 2),
  ('homenagem-pai', 'O que seu pai representa pra você?', 3),
  ('homenagem-pai', 'Qual foi o momento mais marcante entre vocês?', 4),
  ('homenagem-pai', 'Existe algum ensinamento que mudou sua vida?', 5),
  ('homenagem-pai', 'O que você mais admira nele?', 6),
  ('homenagem-pai', 'Tem alguma memória inesquecível?', 7),
  ('homenagem-pai', 'Existe alguma frase típica dele?', 8),
  ('homenagem-pai', 'O que gostaria de agradecer?', 9),
  -- Homenagem para o Filho(a)
  ('homenagem-filho', 'Qual o nome do seu filho(a)?', 1),
  ('homenagem-filho', 'Qual o apelido carinhoso?', 2),
  ('homenagem-filho', 'O que seu filho(a) representa pra você?', 3),
  ('homenagem-filho', 'Qual foi o momento mais marcante entre vocês?', 4),
  ('homenagem-filho', 'Existe algum ensinamento que mudou sua vida?', 5),
  ('homenagem-filho', 'O que você mais admira nele?', 6),
  ('homenagem-filho', 'Tem alguma memória inesquecível?', 7),
  ('homenagem-filho', 'Existe alguma frase típica dele?', 8),
  ('homenagem-filho', 'O que gostaria de agradecer?', 9),
  -- Homenagem para os Avós
  ('homenagem-avos', 'Qual(s) o(s) nome(s) do(s) homenageado(s)?', 1),
  ('homenagem-avos', 'Tem apelido(s) carinhoso(s)?', 2),
  ('homenagem-avos', 'Qual memória mais te emociona quando pensa nele(s)?', 3),
  ('homenagem-avos', 'O que faz esse momento tão especial?', 4),
  ('homenagem-avos', 'Existe alguma comida, cheiro ou momento inesquecível?', 5),
  ('homenagem-avos', 'O que você aprendeu com ele(s)?', 6),
  ('homenagem-avos', 'Qual foi o maior carinho recebido?', 7),
  ('homenagem-avos', 'Existe alguma frase que te lembra dele(a)?', 8),
  ('homenagem-avos', 'O que gostaria de eternizar nessa música?', 9),
  -- Revelando para o Marido
  ('revelando-marido', 'Qual o nome do marido?', 1),
  ('revelando-marido', 'Qual o apelido carinhoso dele?', 2),
  ('revelando-marido', 'Conta como foi quando descobriu a gravidez?', 3),
  ('revelando-marido', 'Qual foi a primeira reação?', 4),
  ('revelando-marido', 'O que esse bebê representa?', 5),
  ('revelando-marido', 'Qual foi o momento mais emocionante até agora?', 6),
  ('revelando-marido', 'Como você imagina essa nova fase?', 7),
  ('revelando-marido', 'O que gostaria de dizer para esse bebê?', 8),
  ('revelando-marido', 'Quais são os possíveis nomes?', 9),
  ('revelando-marido', 'Qual o sexo?', 10),
  ('revelando-marido', 'Qual mensagem final para o marido?', 11),
  -- Surpresa para a Mulher
  ('surpresa-mulher', 'Qual o nome dela?', 1),
  ('surpresa-mulher', 'Qual o apelido carinhoso gostaria de chamá-la?', 2),
  ('surpresa-mulher', 'Conta como foi quando descobriu que seria pai?', 3),
  ('surpresa-mulher', 'Qual foi sua primeira reação?', 4),
  ('surpresa-mulher', 'O que esse bebê representa?', 5),
  ('surpresa-mulher', 'O que ela representa pra você?', 6),
  ('surpresa-mulher', 'Qual foi o momento mais emocionante até agora?', 7),
  ('surpresa-mulher', 'Como você imagina essa nova fase?', 8),
  ('surpresa-mulher', 'O que gostaria de dizer para ela e esse bebê?', 9),
  -- Chá Revelação
  ('cha-revelacao', 'Qual o nome do papai?', 1),
  ('cha-revelacao', 'Qual o nome da mamãe?', 2),
  ('cha-revelacao', 'Qual o sobrenome da família?', 3),
  ('cha-revelacao', 'Conta a história de vocês?', 4),
  ('cha-revelacao', 'Como foi a revelação da gravidez?', 5),
  ('cha-revelacao', 'Como está sendo esse momento?', 6),
  ('cha-revelacao', 'O que esse bebê representa?', 7),
  ('cha-revelacao', 'Existe alguma expectativa especial?', 8),
  ('cha-revelacao', 'Como vocês imaginam o futuro da família?', 9),
  ('cha-revelacao', 'Qual sentimento gostariam de transmitir?', 10),
  ('cha-revelacao', 'Quais os possíveis nomes?', 11),
  ('cha-revelacao', 'Qual o sexo do bebê? O sexo deverá ser revelado só no final da música.', 12),
  -- Homenagem para a Família
  ('homenagem-familia', 'Como gostaria de chamar a família?', 1),
  ('homenagem-familia', 'Qual o nome do bebê?', 2),
  ('homenagem-familia', 'Qual o sexo do bebê?', 3),
  ('homenagem-familia', 'Resume a história desde quando se conheceram?', 4),
  ('homenagem-familia', 'Qual a sua mensagem principal neste momento tão especial?', 5),
  ('homenagem-familia', 'Qual emoção define esse momento?', 6),
  ('homenagem-familia', 'O que gostaria que essa música transmitisse?', 7),
  -- Saudade Especial
  ('saudade-especial', 'De quem é essa saudade?', 1),
  ('saudade-especial', 'O que mais faz falta dessa pessoa?', 2),
  ('saudade-especial', 'Qual memória mais te emociona?', 3),
  ('saudade-especial', 'Existe algum momento que nunca saiu da sua cabeça?', 4),
  ('saudade-especial', 'O que essa pessoa deixou em você?', 5),
  ('saudade-especial', 'Tem alguma música ou frase marcante?', 6),
  ('saudade-especial', 'Como você gostaria de homenagear essa história?', 7),
  ('saudade-especial', 'O que essa música precisa transmitir?', 8),
  -- De Força no Momento - Falecimento
  ('forca-falecimento', 'Qual o nome do familiar que receberá a homenagem?', 1),
  ('forca-falecimento', 'Qual o nome do falecido?', 2),
  ('forca-falecimento', 'O que essa pessoa representou na sua vida?', 3),
  ('forca-falecimento', 'Qual memória mais te emociona?', 4),
  ('forca-falecimento', 'Existe algum ensinamento inesquecível?', 5),
  ('forca-falecimento', 'Como você gostaria que ela(e) fosse lembrada?', 6),
  ('forca-falecimento', 'Existe alguma frase especial?', 7),
  ('forca-falecimento', 'Qual momento jamais sairá da sua memória?', 8),
  ('forca-falecimento', 'O que gostaria de eternizar nessa música?', 9),
  -- Homenagem Pet
  ('homenagem-pet', 'Qual o nome do seu pet?', 1),
  ('homenagem-pet', 'Qual o apelido carinhoso?', 2),
  ('homenagem-pet', 'Ele é cachorro, gato ou outro animal?', 3),
  ('homenagem-pet', 'Como ele entrou na sua vida?', 4),
  ('homenagem-pet', 'Qual momento mais marcou vocês?', 5),
  ('homenagem-pet', 'O que torna esse pet tão especial?', 6),
  ('homenagem-pet', 'Existe alguma mania engraçada?', 7),
  ('homenagem-pet', 'Qual lembrança nunca sai da sua cabeça?', 8),
  ('homenagem-pet', 'O que gostaria que essa música transmitisse?', 9),
  -- Despedida Pet
  ('despedida-pet', 'Qual o nome do seu pet?', 1),
  ('despedida-pet', 'Qual o apelido carinhoso?', 2),
  ('despedida-pet', 'Ele é cachorro, gato ou outro animal?', 3),
  ('despedida-pet', 'Como ele mudou sua vida?', 4),
  ('despedida-pet', 'Qual lembrança mais te emociona?', 5),
  ('despedida-pet', 'O que tornava ele único?', 6),
  ('despedida-pet', 'Existe alguma mania inesquecível?', 7),
  ('despedida-pet', 'Como você gostaria de homenagear essa história?', 8),
  ('despedida-pet', 'O que ele representava pra você?', 9),
  ('despedida-pet', 'O que essa música precisa transmitir?', 10)
) as q(subcategory_slug, label, sort_order)
  on sc.slug = q.subcategory_slug;
