export default function Footer() {
  return (
    <footer
      className="border-t border-white/[0.05] py-14"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-5">
        <img
          src="/logo_fizmusica.png"
          alt="Fiz Música"
          className="h-8 w-auto opacity-70"
        />
        <p
          className="text-sm tracking-[0.2em] uppercase text-white/55"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic" }}
        >
          Sua história. Sua música.
        </p>
        <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#f0196b]/30 to-transparent" />

        {/* Os links de Termos/Privacidade/Cookies/etc. saíram daqui — viviam
            repetidos no rodapé de toda página. Agora moram num lugar só, no
            menu do topo ("Termos e Políticas" → /legal), que já lista os 10
            documentos organizados. Pedido do Audrei, 2026-08-28. */}
        <p className="text-xs text-white/20">© 2026 Fiz Música</p>
      </div>
    </footer>
  )
}

