// Aparece no lugar do botão de pagamento quando o site está dentro do app da
// Play Store (ver lib/canal.ts). Texto NEUTRO de propósito: a política da Play
// proíbe, dentro do app, mandar o cliente pagar fora dele ("compre no site").
export default function AvisoCompraApp({ compacto = false }: { compacto?: boolean }) {
  return (
    <div
      className={`w-full rounded-2xl text-center ${compacto ? "py-3 px-4" : "py-5 px-5"}`}
      style={{ background: "rgba(240,25,107,0.08)", border: "1px solid rgba(240,25,107,0.3)" }}
    >
      <p className="text-sm font-semibold text-white">🎵 Compras pelo app chegam em breve</p>
      <p className="text-sm text-white/70 mt-1">Seu pedido fica salvo na aba Pedidos.</p>
    </div>
  )
}
