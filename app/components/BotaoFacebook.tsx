// Botão "Entrar com Facebook" — azul oficial da Meta (#1877F2) com o "f"
// branco, como pedem as diretrizes de marca. `className` só ajusta o espaçamento
// e o arredondamento de cada tela, pra ficar alinhado com o botão do Google ao lado.
export default function BotaoFacebook({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full inline-flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white transition-colors py-3 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#fff" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/>
      </svg>
      Entrar com Facebook
    </button>
  )
}
