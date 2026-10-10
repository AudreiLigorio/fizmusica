// Aparência do site para o cliente: Claro, Escuro ou Automático (segue o
// celular). Fica num módulo sem "use client" porque o MESMO valor padrão e a
// mesma regra de exceções são usados em dois lugares: no script que roda antes
// da página aparecer (layout) e no interruptor (app/components/Tema.tsx).

export type Tema = "claro" | "escuro" | "auto"

export const CHAVE_TEMA = "fm_tema"
export const EVENTO_TEMA = "fm-tema"

// Quem chega pela primeira vez, sem ter escolhido nada.
export const TEMA_PADRAO: Tema = "auto"

// Telas que NÃO mudam de cor: os players são escuros de propósito — o do
// presente (/m/, o momento da surpresa) e o da música pública da Rede
// (/rede/[id], capa em tela cheia com a letra rolando) — e o admin
// (operação) fica fora.
export const PREFIXOS_SEMPRE_ESCUROS = ["/m/", "/rede/", "/admin"]

// App da Play Store (TWA): SEMPRE escuro, sem escolha (decisão do Audrei,
// 2026-10-09). Mesmo sinal de lib/canal.ts — o referrer
// "android-app://com.fizmusica.app" na primeira página, guardado na
// sessionStorage da aba do app. Ficam aqui (e não em canal.ts, que é
// "use client") porque o script do <head> é montado no servidor.
export const CHAVE_APP_PLAY = "fm_app_play"
export const PACOTE_APP_PLAY = "android-app://com.fizmusica.app"

// Script inline do <head>: aplica o tema ANTES da primeira pintura. Sem ele a
// página abriria escura e clarearia na frente da pessoa (o "piscar").
export const scriptTemaInicial = `(function(){try{
var p=location.pathname,x=${JSON.stringify(PREFIXOS_SEMPRE_ESCUROS)};
for(var i=0;i<x.length;i++){if(p.indexOf(x[i])===0)return;}
if(document.referrer.indexOf(${JSON.stringify(PACOTE_APP_PLAY)})===0){sessionStorage.setItem(${JSON.stringify(CHAVE_APP_PLAY)},"1");}
if(sessionStorage.getItem(${JSON.stringify(CHAVE_APP_PLAY)})==="1")return;
var t=localStorage.getItem(${JSON.stringify(CHAVE_TEMA)})||${JSON.stringify(TEMA_PADRAO)};
if(t==="claro"||(t==="auto"&&!matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.dataset.tema="claro";}
}catch(e){}})();`
