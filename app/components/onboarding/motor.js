/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars */
// Motor do onboarding do app Android — a lógica do protótipo aprovado
// (claude.ai/artifact/4o9jeJi4iLUpxSAZsTep3v), sem mudanças de comportamento.
// Fica em JS puro, isolado: o componente React (OnboardingApp.tsx) só monta a
// marcação, chama `iniciarOnboarding` e recebe o destino final em `aoFechar`.
//
// opcoes: { artes: string[5] (personagem por nível), aoFechar(destino),
//           track(evento, detalhe) }   destino: "criar" | "spotfiz" | "pular"
export function iniciarOnboarding(raiz, opcoes) {
  const NIVEIS = [
    { nome: "Cantor de Chuveiro", min: 0, desc: 0, arte: opcoes.artes[0] },
    { nome: "Cantor da Família", min: 3, desc: 10, arte: opcoes.artes[1] },
    { nome: "Cantor de Eventos", min: 6, desc: 15, arte: opcoes.artes[2] },
    { nome: "Cantor de Shows", min: 10, desc: 20, arte: opcoes.artes[3] },
    { nome: "Popstar", min: 20, desc: 25, arte: opcoes.artes[4] },
  ];
  // Um caminho só, orientativo. Os dois jeitos de criar ficam numa chave
  // dentro da tela "Como funciona" — ninguém precisa escolher antes de entender.
  const TELAS = ["boas", "como", "recebe", "rede"];
  // Os estilos tocam trechos REAIS de músicas do SpotFiz (pedidos de
  // demonstração do Audrei, dados fictícios — publicados por ele). Trechos
  // curtos em public/onboarding/, sem depender de login nem da rota de áudio.
  const ESTILOS = {
    "K-Pop": { emoji: "🇰🇷", audio: "/onboarding/talento.mp3", capa: "/onboarding/capa-talento.jpg", musica: "Meu Melhor Talento" },
    Pop: { emoji: "💖", audio: "/onboarding/estrela.mp3", capa: "/onboarding/capa-estrela.jpg", musica: "Estrela da Praia Brava" },
    Sertanejo: { emoji: "🎤", audio: "/onboarding/doce.mp3", capa: "/onboarding/capa-doce.jpg", musica: "A Mais Doce Espera" },
  };
  // Refrão real de "Meu Melhor Talento" (pedido de namoro da Pamela). Os
  // tempos (s) são do trecho talento.mp3 (64,2 s → 77,6 s da música).
  const LETRA_PLAYER = [
    { t: 0.26, l: "O meu porto seguro, minha felicidade" },
    { t: 2.3, l: "Eu sei que sou meio atrapalhado, é verdade" },
    { t: 6.46, l: "Não consigo fazer duas coisas ao mesmo tempo" },
    { t: 10.37, l: "Mas focar em você é o meu melhor talento" },
  ];
  const LETRA_EXEMPLO = "Na varanda da nossa casa\no café passava devagar\ne você cantava baixinho\npra o dia acordar.";
  const REFRAO = ["Pâmela, você é a minha melhor metade", "O meu porto seguro, minha felicidade"];

  const $ = (s, r = raiz) => r.querySelector(s);
  const tela = $("#tela"), palco = $("#palco"), rodape = $("#rodape"), pontos = $("#pontos"), aviso = $("#aviso");
  // Escala a tela de referência (370 × 780) para caber inteira no encaixe.
  const BASE_L = 370, BASE_A = 780, encaixe = $("#encaixe");
  let escala = 1;
  function ajustarEscala() {
    const l = encaixe.clientWidth, a = encaixe.clientHeight; if (!l || !a) return;
    escala = Math.min(l / BASE_L, a / BASE_A);
    tela.style.transform = `scale(${escala})`;
    tela.style.left = Math.max(0, (l - BASE_L * escala) / 2) + "px";
    tela.style.top = Math.max(0, (a - BASE_A * escala) / 2) + "px";
  }
  ajustarEscala();
  let ro = null;
  try { ro = new ResizeObserver(ajustarEscala); ro.observe(encaixe); } catch { addEventListener("resize", ajustarEscala); }
  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let modo = "presente", indice = 0, cenaAtual = null, maoTimer = 0, maoEl = null, feito = {};
  let discos = 0, palmasTotal = 37;

  // ── Som: sintetizado, só depois de um toque (regra dos celulares) ──
  let ctx = null;
  const somLigado = () => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); return ctx; } catch { return null; } };
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let somParar = null;
  function tocar(notas, bpm, onda = "triangle", aoNota) {
    const a = somLigado(); if (!a) return;
    pararSom();
    const dur = 60 / bpm, t0 = a.currentTime + 0.05, nos = [];
    notas.forEach((n, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = onda; o.frequency.value = midi(n);
      g.gain.setValueAtTime(0.0001, t0 + i * dur);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + i * dur + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 0.95) * dur);
      o.connect(g).connect(a.destination); o.start(t0 + i * dur); o.stop(t0 + (i + 1) * dur);
      nos.push(o);
    });
    const timers = notas.map((_, i) => setTimeout(() => aoNota && aoNota(i), (i * dur + 0.05) * 1000));
    somParar = () => { nos.forEach((o) => { try { o.stop(); } catch {} }); timers.forEach(clearTimeout); };
    return notas.length * dur;
  }
  function pararSom() { if (somParar) { somParar(); somParar = null; } }
  // Trecho real: toca `src` por até `max` s; `aoTempo(t)` a cada quadro.
  function tocarTrecho(src, max, aoTempo, aoFim) {
    pararSom();
    const a = new Audio(src); a.preload = "auto";
    let quadro = 0, parado = false;
    const passo = () => { if (parado) return; aoTempo && aoTempo(a.currentTime); if (a.currentTime >= max) { fim(); return; } quadro = requestAnimationFrame(passo); };
    const fim = () => { if (parado) return; parado = true; cancelAnimationFrame(quadro); try { a.pause(); } catch {} aoFim && aoFim(); };
    a.addEventListener("ended", fim);
    a.play().then(() => { quadro = requestAnimationFrame(passo); }).catch(() => fim());
    somParar = fim;
  }
  function tom(freq = 880, dur = 0.12) { const a = somLigado(); if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.type = "sine"; o.frequency.value = freq; g.gain.setValueAtTime(0.1, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur); }
  const vibra = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

  // ── Confete ──
  function confete() {
    if (reduz) return;
    const c = document.createElement("canvas"); c.className = "confete"; tela.appendChild(c);
    c.width = BASE_L * 2; c.height = BASE_A * 2;
    const g = c.getContext("2d"), cores = ["#f0196b", "#d946ef", "#f8ab08", "#34d399", "#ffffff"];
    const ps = Array.from({ length: 90 }, () => ({ x: c.width / 2, y: c.height * 0.45, vx: (Math.random() - .5) * 26, vy: -Math.random() * 26 - 8, s: 6 + Math.random() * 8, cor: cores[Math.random() * 5 | 0], r: Math.random() * 6 }));
    let f = 0;
    (function passo() {
      g.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 1.1; p.r += .2; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.cor; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); });
      if (++f < 70) requestAnimationFrame(passo); else c.remove();
    })();
  }

  function mostrarAviso(t) { aviso.textContent = t; aviso.classList.add("ver"); clearTimeout(mostrarAviso.t); mostrarAviso.t = setTimeout(() => aviso.classList.remove("ver"), 2600); }

  // ── Mãozinha guia: conduz a tela inteira, alvo por alvo ──
  // Aparece logo (não espera a pessoa travar), pula para o próximo alvo a
  // cada ação e, se a pessoa tocar em outro lugar, volta em 2 s no alvo certo.
  let guiaSel = null, guiaTipo = "toca";
  function agendarMao(seletor, tipo = "toca", atraso = 500) {
    guiaSel = seletor; guiaTipo = tipo; clearTimeout(maoTimer); tirarMao();
    maoTimer = setTimeout(mostrarMao, atraso);
  }
  function alvoGuia() {
    if (!guiaSel) return null;
    const a = (cenaAtual && $(guiaSel, cenaAtual)) || $(guiaSel, rodape);
    return a && !a.disabled && !a.hidden && a.offsetParent !== null ? a : null;
  }
  function posicionarMao() {
    const alvo = alvoGuia(); if (!alvo || !maoEl) return;
    const ra = alvo.getBoundingClientRect(), rt = tela.getBoundingClientRect();
    maoEl.style.left = ((ra.left - rt.left + (guiaTipo === "arrasta" ? ra.width * 0.2 : ra.width / 2)) / escala - 10) + "px";
    maoEl.style.top = ((ra.top - rt.top + ra.height * 0.55) / escala) + "px";
  }
  function mostrarMao() {
    const alvo = alvoGuia(); if (!alvo) return;
    alvo.scrollIntoView({ block: "nearest", behavior: reduz ? "auto" : "smooth" });
    setTimeout(() => {
      if (alvoGuia() !== alvo) return;
      tirarMao();
      maoEl = document.createElement("div"); maoEl.className = "mao" + (guiaTipo === "arrasta" ? " arrasta" : ""); maoEl.textContent = "👆";
      tela.appendChild(maoEl); posicionarMao();
    }, reduz ? 0 : 320);
  }
  function tirarMao() { if (maoEl) { maoEl.remove(); maoEl = null; } }
  function pararGuia() { guiaSel = null; clearTimeout(maoTimer); tirarMao(); }
  tela.addEventListener("pointerdown", () => { tirarMao(); clearTimeout(maoTimer); maoTimer = setTimeout(mostrarMao, 2000); }, true);
  palco.addEventListener("scroll", posicionarMao, true);

  // ── Navegação ──
  function passos() { return TELAS; }
  function desenharPontos() {
    const n = TELAS.length;
    pontos.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i === indice ? "ativo" : ""}"></i>`).join("");
  }
  function ir(novo, dir = 1) {
    pararSom(); pararGuia();
    const lista = passos(); if (novo < 0 || novo >= lista.length) return;
    const velha = cenaAtual; indice = novo;
    const cena = criarCena(lista[indice]);
    cena.dataset.estado = dir > 0 ? "fora-dir" : "fora-esq";
    palco.appendChild(cena);
    requestAnimationFrame(() => requestAnimationFrame(() => { cena.dataset.estado = ""; if (velha) velha.dataset.estado = dir > 0 ? "fora-esq" : "fora-dir"; }));
    if (velha) setTimeout(() => velha.remove(), 450);
    cenaAtual = cena; desenharPontos(); desenharRodape();
    opcoes.track && opcoes.track("onboarding_tela", lista[indice]);
  }
  function proximo() { ir(indice + 1, 1); }
  function voltar() { if (indice === 0) return; ir(indice - 1, -1); }

  function desenharRodape() {
    const lista = passos(), ultima = indice === lista.length - 1, nome = lista[indice];
    if (nome === "boas") { rodape.style.flexDirection = ""; rodape.innerHTML = `<button class="btn btn-prim pulsa" type="button" data-acao="proximo" id="bt-prox">Começar</button>`; return; }
    const volta = `<button class="btn btn-volta" type="button" data-acao="voltar" aria-label="Voltar">←</button>`;
    if (!ultima) { rodape.style.flexDirection = ""; rodape.innerHTML = volta + `<button class="btn btn-prim" type="button" data-acao="proximo" id="bt-prox">Próximo</button>`; return; }
    // Criar e ouvir com o MESMO destaque: ouvir é a porta mais leve, e quem
    // ouve a música de alguém quer a sua.
    // Travado até a pessoa aplaudir (pedido do Audrei): a interação é o que
    // ensina. O "Pular" lá em cima continua livre — tela sem saída irrita.
    rodape.style.flexDirection = "column";
    const trava = feito.palma ? "" : "disabled";
    rodape.innerHTML = (feito.palma ? "" : '<div class="trava">Dê suas palmas para continuar 👏</div>')
      + `<div class="duplo"><button class="btn btn-prim ${feito.palma ? "pulsa" : ""}" type="button" data-acao="cta1" ${trava}>🎤 Criar minha música</button><button class="btn btn-prim" type="button" data-acao="cta2" ${trava} style="background:linear-gradient(135deg,#7c3aed,#d946ef)">🎧 Explorar o SpotFiz</button></div>`;
  }
  rodape.addEventListener("click", (e) => {
    const a = e.target.closest("[data-acao]"); if (!a) return;
    const acao = a.dataset.acao;
    if (acao === "proximo") proximo();
    else if (acao === "voltar") voltar();
    else if (acao === "cta1" || acao === "cta2") encerrar(acao === "cta1" ? "criar" : "spotfiz");
  });
  // Fim: quem decide para onde ir é o app (OnboardingApp.tsx).
  function encerrar(destino) {
    pararSom(); pararGuia(); vibra(30);
    opcoes.aoFechar(destino);
  }
  $("#pular").onclick = () => encerrar("pular");

  // Deslizar a tela inteira para trocar de passo (fora dos controles de arrastar)
  let x0 = null, y0 = 0;
  palco.addEventListener("pointerdown", (e) => { if (e.target.closest(".medidor,.fotos")) return; x0 = e.clientX; y0 = e.clientY; });
  palco.addEventListener("pointerup", (e) => {
    if (x0 === null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0 && indice < passos().length - 1) proximo(); else if (dx > 0) voltar(); }
  });

  // ── Cenas ──
  function criarCena(nome) {
    const s = document.createElement("section"); s.className = "cena"; s.setAttribute("aria-live", "polite");
    ({ boas: cenaBoas, como: cenaComo, recebe: cenaRecebe, rede: cenaRede })[nome](s);
    return s;
  }

  function cenaBoas(s) {
    s.innerHTML = `
      <div class="hero-arte" aria-hidden="true"><div class="vinil"></div><span class="nota">🎵</span><span class="nota">🎶</span><span class="nota">💝</span><span class="nota">🎵</span></div>
      <h2>Crie a sua <span class="destaque">própria música</span></h2>
      <div class="vantagens">
        <div class="vantagem"><i>✓</i><div><b>Simples</b><span>Você conta a história ou cola a sua letra.</span></div></div>
        <div class="vantagem"><i>✓</i><div><b>Rápido</b><span>Aprovou a letra, fica pronta em minutos.</span></div></div>
        <div class="vantagem"><i>✓</i><div><b>Fácil</b><span>Tudo pelo celular, em poucos toques.</span></div></div>
      </div>
      <p class="sub">Para presentear quem você ama ou para dar voz à letra que você escreveu.</p>`;
    agendarMao("#bt-prox", "toca", reduz ? 300 : 1700);
  }

  function cenaComo(s) {
    s.innerHTML = `
      <h2>Como <span class="destaque">funciona</span></h2>
      <div class="chave" role="group" aria-label="Jeito de criar" data-m="${modo}">
        <span class="ind" aria-hidden="true"></span>
        <button type="button" data-m="presente" aria-pressed="${modo === "presente"}"><span class="em">💝</span>Presentear</button>
        <button type="button" data-m="compor" aria-pressed="${modo === "compor"}"><span class="em">🎧</span>Minha letra</button>
      </div>
      <div id="demo" style="display:grid;gap:14px"></div>`;
    const mostra = (m) => {
      modo = m; pararSom(); tirarMao(); opcoes.track && opcoes.track("onboarding_modo", m);
      s.querySelectorAll(".chave button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
      $(".chave", s).dataset.m = m;
      const d = $("#demo", s); d.innerHTML = "";
      (m === "presente" ? demoEstilo : demoLetra)(d);
    };
    s.querySelectorAll(".chave button").forEach((b) => b.onclick = () => { vibra(8); mostra(b.dataset.m); });
    mostra(modo);
  }

  function blocoEstilo(onEscolha) {
    return `<div class="estudio">
        <div class="capa-viva" id="capa" style="background:linear-gradient(135deg,#2a2438,#3b3150)"><span class="nome" id="capa-nome">Escolha um estilo</span><div class="ondas" id="ondas">${"<i></i>".repeat(9)}</div></div>
        <div class="pilulas" role="group" aria-label="Estilo musical">${Object.entries(ESTILOS).map(([k, v]) => `<button type="button" class="pilula" aria-pressed="false" data-e="${k}">${v.emoji} ${k}</button>`).join("")}</div>
      </div>`;
  }
  function ligarEstilos(s, aoEscolher) {
    const ondas = [...s.querySelectorAll("#ondas i")];
    s.querySelectorAll(".pilula").forEach((p) => p.onclick = () => {
      s.querySelectorAll(".pilula").forEach((x) => x.setAttribute("aria-pressed", "false"));
      p.setAttribute("aria-pressed", "true"); vibra(10);
      const e = ESTILOS[p.dataset.e];
      $("#capa", s).style.background = `linear-gradient(0deg, rgba(0,0,0,.55), rgba(0,0,0,.05)), url(${e.capa}) center/cover`;
      $("#capa-nome", s).textContent = `${e.emoji} ${p.dataset.e}`;
      let ultimo = 0;
      tocarTrecho(e.audio, 6, (t) => { if (t - ultimo > 0.12) { ultimo = t; ondas.forEach((o) => o.style.height = (6 + Math.random() * 34) + "px"); } },
        () => ondas.forEach((o) => o.style.height = "6px"));
      aoEscolher && aoEscolher(p.dataset.e);
    });
  }
  function ficaPronta(botao, depois) {
    botao.disabled = true; botao.innerHTML = `<span class="relogio ${reduz ? "" : "girando"}"></span> Compondo…`; tom(520);
    setTimeout(() => {
      botao.outerHTML = `<div style="display:flex;justify-content:center"><span class="selo chega">⚡ Pronta em minutos</span></div>`;
      confete(); vibra([20, 40, 20]); tom(988, .2); depois && depois();
      $("#bt-prox")?.classList.add("pulsa"); agendarMao("#bt-prox", "toca", 900);
    }, reduz ? 200 : 1300);
  }

  function htmlEtapas(nomes) {
    return `<div class="etapas" aria-label="Passos">${nomes.map((n, i) => `<div class="etapa" data-n="${i + 1}"><i>${i + 1}</i><span>${n}</span></div>`).join("")}</div>`;
  }
  // n = passo atual (os anteriores ficam ✓). n = 4 marca os três como feitos.
  function marcarEtapa(s, n) {
    s.querySelectorAll(".etapa").forEach((e) => {
      const k = +e.dataset.n, i = e.querySelector("i");
      e.classList.toggle("feita", k < n); e.classList.toggle("ativa", k === n);
      i.textContent = k < n ? "✓" : k;
    });
    if (n > 1) { vibra(8); tom(600 + n * 80, .08); }
  }

  function demoEstilo(s) {
    s.innerHTML = `
      ${htmlEtapas(["Conte a história", "Escolha o estilo", "Aprove a letra"])}
      <div class="balao" id="balao"></div>
      ${blocoEstilo()}
      <button class="acao" id="aprovar" type="button" disabled>Aprovar a letra ✓</button>`;
    // Passo 1 acontece sozinho: a história se digita no balão
    marcarEtapa(s, 1);
    const historia = "“Conheci a Pamela por amigos em comum. Era só troca de olhares, até que num churrasco a conversa fluiu…”";
    let k = 0; const balao = $("#balao", s);
    const digita = () => {
      // Para se a pessoa trocou de aba/tela no meio (o balão saiu da página)
      if (k > 0 && !balao.isConnected) return;
      balao.innerHTML = historia.slice(0, k) + (k < historia.length ? '<span class="cursor" style="background:var(--rosa)"></span>' : "");
      if (k++ < historia.length) setTimeout(digita, reduz ? 0 : 18); else marcarEtapa(s, 2);
    };
    // Começa depois que a tela entra (no primeiro instante ela ainda não está na página)
    setTimeout(digita, reduz ? 0 : 450);
    ligarEstilos(s, () => {
      const b = $("#aprovar", s); if (!b || !b.disabled || b.dataset.ok) return;
      // A história vira letra no mesmo lugar: conta o processo sem ocupar mais tela
      const bl = $("#balao", s); bl.classList.add("vira-letra");
      setTimeout(() => { bl.innerHTML = `<span class="rotulo" style="color:var(--rosa)">Prévia do refrão</span>${REFRAO.slice(0, 2).join("<br>")}`; bl.classList.remove("vira-letra"); }, reduz ? 0 : 220);
      b.disabled = false; marcarEtapa(s, 3); agendarMao("#aprovar");
    });
    $("#aprovar", s).onclick = (e) => { e.currentTarget.dataset.ok = 1; ficaPronta(e.currentTarget, () => marcarEtapa(s, 4)); };
    agendarMao(".pilula", "toca", reduz ? 300 : 1900);
  }

  function demoLetra(s) {
    s.innerHTML = `
      ${htmlEtapas(["Cole a letra", "Escolha o estilo", "Receba a música"])}
      <div class="letra-colada" id="letra"></div>
      <button class="acao" id="colar" type="button" style="background:linear-gradient(135deg,#f6b440,#f8ab08 55%,#e98811);color:#1a1205">Colar minha letra</button>
      <div id="estilos-wrap" hidden>${blocoEstilo()}</div>
      <button class="acao" id="gerar" type="button" hidden>Gerar minha música ⚡</button>`;
    $("#colar", s).onclick = (e) => {
      e.currentTarget.hidden = true; vibra(10); somLigado();
      const alvo = $("#letra", s); let i = 0;
      const escreve = () => {
        alvo.innerHTML = LETRA_EXEMPLO.slice(0, i).replace(/\n/g, "<br>") + '<span class="cursor"></span>';
        if (i++ < LETRA_EXEMPLO.length) setTimeout(escreve, reduz ? 0 : 22);
        else { alvo.innerHTML = LETRA_EXEMPLO.replace(/\n/g, "<br>"); $("#estilos-wrap", s).hidden = false; marcarEtapa(s, 2); agendarMao(".pilula"); }
      };
      escreve();
    };
    ligarEstilos(s, () => { const g = $("#gerar", s); if (g.hidden) { g.hidden = false; marcarEtapa(s, 3); agendarMao("#gerar"); } });
    $("#gerar", s).onclick = (e) => ficaPronta(e.currentTarget, () => marcarEtapa(s, 4));
    marcarEtapa(s, 1);
    agendarMao("#colar");
  }

  function svgFoto(i) {
    const cenas = [
      ["#fde68a", "#f97316", '<circle cx="150" cy="40" r="18" fill="#fff7ed"/><path d="M0 95 Q60 60 120 90 T240 80 V140 H0Z" fill="#7c2d12"/>'],
      ["#bae6fd", "#0ea5e9", '<path d="M0 100 Q70 80 140 100 T280 95 V140 H0Z" fill="#0369a1"/><circle cx="60" cy="45" r="14" fill="#fff"/>'],
      ["#fbcfe8", "#db2777", '<circle cx="85" cy="70" r="20" fill="#fff1f2"/><circle cx="125" cy="70" r="20" fill="#fff1f2"/><path d="M60 140 Q105 90 150 140Z" fill="#9d174d"/>'],
      ["#ddd6fe", "#7c3aed", '<path d="M40 140 L110 50 L180 140Z" fill="#4c1d95"/><circle cx="170" cy="40" r="12" fill="#fff"/>'],
    ];
    const [a, b, desenho] = cenas[i];
    return `<svg viewBox="0 0 220 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="220" height="140" fill="url(#g${i})"/>${desenho}</svg>`;
  }
  function desenharQR(cv) {
    const n = 21, g = cv.getContext("2d"); cv.width = n; cv.height = n; g.fillStyle = "#fff"; g.fillRect(0, 0, n, n); g.fillStyle = "#15131d";
    let semente = 7; const rnd = () => (semente = (semente * 9301 + 49297) % 233280) / 233280;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (rnd() > .52) g.fillRect(x, y, 1, 1);
    [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([x, y]) => { g.fillStyle = "#15131d"; g.fillRect(x, y, 7, 7); g.fillStyle = "#fff"; g.fillRect(x + 1, y + 1, 5, 5); g.fillStyle = "#15131d"; g.fillRect(x + 2, y + 2, 3, 3); });
  }

  function cenaRecebe(s) {
    const compor = modo === "compor";
    s.innerHTML = `
      <div><span class="selo">⚡ Pronta em minutos</span></div>
      <h2>Veja o que você <span class="destaque">recebe</span></h2>
      <div class="player">
        <div class="mini-capa" ${compor ? "" : 'style="background:url(/onboarding/capa-talento.jpg) center/cover"'}><button class="play" id="play" type="button" aria-label="Tocar">▶</button></div>
        <div><div class="titulo">${compor ? "Varanda" : "Meu Melhor Talento"}</div><div class="meta">${compor ? "Composição autoral · MPB" : "Pedido de Namoro · K-Pop"}</div></div>
        <div class="letras" id="letras">${(compor ? LETRA_EXEMPLO.split("\n") : LETRA_PLAYER.map((x) => x.l)).map((l) => `<p>${l}</p>`).join("")}</div>
        <div class="barra"><i id="progresso"></i></div>
      </div>
      ${compor ? `
      <div class="extras">
        <div class="extra"><span class="rotulo">🌐 Publicar no SpotFiz</span><span class="sub" style="font-size:13px">Outras pessoas ouvem e aplaudem a sua música.</span></div>
        <div class="extra"><span class="rotulo">🔗 Link pra compartilhar</span><span class="sub" style="font-size:13px">Mande no WhatsApp e nas redes.</span></div>
      </div>` : `
      <div class="extras">
        <div class="extra"><span class="rotulo">📸 Retrospectiva</span>
          <div class="fotos" id="fotos"><div class="trilho" id="trilho">${[0, 1, 2, 3].map(svgFoto).join("")}</div><div class="marcas" id="marcas">${"<i></i>".repeat(4)}</div></div>
          <span class="plano">Planos Retrospectiva</span></div>
        <div class="extra"><span class="rotulo">🎁 Cartão QR Code</span>
          <button class="cartao-qr" id="qr" type="button" aria-label="Virar o cartão"><div class="giro"><div class="face frente">Para você,<br>Pamela 💘<br><span style="font-weight:500;font-size:12px;opacity:.7">toque pra virar</span></div><div class="face verso"><canvas id="qr-canvas"></canvas></div></div></button>
          <span class="plano">Plano Premium</span></div>
      </div>`}
      <div class="chips"><span class="chip">🎵 2ª versão grátis</span><span class="chip">🖼️ Capa exclusiva</span><span class="chip">📝 Letra sincronizada</span></div>`;
    const linhas = [...s.querySelectorAll("#letras p")];
    $("#play", s).onclick = (e) => {
      const b = e.currentTarget; vibra(10);
      const p = $("#progresso", s);
      const terminou = () => { b.textContent = "▶"; linhas.forEach((x) => x.classList.remove("agora")); agendarMao(compor ? "#bt-prox" : "#fotos", compor ? "toca" : "arrasta", 200); };
      b.textContent = "❚❚";
      if (!compor) {
        // Música real: a linha acende no tempo da letra sincronizada (LRC)
        const DUR = 13.2;
        p.style.transition = "none";
        tocarTrecho("/onboarding/talento.mp3", DUR, (t) => {
          let l = -1; LETRA_PLAYER.forEach((x, k) => { if (t >= x.t) l = k; });
          linhas.forEach((x, k) => x.classList.toggle("agora", k === l));
          p.style.width = Math.min(100, (t / DUR) * 100) + "%";
        }, terminou);
        return;
      }
      const notas = [65, 69, 72, 69, 67, 65, 64, 65];
      const dur = tocar(notas, 120, "triangle", (i) => {
        const l = Math.min(linhas.length - 1, Math.floor(i / 2));
        linhas.forEach((x, k) => x.classList.toggle("agora", k === l));
      });
      p.style.transition = "none"; p.style.width = "0";
      requestAnimationFrame(() => { p.style.transition = `width ${dur}s linear`; p.style.width = "100%"; });
      setTimeout(terminou, dur * 1000 + 100);
    };
    if (!compor) {
      let foto = 0; const trilho = $("#trilho", s), marcas = [...s.querySelectorAll("#marcas i")];
      const mostra = () => { trilho.style.transform = `translateX(-${foto * 100}%)`; marcas.forEach((m, i) => m.classList.toggle("ativo", i === foto)); };
      mostra();
      let fx = null; const f = $("#fotos", s);
      f.addEventListener("pointerdown", (e) => { fx = e.clientX; f.setPointerCapture?.(e.pointerId); });
      f.addEventListener("pointerup", (e) => {
        if (fx === null) return; const dx = e.clientX - fx; fx = null;
        foto = (dx < -15 ? foto + 1 : dx > 15 ? foto + 3 : foto + 1) % 4; mostra(); vibra(8);
        if (!feito.foto) { feito.foto = 1; agendarMao("#qr"); }
      });
      desenharQR($("#qr-canvas", s));
      $("#qr", s).onclick = (e) => { e.currentTarget.classList.toggle("virado"); vibra(15); tom(780); if (!feito.qr) { feito.qr = 1; confete(); $("#bt-prox")?.classList.add("pulsa"); agendarMao("#bt-prox", "toca", 900); } };
    }
    agendarMao("#play");
  }

  function cenaRede(s) {
    const n = NIVEIS[nivelDe(discos)];
    s.innerHTML = `
      <div class="faixa">
        <div class="msg-spotfiz">
          <b style="font-size:19px;line-height:1.2">🎧 Ouça músicas <span class="destaque">de graça</span> no SpotFiz</b>
          <p>Publique a sua e veja se ela entra nas mais ouvidas e mais aplaudidas.</p>
          <div class="selos"><span>▶ Mais ouvidas</span><span>👏 Mais aplaudidas</span><span>🏆 Top 10</span></div>
        </div>
        <div class="musica"><button class="c" id="ouvir-rede" type="button" aria-label="Ouvir A Mais Doce Espera" style="background:url(/onboarding/capa-doce.jpg) center/cover;border:0;cursor:pointer;display:grid;place-items:center;color:#fff;font-size:14px">▶</button><div><b>A Mais Doce Espera</b><span>Chá Revelação · Sertanejo</span></div></div>
        ${feito.palma ? "" : '<div class="convite-palma" id="convite">👆 Arraste para dar palmas 👏</div>'}
        <div class="medidor ${feito.palma ? "" : "convida"}" id="medidor" role="slider" tabindex="0" aria-label="Quantas palmas, de 0 a 10" aria-valuemin="0" aria-valuemax="10" aria-valuenow="0">
          ${feito.palma ? "" : '<div class="dica-mao" aria-hidden="true">👆</div>'}
          <div class="segs" id="segs">${Array.from({ length: 10 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>
        </div>
        <div class="medidor-leg"><span>Silêncio</span><span class="total-palmas" id="total-palmas">👏 ${palmasTotal} palmas</span><span>De pé</span></div>
      </div>
      <div class="faixa">
        <span class="rotulo">🏆 Sua carreira</span>
        <div class="carreira">
          <div class="boneco"><img id="boneco" src="${n.arte}" alt="${n.nome}"></div>
          <div class="nivel"><b id="nivel-nome">${n.nome}</b><span class="desc" id="nivel-desc">${n.desc ? n.desc + "% de desconto" : "Comece a sua carreira"}</span>
            <div class="discos" id="discos">${"<i></i>".repeat(10)}</div>
            <button class="btn-disco" id="ganhar" type="button">💿 Ganhar um disco</button></div>
        </div>
      </div>`;
    // Medidor: mesma lógica do app (posição do dedo na largura = 0 a 10)
    // Ouvir a música de exemplo do SpotFiz (trecho real de 10 s)
    $("#ouvir-rede", s).onclick = (e) => {
      const b = e.currentTarget; somLigado(); vibra(8);
      if (b.textContent === "❚❚") { pararSom(); b.textContent = "▶"; return; }
      b.textContent = "❚❚";
      tocarTrecho("/onboarding/doce.mp3", 10, null, () => { b.textContent = "▶"; });
    };
    const med = $("#medidor", s), segs = [...s.querySelectorAll("#segs i")], cor = (i) => { const p = i / 9; return `rgb(${Math.round(240 - 23 * p)},${Math.round(25 + 45 * p)},${Math.round(107 + 132 * p)})`; };
    let valor = 0, arrastando = false, dado = 0;
    const pinta = (v) => { segs.forEach((x, i) => { x.style.background = i < v ? cor(i) : ""; x.style.boxShadow = i < v ? `0 0 8px ${cor(i)}` : ""; }); med.setAttribute("aria-valuenow", v); };
    const noPonto = (x) => { const r = med.getBoundingClientRect(); return Math.max(1, Math.min(10, Math.ceil(((x - r.left) / r.width) * 10))); };
    const solta = () => { if (!arrastando) return; arrastando = false; palmasTotal += Math.max(0, valor - dado); dado = Math.max(dado, valor); $("#total-palmas", s).textContent = `👏 ${palmasTotal} palmas`; confete(); vibra([15, 30, 15]); tom(1046, .25); if (!feito.palma) { feito.palma = 1; opcoes.track && opcoes.track("onboarding_palmas", String(valor)); desenharRodape(); mostrarAviso("Boa! Agora você pode seguir 🎉"); agendarMao("#ganhar"); } };
    const tiraConvite = () => { med.classList.remove("convida"); med.querySelector(".dica-mao")?.remove(); $("#convite", s)?.remove(); };
    med.addEventListener("pointerdown", (e) => { tiraConvite(); arrastando = true; somLigado(); try { med.setPointerCapture(e.pointerId); } catch {} valor = noPonto(e.clientX); pinta(valor); tom(400 + valor * 60, .05); });
    med.addEventListener("pointermove", (e) => { if (!arrastando) return; const v = noPonto(e.clientX); if (v !== valor) { valor = v; pinta(v); tom(400 + v * 60, .04); vibra(5); } });
    med.addEventListener("pointerup", solta); med.addEventListener("pointercancel", solta);
    med.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { valor = Math.min(10, valor + 1); pinta(valor); } if (e.key === "ArrowLeft") { valor = Math.max(0, valor - 1); pinta(valor); } if (e.key === "Enter") { arrastando = true; solta(); } });

    const desenhaDiscos = () => s.querySelectorAll("#discos i").forEach((d, i) => d.classList.toggle("cheio", i < Math.min(10, discos)));
    desenhaDiscos();
    $("#ganhar", s).onclick = () => {
      const antes = nivelDe(discos);
      discos = discos >= 20 ? 20 : discos < 3 ? 3 : discos < 6 ? 6 : discos < 10 ? 10 : 20;
      const depois = nivelDe(discos); desenhaDiscos(); vibra(12); tom(700);
      if (!feito.disco) { feito.disco = 1; agendarMao('[data-acao="cta1"]', "toca", 1400); }
      if (depois !== antes) {
        const nv = NIVEIS[depois], img = $("#boneco", s);
        img.classList.remove("sobe"); void img.offsetWidth; img.src = nv.arte; img.alt = nv.nome; img.classList.add("sobe");
        $("#nivel-nome", s).textContent = nv.nome; $("#nivel-desc", s).textContent = nv.desc + "% de desconto";
        confete(); vibra([20, 40, 20]); tom(1175, .3);
        if (depois === 4) { $("#ganhar", s).textContent = "⭐ Você chegou ao topo!"; $("#ganhar", s).disabled = true; mostrarAviso("Popstar: 25% de desconto na próxima música 🎉"); }
      }
    };
  }
  function nivelDe(d) { let k = 0; NIVEIS.forEach((n, i) => { if (d >= n.min) k = i; }); return k; }

  ir(0, 1);

  // Desmontar: para som, guia e observador (o DOM some junto com a raiz).
  return function limpar() {
    pararSom(); pararGuia();
    try { ro && ro.disconnect(); } catch {}
    removeEventListener("resize", ajustarEscala);
    try { ctx && ctx.close(); } catch {}
  };
}
