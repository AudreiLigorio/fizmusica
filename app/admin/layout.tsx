"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

const NAV = [
  { href: "/admin",           label: "Dashboard",  icon: "📊" },
  { href: "/admin/pedidos",   label: "Pedidos",    icon: "🎵" },
  { href: "/admin/producao",  label: "Produção",   icon: "🎧" },
  { href: "/admin/crm",       label: "CRM",        icon: "📬" },
  { href: "/admin/produtos",  label: "Produtos",   icon: "🛒" },
  { href: "/admin/wizard",    label: "Wizard",     icon: "✨" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" })
    router.push("/admin/login")
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col lg:flex-row">

      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex w-64 bg-black/60 border-r border-white/10 flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <span className="text-pink-400 font-bold text-lg">Fiz Música</span>
          <span className="text-gray-500 text-sm block">Admin</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-pink-500/15 text-pink-300 border border-pink-500/20"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1">
          <Link href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-500 hover:text-white hover:bg-white/5 transition-all">
            <span>↗</span> Ver site
          </Link>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all text-left">
            <span>→</span> Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/60 shrink-0">
        <span className="text-pink-400 font-bold">Fiz Música <span className="text-gray-500 font-normal text-sm">Admin</span></span>
        <button onClick={handleLogout} className="text-gray-500 text-sm hover:text-red-400 transition-colors">Sair</button>
      </div>

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        {children}
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-white/10"
           style={{ background: "rgba(7,6,13,0.97)", backdropFilter: "blur(16px)" }}>
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-medium transition-colors ${
                active ? "text-pink-400" : "text-gray-500"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-pink-500 mt-0.5" />}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
