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
          className="text-sm tracking-[0.2em] uppercase text-white/30"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic" }}
        >
          Sua história. Sua música.
        </p>
        <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#f0196b]/30 to-transparent" />
        <p className="text-xs text-white/20">© 2026 Fiz Música</p>
      </div>
    </footer>
  )
}
