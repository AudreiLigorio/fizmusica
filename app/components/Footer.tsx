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

        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/45">
          <a href="/legal/termos-de-uso" className="hover:text-white transition-colors">Termos de Uso</a>
          <span className="text-white/15">·</span>
          <a href="/legal/politica-de-privacidade" className="hover:text-white transition-colors">Privacidade</a>
          <span className="text-white/15">·</span>
          <a href="/legal/politica-de-cookies" className="hover:text-white transition-colors">Cookies</a>
          <span className="text-white/15">·</span>
          <a href="/legal/licenca-de-uso" className="hover:text-white transition-colors">Licença</a>
          <span className="text-white/15">·</span>
          <a href="/legal/reembolso-e-cancelamento" className="hover:text-white transition-colors">Reembolso</a>
          <span className="text-white/15">·</span>
          <a href="/legal" className="hover:text-white transition-colors">Todos</a>
        </nav>

        <p className="text-xs text-white/20">© 2026 Fiz Música</p>
      </div>
    </footer>
  )
}

