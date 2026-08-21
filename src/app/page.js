import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#060913] text-gray-100 selection:bg-[#10b981] selection:text-white">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#060913]/80">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
              LIGA MASTER
            </span>
            <span className="rounded-full bg-[#3b82f6]/10 px-2.5 py-0.5 text-xs font-semibold text-[#3b82f6] border border-[#3b82f6]/20">
              EA FC 26
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold leading-6 text-gray-300 hover:text-white transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-[#10b981] hover:bg-[#059669] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Registrar Time
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-20 pb-16 sm:pb-24 lg:pt-32">
          {/* Background Decorative Gradients */}
          <div className="absolute top-0 left-1/2 -z-10 h-[600px] w-[1000px] -translate-x-1/2 [mask-image:radial-gradient(100%_100%_at_top_center,white,transparent)]">
            <div className="absolute inset-0 bg-gradient-to-r from-[#10b981]/15 to-[#3b82f6]/15 blur-3xl" />
          </div>

          <div className="container mx-auto max-w-7xl px-4 sm:px-6 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
              Gerencie sua Liga Master <br />
              <span className="bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
                Como um Diretor Profissional
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-400">
              A plataforma definitiva para ligas de futebol virtual do EA FC 26.
              Controle finanças, negocie jogadores sob tetos salariais estritos e dispute
              copas lendárias em uma interface futurista e responsiva.
            </p>

            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/register"
                className="rounded-full bg-gradient-to-r from-[#10b981] to-[#3b82f6] px-6 py-3 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-[#10b981]/25 active:scale-95"
              >
                Criar Minha Conta
              </Link>
              <Link
                href="/about"
                className="text-sm font-semibold leading-6 text-gray-300 hover:text-white transition-colors flex items-center gap-1"
              >
                Saiba mais <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-[#04060c]">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Funcionalidades Premium do Sistema
              </h2>
              <p className="mt-4 text-gray-400">
                Tudo o que você precisa para organizar seu campeonato e elevar o nível da competição virtual.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {/* Feature 1 */}
              <div className="rounded-2xl border border-white/5 bg-[#090d16]/50 p-8 hover:border-[#10b981]/20 transition-all duration-300 hover:translate-y-[-4px]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#10b981]/10 text-[#10b981] mb-6">
                  ⚽
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Mercado Híbrido</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Negocie com compra imediata ou realize leilões emocionantes e trocas envolvendo jogadores + dinheiro.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="rounded-2xl border border-white/5 bg-[#090d16]/50 p-8 hover:border-[#3b82f6]/20 transition-all duration-300 hover:translate-y-[-4px]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] mb-6">
                  💰
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Teto Salarial</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Gerencie seu clube sob um teto de folha salarial de R$ 15.000. Salários altos elevam proporcionalmente o preço de compra.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="rounded-2xl border border-white/5 bg-[#090d16]/50 p-8 hover:border-[#f59e0b]/20 transition-all duration-300 hover:translate-y-[-4px]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f59e0b]/10 text-[#f59e0b] mb-6">
                  🏆
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Copas e Ligas</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Crie divisões (Série A/B) com acessos manuais, sorteios automáticos de grupos e mata-mata para Copas.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="rounded-2xl border border-white/5 bg-[#090d16]/50 p-8 hover:border-purple-500/20 transition-all duration-300 hover:translate-y-[-4px]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 mb-6">
                  📊
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Estatísticas Reais</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Reporte de partidas com fichas completas. Controle automático de artilheiros, assistências e suspensões.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer / SoFIFA Attribution */}
      <footer className="border-t border-white/5 bg-[#04060c] py-12">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-lg font-semibold tracking-tight text-white">
              Liga Master EA FC 26
            </span>
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Liga Master Manager. Projeto não comercial feito para fãs de futebol virtual.
            </p>
          </div>

          {/* SoFIFA Partner Logo and Link (Mandatory Requirement) */}
          <div className="flex flex-col items-center md:items-end gap-2 border border-white/5 bg-[#060913] p-4 rounded-xl">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
              Parceiro Oficial de Dados
            </span>
            <a
              href="https://sofifa.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-[#10b981] transition-colors"
            >
              {/* Custom SVG logo representing Sofifa style */}
              <span className="bg-[#10b981] text-[#060913] text-xs font-black px-1.5 py-0.5 rounded mr-1">
                So
              </span>
              FIFA.com
            </a>
            <span className="text-[10px] text-gray-500">
              Dados de atributos de jogadores alimentados pela API oficial do SoFIFA.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
