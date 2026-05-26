import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/ui/language-selector';
import { ArrowRight, BookOpen, Activity, Shield, Search } from 'lucide-react';

/**
 * Landing — Aurora Glass · Rhythmic Zigzag
 * Design: deep navy base + iridescent green/violet aurora, Instrument Serif + Work Sans,
 * three alternating zigzag sections after the centered hero.
 */
export default function Landing() {
  const { t } = useTranslation();

  return (
    <div
      className="min-h-screen w-full text-white relative overflow-hidden font-['Work_Sans']"
      style={{ backgroundColor: 'hsl(var(--aurora-bg))' }}
    >
      {/* Aurora background layers */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full mix-blend-screen filter blur-[120px] opacity-40 aurora-pulse"
          style={{ backgroundColor: 'hsl(var(--aurora-mid))' }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full mix-blend-screen filter blur-[140px] opacity-20 aurora-float"
          style={{ backgroundColor: 'hsl(var(--aurora-violet))' }}
        />
        <div
          className="absolute top-[20%] right-[10%] w-[50%] h-[50%] mix-blend-screen filter blur-[130px] opacity-10 aurora-morph"
          style={{ backgroundColor: 'hsl(var(--aurora-green))' }}
        />
      </div>

      <div className="relative z-10">
        {/* ── Header ── */}
        <nav className="flex items-center justify-between px-6 md:px-8 py-6 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg"
              style={{
                background:
                  'linear-gradient(135deg, hsl(var(--aurora-green)), hsl(var(--aurora-violet)))',
                boxShadow: '0 10px 30px -10px hsl(var(--aurora-green) / 0.4)',
              }}
            >
              <div
                className="w-4 h-4 rounded-sm rotate-45"
                style={{ backgroundColor: 'hsl(var(--aurora-bg))' }}
              />
            </div>
            <span className="font-semibold tracking-tight text-xl">
              UHS <span style={{ color: 'hsl(var(--aurora-green))' }}>Health OS</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-10 text-sm font-medium text-white/70">
            <Link to="/learn" className="hover:text-white transition-colors">
              Library
            </Link>
            <Link to="/scores" className="hover:text-white transition-colors">
              Calculators
            </Link>
            <Link to="/about" className="hover:text-white transition-colors">
              About
            </Link>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <LanguageSelector variant="minimal" />
            <Link
              to="/login"
              className="text-sm font-medium text-white/80 hover:text-white transition-colors hidden sm:inline"
            >
              {t('common.login')}
            </Link>
            <Link
              to="/signup"
              className="px-5 py-2.5 bg-white rounded-full text-sm font-semibold hover:opacity-90 transition-all"
              style={{ color: 'hsl(var(--aurora-bg))' }}
            >
              {t('common.getStarted')}
            </Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <header className="pt-20 md:pt-24 pb-24 md:pb-32 px-6 max-w-7xl mx-auto text-center">
          {/* Trust pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-10 md:mb-12">
            {[
              { label: 'No PHI On-Chain', color: 'hsl(var(--aurora-green))' },
              { label: 'Blockchain Verified', color: 'hsl(var(--aurora-violet))' },
              { label: 'Consent Controlled', color: 'hsl(var(--aurora-mid))' },
            ].map((b) => (
              <span
                key={b.label}
                className="px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[10px] uppercase tracking-widest text-white/60 flex items-center gap-2"
              >
                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: b.color }} />
                {b.label}
              </span>
            ))}
          </div>

          {/* Display headline */}
          <h1 className="font-['Instrument_Serif'] italic text-6xl sm:text-7xl md:text-8xl lg:text-9xl leading-[0.9] mb-6 md:mb-8">
            The Universal
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, hsl(var(--aurora-green)), white, hsl(var(--aurora-violet)))',
              }}
            >
              Health Operating System
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base md:text-lg text-white/60 font-light leading-relaxed mb-10 md:mb-12">
            AI-powered clinical decision support and blockchain-verified quality metrics for the
            next generation of healthcare delivery.
          </p>

          {/* Search */}
          <form
            className="max-w-xl mx-auto relative group"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get('q');
              if (q) window.location.href = `/learn?q=${encodeURIComponent(String(q))}`;
            }}
          >
            <div
              className="absolute -inset-1 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"
              style={{
                background:
                  'linear-gradient(90deg, hsl(var(--aurora-green)), hsl(var(--aurora-violet)))',
              }}
            />
            <div className="relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex items-center">
              <Search className="h-4 w-4 ml-4 text-white/40" />
              <input
                name="q"
                type="text"
                placeholder="Search clinical knowledge, protocols, guidelines..."
                className="flex-1 bg-transparent border-none outline-none px-4 text-white placeholder:text-white/30 text-sm"
              />
              <button
                type="submit"
                className="px-6 md:px-8 py-3 rounded-xl font-bold text-sm tracking-wide hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: 'hsl(var(--aurora-green))',
                  color: 'hsl(var(--aurora-bg))',
                }}
              >
                Search
              </button>
            </div>
          </form>
        </header>

        {/* ── Zigzag 1 · Library (graphic left) ── */}
        <section className="py-20 md:py-24 px-6 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div className="order-2 md:order-1">
              <div className="relative">
                <div
                  className="absolute -inset-4 blur-3xl rounded-full"
                  style={{ backgroundColor: 'hsl(var(--aurora-violet) / 0.2)' }}
                />
                <div className="relative aspect-[4/3] bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden p-8">
                  <div className="grid grid-cols-2 gap-4 h-full">
                    <div className="space-y-4">
                      <div className="h-1/2 bg-white/10 rounded-2xl p-4">
                        <div
                          className="w-12 h-2 rounded mb-4"
                          style={{ backgroundColor: 'hsl(var(--aurora-green))' }}
                        />
                        <div className="w-full h-1 bg-white/10 rounded mb-2" />
                        <div className="w-3/4 h-1 bg-white/10 rounded" />
                      </div>
                      <div
                        className="h-1/3 rounded-2xl border"
                        style={{
                          backgroundColor: 'hsl(var(--aurora-green) / 0.1)',
                          borderColor: 'hsl(var(--aurora-green) / 0.2)',
                        }}
                      />
                    </div>
                    <div className="bg-white/5 rounded-2xl border border-white/5 mt-8" />
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2 space-y-6">
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: 'hsl(var(--aurora-violet))' }}
              >
                Knowledge Engine
              </span>
              <h2 className="font-['Instrument_Serif'] text-4xl md:text-5xl lg:text-6xl italic leading-tight">
                Global Clinical Library
              </h2>
              <p className="text-white/50 text-base md:text-lg leading-relaxed">
                Access validated guidelines and peer-reviewed protocols stored in a decentralized,
                tamper-proof architecture.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/reumato"
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-colors"
                >
                  Rheumatology Portal
                </Link>
                <Link
                  to="/learn"
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-colors"
                >
                  Knowledge Library
                </Link>
              </div>
              <Link
                to="/learn"
                className="group inline-flex items-center gap-3 font-medium text-white/80 hover:text-white transition-all pt-2"
              >
                <BookOpen className="h-4 w-4" />
                Explore Library
                <span
                  className="w-10 h-px bg-white/20 group-hover:w-16 transition-all"
                  style={{ transition: 'all 0.3s' }}
                />
                <ArrowRight className="h-4 w-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Zigzag 2 · Calculators (graphic right) ── */}
        <section className="py-20 md:py-24 px-6 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div className="space-y-6">
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: 'hsl(var(--aurora-green))' }}
              >
                Precision Tools
              </span>
              <h2 className="font-['Instrument_Serif'] text-4xl md:text-5xl lg:text-6xl italic leading-tight">
                Dynamic Score Systems
              </h2>
              <p className="text-white/50 text-base md:text-lg leading-relaxed">
                Over 400 validated medical calculators integrated directly into your clinical
                workflow with verifiable audit logs.
              </p>
              <Link
                to="/scores"
                className="group inline-flex items-center gap-3 font-medium text-white/80 hover:text-white transition-all"
              >
                <Activity className="h-4 w-4" />
                Explore Calculators
                <span
                  className="w-10 h-px bg-white/20 group-hover:w-16 transition-all"
                  style={{
                    backgroundColor: 'hsl(var(--aurora-green) / 0.4)',
                  }}
                />
              </Link>
            </div>

            <div className="relative">
              <div
                className="absolute -inset-4 blur-3xl rounded-full"
                style={{ backgroundColor: 'hsl(var(--aurora-green) / 0.2)' }}
              />
              <div className="relative aspect-video bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10">
                <div className="flex justify-between items-end h-full gap-2">
                  {[
                    { h: '40%', c: 'hsl(var(--aurora-green))' },
                    { h: '60%', c: 'hsl(var(--aurora-mid))' },
                    { h: '30%', c: 'hsl(var(--aurora-violet))' },
                    { h: '85%', c: 'hsl(var(--aurora-green))' },
                    { h: '50%', c: 'rgba(255,255,255,0.2)' },
                  ].map((bar, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-lg transition-all hover:opacity-80"
                      style={{ height: bar.h, backgroundColor: bar.c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Zigzag 3 · Blockchain (graphic left) ── */}
        <section className="py-20 md:py-24 px-6 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div className="order-2 md:order-1 relative group">
              <div
                className="absolute -inset-8 opacity-30 rounded-full blur-2xl"
                style={{
                  background:
                    'linear-gradient(135deg, hsl(var(--aurora-mid)), transparent)',
                }}
              />
              <div
                className="relative p-1 rounded-[2.5rem]"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.2), transparent)',
                }}
              >
                <div
                  className="rounded-[2.3rem] overflow-hidden aspect-square flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(var(--aurora-bg))' }}
                >
                  <div className="w-48 h-48 border border-white/10 rounded-full flex items-center justify-center relative">
                    <div className="absolute w-64 h-px bg-white/10 rotate-45" />
                    <div className="absolute w-64 h-px bg-white/10 -rotate-45" />
                    <div
                      className="w-24 h-24 rounded-full filter blur-3xl opacity-30"
                      style={{ backgroundColor: 'hsl(var(--aurora-green))' }}
                    />
                    <div className="relative w-14 h-14 bg-white/5 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center shadow-2xl">
                      <Shield
                        className="h-6 w-6"
                        style={{ color: 'hsl(var(--aurora-green))' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2 space-y-6">
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: 'hsl(var(--aurora-violet))' }}
              >
                Audit Layer
              </span>
              <h2 className="font-['Instrument_Serif'] text-4xl md:text-5xl lg:text-6xl italic leading-tight">
                Immutable Quality Logs
              </h2>
              <p className="text-white/50 text-base md:text-lg leading-relaxed">
                Every decision, every score, every guideline access is cryptographically signed.
                Sovereign healthcare data at your fingertips.
              </p>
              <div className="pt-4 flex gap-10">
                <div>
                  <div className="text-3xl font-['Instrument_Serif'] italic">100%</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">
                    Audit Accuracy
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-['Instrument_Serif'] italic">Zero</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">
                    PHI Disclosure
                  </div>
                </div>
              </div>
              <Link
                to="/urv"
                className="group inline-flex items-center gap-2 font-medium pt-2 transition-colors"
                style={{ color: 'hsl(var(--aurora-green))' }}
              >
                Explore URV Blockchain
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer micro */}
        <footer className="border-t border-white/5 mt-12 py-10 px-6 text-center text-xs text-white/40">
          <p>
            UHS Health OS · Sovereign healthcare infrastructure ·{' '}
            <Link to="/about" className="hover:text-white/70 underline">
              Open Source Manifest
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
