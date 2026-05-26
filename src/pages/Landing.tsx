import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/ui/language-selector';
import { UHSLogo, UHSLogoMark } from '@/components/brand/UHSLogo';
import { TrustBadge, TrustBadgeGroup, PrivacyPromise } from '@/components/brand/TrustBadges';
import { FeatureCard, FeatureGrid, StatHighlight } from '@/components/brand/FeatureCard';
import { KnowledgeSearch, KnowledgeStats } from '@/components/landing/KnowledgeSearch';
import { AlphaCTASection, AlphaInvite } from '@/components/landing/AlphaInvite';
import {
  Shield, Activity, Users, ArrowRight, Lock, Link2, Fingerprint,
  FileCheck, Blocks, Heart, Brain, Sparkles, CheckCircle, Zap, Globe, BookOpen, Search,
  Layers, GitBranch, ShieldCheck, Database, Code2, MessageSquare,
} from 'lucide-react';

const featureIcons = [Shield, Link2, Activity, Fingerprint, Brain, BookOpen, Sparkles];
const featureHrefs = ['/about', '/urv', '/scores', '/about', '/ai-assistant', '/learn', '/ai-research'];

const stats = [
  { value: '100%', label: 'Privacy Compliant', icon: Shield },
  { value: '0', label: 'PHI On-Chain', icon: Lock },
  { value: '∞', label: 'Audit History', icon: FileCheck },
  { value: '24/7', label: 'AI-Powered', icon: Zap },
];

const archIcons = [Code2, Brain, Link2, Database, ShieldCheck];
const archColors = ['text-primary', 'text-[hsl(42_85%_55%)]', 'text-[hsl(165_60%_48%)]', 'text-[hsl(280_55%_55%)]', 'text-destructive'];

export default function Landing() {
  const { t } = useTranslation();
  const [showAlphaInvite, setShowAlphaInvite] = useState(false);

  const features = (t('landingFull.featuresSec.items', { returnObjects: true }) as Array<{ title: string; description: string; badge?: string }>).map((it, i) => ({
    ...it,
    icon: featureIcons[i],
    href: featureHrefs[i],
  }));

  const solutionItems = t('landingFull.knowledge.solutionItems', { returnObjects: true }) as Array<{ strong: string; text: string }>;
  const problemItems = t('landingFull.knowledge.problemItems', { returnObjects: true }) as string[];
  const manifestoBadges = t('landingFull.manifesto.badges', { returnObjects: true }) as string[];
  const mvpItems = t('landingFull.roadmap.mvpItems', { returnObjects: true }) as string[];
  const fhirItems = t('landingFull.roadmap.fhirItems', { returnObjects: true }) as string[];
  const consentItems = t('landingFull.roadmap.consentItems', { returnObjects: true }) as string[];
  const archLayers = (t('landingFull.roadmap.archLayers', { returnObjects: true }) as Array<{ label: string; desc: string }>).map((l, i) => ({
    ...l,
    icon: archIcons[i],
    color: archColors[i],
  }));

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 uhs-glass border-b border-border/30">
        <div className="container mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-2">
          <UHSLogo size="sm" />
          <div className="flex items-center gap-1 md:gap-2">
            <LanguageSelector variant="minimal" />
            <Link to="/learn">
              <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
                <BookOpen className="h-4 w-4" /> <span className="hidden lg:inline">{t('nav.library')}</span>
              </Button>
            </Link>
            <Link to="/scores">
              <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
                <Activity className="h-4 w-4" /> <span className="hidden lg:inline">{t('nav.calculators')}</span>
              </Button>
            </Link>
            <Link to="/about" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
                <Shield className="h-4 w-4" /> <span className="hidden lg:inline">{t('nav.about')}</span>
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" size="sm">{t('common.login')}</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="gap-2 bg-gradient-to-r from-primary to-[hsl(165_60%_48%)] hover:opacity-90 shadow-md">
                <span className="hidden sm:inline">{t('common.getStarted')}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative pt-28 pb-24 px-6 overflow-hidden">
        <div className="absolute top-16 left-[10%] w-[500px] h-[500px] bg-primary/8 rounded-full blur-[100px] hero-blob" />
        <div className="absolute bottom-0 right-[5%] w-[600px] h-[600px] bg-[hsl(42_85%_55%)]/6 rounded-full blur-[120px] hero-blob-2" />
        <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] bg-[hsl(280_55%_55%)]/4 rounded-full blur-[80px] hero-blob" />

        <div className="absolute top-32 left-[20%] w-2 h-2 rounded-full bg-primary/40 particle" />
        <div className="absolute top-48 right-[25%] w-3 h-3 rounded-full bg-[hsl(42_85%_55%)]/30 particle" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-[35%] w-2 h-2 rounded-full bg-primary/30 particle" style={{ animationDelay: '2s' }} />
        <div className="absolute top-64 left-[75%] w-1.5 h-1.5 rounded-full bg-[hsl(165_60%_48%)]/50 particle" style={{ animationDelay: '0.5s' }} />

        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center">
            <div className="flex flex-wrap justify-center gap-3 mb-8 fade-up-stagger">
              <TrustBadge variant="privacy" size="md" />
              <TrustBadge variant="blockchain" size="md" />
              <TrustBadge variant="consent" size="md" />
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground mb-6 leading-[1.05] scale-in">
              <span className="text-shine">{t('landing.hero.title')}</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed animate-in" style={{ animationDelay: '0.2s' }}>
              {t('landing.hero.description')}
            </p>

            <div className="max-w-2xl mx-auto mb-10 animate-in" style={{ animationDelay: '0.3s' }}>
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-[hsl(42_85%_55%)]/20 to-primary/20 rounded-2xl blur-lg opacity-60" />
                <div className="relative">
                  <KnowledgeSearch size="large" />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 animate-in" style={{ animationDelay: '0.4s' }}>
              <Link to="/signup">
                <Button size="lg" className="gap-2 px-8 h-13 text-base bg-gradient-to-r from-primary to-[hsl(165_60%_48%)] hover:opacity-90 shadow-lg pulse-glow">
                  <Sparkles className="h-5 w-5" /> {t('landingFull.hero.startBuilding')}
                </Button>
              </Link>
              <Link to="/ai-research">
                <Button size="lg" variant="outline" className="gap-2 px-8 h-13 text-base border-primary/40 hover:bg-primary/5 hover:border-primary/60 transition-all">
                  <Brain className="h-5 w-5" /> {t('landingFull.hero.aiResearchEngine')}
                </Button>
              </Link>
              <Link to="/knowledge">
                <Button size="lg" variant="ghost" className="gap-2 px-8 h-13 text-base hover:bg-accent">
                  <BookOpen className="h-5 w-5" /> {t('landingFull.hero.exploreKnowledge')}
                </Button>
              </Link>
            </div>

            <div className="mb-14 flex flex-wrap justify-center gap-3 animate-in" style={{ animationDelay: '0.5s' }}>
              <Link to="/learn">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
                  <BookOpen className="h-4 w-4" /> {t('landingFull.hero.qLibrary')} <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Link to="/scores">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
                  <Activity className="h-4 w-4" /> {t('landingFull.hero.qCalculators')} <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Link to="/reumato">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
                  <Heart className="h-4 w-4" /> {t('landingFull.hero.qRheumatology')} <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Link to="/urv">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
                  <Blocks className="h-4 w-4" /> {t('landingFull.hero.qUrv')} <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto fade-up-stagger">
              {stats.map((stat) => (
                <StatHighlight key={stat.label} {...stat} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Knowledge Revolution ── */}
      <section className="py-28 px-6 bg-muted/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] hero-blob-2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[hsl(42_85%_55%)]/5 rounded-full blur-[100px] hero-blob" />

        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-semibold mb-6 glow-ring">
              <Sparkles className="h-4 w-4" />
              {t('landingFull.knowledge.badge')}
            </div>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              {t('landingFull.knowledge.titlePre')}{' '}
              <span className="text-shine">{t('landingFull.knowledge.titleAccent')}</span>
              <br />
              <span className="text-2xl md:text-4xl text-muted-foreground font-medium">{t('landingFull.knowledge.titleSub')}</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {t('landingFull.knowledge.lead')}{' '}
              <strong className="text-foreground">{t('landingFull.knowledge.leadStrong')}</strong>
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="uhs-card-elevated p-8 hover:scale-[1.01] transition-transform duration-300">
              <div className="text-destructive/80 font-semibold text-sm uppercase tracking-widest mb-4">{t('landingFull.knowledge.problemLabel')}</div>
              <h3 className="text-xl font-bold mb-4">{t('landingFull.knowledge.problemTitle')}</h3>
              <ul className="space-y-3 text-muted-foreground">
                {problemItems.map((text) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="text-destructive mt-1 text-lg">✗</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="uhs-card-elevated p-8 border-primary/30 relative overflow-hidden hover:scale-[1.01] transition-transform duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent" />
              <div className="relative">
                <div className="text-primary font-semibold text-sm uppercase tracking-widest mb-4">{t('landingFull.knowledge.solutionLabel')}</div>
                <h3 className="text-xl font-bold mb-4">{t('landingFull.knowledge.solutionTitle')}</h3>
                <ul className="space-y-3 text-muted-foreground">
                  {solutionItems.map(({ strong, text }) => (
                    <li key={strong} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <span><strong className="text-foreground">{strong}</strong> {text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center mb-12 p-10 rounded-3xl bg-gradient-to-r from-primary/5 via-transparent to-[hsl(42_85%_55%)]/5 border border-border/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/2 to-[hsl(42_85%_55%)]/2" />
            <blockquote className="relative text-xl md:text-2xl font-medium text-foreground italic mb-4 leading-relaxed">
              {t('landingFull.knowledge.quote')}
            </blockquote>
            <p className="relative text-muted-foreground">
              {t('landingFull.knowledge.quoteFooterPre')} <strong className="text-foreground">{t('landingFull.knowledge.quoteFooterAccent')}</strong> {t('landingFull.knowledge.quoteFooterPost')}
            </p>
          </div>

          <div className="uhs-card-elevated p-8">
            <KnowledgeStats />
            <div className="mt-8 text-center">
              <Link to="/knowledge">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-[hsl(165_60%_48%)] hover:opacity-90 shadow-lg">
                  <Search className="h-5 w-5" /> {t('landingFull.knowledge.cta')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Manifesto ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-[hsl(170_25%_12%)] to-[hsl(170_28%_6%)] text-[hsl(160_15%_92%)] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-white/5 rotate-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/3 rotate-slow" style={{ animationDirection: 'reverse', animationDuration: '30s' }} />

        <div className="container mx-auto max-w-4xl text-center relative">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 text-white/90 text-sm font-semibold mb-8 backdrop-blur-sm">
            <Heart className="h-4 w-4 text-[hsl(0_70%_65%)]" />
            {t('landingFull.manifesto.badge')}
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-8">
            {t('landingFull.manifesto.titlePre')}{' '}
            <span className="text-[hsl(168_55%_55%)]">{t('landingFull.manifesto.titleAccent')}</span>
          </h2>

          <div className="space-y-6 text-lg text-white/70 leading-relaxed max-w-3xl mx-auto">
            <p>{t('landingFull.manifesto.p1')}</p>
            <p>
              {t('landingFull.manifesto.p2Pre')} <strong className="text-white">{t('landingFull.manifesto.p2Strong1')}</strong>{' '}
              {t('landingFull.manifesto.p2Mid')} <strong className="text-white">{t('landingFull.manifesto.p2Strong2')}</strong>{t('landingFull.manifesto.p2Post')}
            </p>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-4 fade-up-stagger">
            {manifestoBadges.map((label) => (
              <div key={label} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm backdrop-blur-sm">
                <CheckCircle className="h-4 w-4 text-[hsl(158_55%_55%)]" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="py-28 px-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[150px]" />

        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-semibold mb-6">
              <Zap className="h-4 w-4" /> {t('landingFull.featuresSec.badge')}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t('landingFull.featuresSec.titlePre')} <span className="text-shine">{t('landingFull.featuresSec.titleAccent')}</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              {t('landingFull.featuresSec.lead')}
            </p>
          </div>

          <div className="fade-up-stagger">
            <FeatureGrid columns={3}>
              {features.map((feature) => (
                <FeatureCard key={feature.title} {...feature} gradient />
              ))}
            </FeatureGrid>
          </div>
        </div>
      </section>

      {/* ── Roadmap ── */}
      <section className="py-28 px-6 bg-muted/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/4 rounded-full blur-[120px] hero-blob" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[hsl(42_85%_55%)]/4 rounded-full blur-[100px] hero-blob-2" />

        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-semibold mb-6 glow-ring">
              <GitBranch className="h-4 w-4" />
              {t('landingFull.roadmap.badge')}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t('landingFull.roadmap.titlePre')} <span className="text-shine">{t('landingFull.roadmap.titleAccent')}</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              {t('landingFull.roadmap.lead')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {/* MVP */}
            <div className="uhs-card-elevated p-8 hover:scale-[1.01] transition-transform duration-300 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-primary uppercase tracking-widest">{t('landingFull.roadmap.mvpPhase')}</div>
                    <h3 className="text-lg font-bold">{t('landingFull.roadmap.mvpTitle')}</h3>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{t('landingFull.roadmap.mvpDesc')}</p>
                <ul className="space-y-2">
                  {mvpItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* FHIR */}
            <div className="uhs-card-elevated p-8 hover:scale-[1.01] transition-transform duration-300 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(42_85%_55%)]/3 to-transparent" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(42_85%_55%)]/10 flex items-center justify-center">
                    <Link2 className="h-5 w-5 text-[hsl(42_85%_55%)]" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[hsl(42_85%_55%)] uppercase tracking-widest">{t('landingFull.roadmap.fhirLabel')}</div>
                    <h3 className="text-lg font-bold">{t('landingFull.roadmap.fhirTitle')}</h3>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                  {t('landingFull.roadmap.fhirDescPre')}{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">Patient</code>,{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">Observation</code>,{' '}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">Encounter</code>{' '}
                  {t('landingFull.roadmap.fhirDescMid')}
                </p>
                <ul className="space-y-2">
                  {fhirItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-[hsl(42_85%_55%)] mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Consent */}
            <div className="uhs-card-elevated p-8 hover:scale-[1.01] transition-transform duration-300 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(280_55%_55%)]/3 to-transparent" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(280_55%_55%)]/10 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-[hsl(280_55%_55%)]" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[hsl(280_55%_55%)] uppercase tracking-widest">{t('landingFull.roadmap.consentLabel')}</div>
                    <h3 className="text-lg font-bold">{t('landingFull.roadmap.consentTitle')}</h3>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{t('landingFull.roadmap.consentDesc')}</p>
                <ul className="space-y-2">
                  {consentItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-[hsl(280_55%_55%)] mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Architecture */}
            <div className="uhs-card-elevated p-8 hover:scale-[1.01] transition-transform duration-300 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(165_60%_48%)]/3 to-transparent" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(165_60%_48%)]/10 flex items-center justify-center">
                    <Layers className="h-5 w-5 text-[hsl(165_60%_48%)]" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[hsl(165_60%_48%)] uppercase tracking-widest">{t('landingFull.roadmap.archLabel')}</div>
                    <h3 className="text-lg font-bold">{t('landingFull.roadmap.archTitle')}</h3>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mb-5 leading-relaxed">{t('landingFull.roadmap.archDesc')}</p>
                <div className="space-y-2">
                  {archLayers.map(({ icon: Icon, label, desc, color }) => (
                    <div key={label} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                      <span className="text-xs font-medium text-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center p-10 rounded-3xl bg-gradient-to-r from-primary/5 via-transparent to-[hsl(42_85%_55%)]/5 border border-border/50">
            <MessageSquare className="h-8 w-8 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">{t('landingFull.roadmap.ctaTitle')}</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xl mx-auto">{t('landingFull.roadmap.ctaDesc')}</p>
            <a href="https://github.com/JoaoRG-lab/rhema-care-flow/discussions/15" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2 border-primary/40 hover:border-primary/70">
                <GitBranch className="h-4 w-4" />
                {t('landingFull.roadmap.ctaBtn')}
              </Button>
            </a>
          </div>
        </div>
      </section>

      <AlphaCTASection onOpenInvite={() => setShowAlphaInvite(true)} />

      {/* ── Privacy ── */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="uhs-card-elevated p-8 md:p-12 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/5 rounded-full blur-[60px]" />
            <div className="grid md:grid-cols-2 gap-12 items-center relative">
              <div>
                <UHSLogoMark className="w-16 h-16 mb-6 float-slow" />
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  {t('landingFull.privacy.titlePre')} <span className="gradient-text">{t('landingFull.privacy.titleAccent')}</span>
                </h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">{t('landingFull.privacy.body')}</p>
                <TrustBadgeGroup badges={['privacy', 'encrypted', 'audit']} size="sm" />
              </div>
              <div>
                <PrivacyPromise />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-28 px-6 hero-pattern relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent" />
        <div className="container mx-auto max-w-3xl text-center relative">
          <div className="mb-8">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center pulse-glow">
              <Globe className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {t('landingFull.finalCta.titlePre')}{' '}
            <span className="text-shine">{t('landingFull.finalCta.titleAccent')}</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">{t('landingFull.finalCta.lead')}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="gap-2 px-10 h-14 text-lg bg-gradient-to-r from-primary to-[hsl(165_60%_48%)] hover:opacity-90 shadow-xl pulse-glow">
                {t('landingFull.finalCta.primary')} <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" onClick={() => setShowAlphaInvite(true)} className="gap-2 px-10 h-14 text-lg border-primary/30 hover:border-primary/60">
              <Users className="h-5 w-5" /> {t('landingFull.finalCta.alpha')}
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-6 border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <UHSLogo size="sm" showText={false} />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">© {new Date().getFullYear()} UHS Health OS</p>
                <p className="text-xs">{t('landingFull.footer.tag')}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link to="/reumato" className="hover:text-primary transition-colors">{t('landingFull.footer.reumato')}</Link>
              <Link to="/knowledge" className="hover:text-primary transition-colors">{t('landingFull.footer.knowledge')}</Link>
              <Link to="/learn" className="hover:text-primary transition-colors">{t('landingFull.footer.learn')}</Link>
              <Link to="/urv" className="hover:text-primary transition-colors">{t('landingFull.footer.urv')}</Link>
            </div>
            <TrustBadgeGroup badges={['privacy', 'blockchain']} size="sm" />
          </div>
          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground max-w-2xl mx-auto">{t('landingFull.footer.disclaimer')}</p>
          </div>
        </div>
      </footer>

      <AlphaInvite open={showAlphaInvite} onOpenChange={setShowAlphaInvite} />
    </div>
  );
}
