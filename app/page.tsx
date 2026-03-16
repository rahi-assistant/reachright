'use client';

import { useState } from 'react';

// ── Scanner Demo Component ─────────────────────────────────────────────────────

interface ScanResult {
  name: string;
  address: string;
  website: string;
  rating: number;
  reviews: number;
  score: number;
  issues: string[];
}

function LiveDemo() {
  const [city, setCity] = useState('Kolkata');
  const [type, setType] = useState('restaurants');
  const [results, setResults] = useState<ScanResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const businessTypes = [
    'restaurants', 'salons', 'hotels', 'gyms', 'clinics',
    'dentists', 'bakeries', 'boutiques', 'photographers', 'spas',
  ];

  async function runScan() {
    setLoading(true);
    setScanned(false);
    try {
      const res = await fetch(`/api/scan?city=${encodeURIComponent(city)}&type=${encodeURIComponent(type)}`);
      const data = await res.json();
      setResults(data.results || []);
      setScanned(true);
    } catch {
      setResults([]);
      setScanned(true);
    }
    setLoading(false);
  }

  const scoreColor = (s: number) =>
    s >= 40 ? 'text-[#f43f5e]' : s >= 20 ? 'text-[#f59e0b]' : 'text-[#10b981]';
  const scoreBarColor = (s: number) =>
    s >= 40 ? 'bg-[#f43f5e]' : s >= 20 ? 'bg-[#f59e0b]' : 'bg-[#10b981]';

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={city}
          onChange={e => setCity(e.target.value)}
          placeholder="City name..."
          className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        >
          {businessTypes.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <button
          onClick={runScan}
          disabled={loading || !city}
          className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-light)] disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer"
        >
          {loading ? 'Scanning...' : 'Scan Now'}
        </button>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-[var(--muted)]">Scanning {type} in {city}...</p>
        </div>
      )}

      {scanned && results && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--muted)] mb-3 font-mono">
            Found {results.length} businesses — sorted by opportunity score
          </p>
          {results.map((r, i) => (
            <div
              key={i}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)]/30 transition-colors animate-fade-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">{r.name}</h3>
                    <span className={`text-xs font-mono font-bold ${scoreColor(r.score)}`}>{r.score}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] truncate">{r.address}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[var(--muted)]">
                    <span>★ {r.rating || '—'}</span>
                    <span>{r.reviews} reviews</span>
                    <span className={r.website === 'NONE' ? 'text-[#f43f5e] font-semibold' : ''}>
                      {r.website === 'NONE' ? 'No website' : 'Has website'}
                    </span>
                  </div>
                </div>
                <div className="w-20 flex-shrink-0">
                  <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full score-bar ${scoreBarColor(r.score)}`} style={{ width: `${Math.min(r.score, 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-[var(--muted)] text-center mt-1">opportunity</p>
                </div>
              </div>
              {r.issues.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {r.issues.map((issue, j) => (
                    <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)]">{issue}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {scanned && results && results.length === 0 && (
        <p className="text-center py-12 text-sm text-[var(--muted)]">No results found. Try a different city or business type.</p>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen bg-grid">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <span className="text-white font-bold text-xs">R</span>
            </div>
            <span className="font-semibold text-[var(--foreground)] tracking-tight">ReachRight</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a href="#how" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors hidden sm:block">How it works</a>
            <a href="#demo" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors hidden sm:block">Live Demo</a>
            <a href="#pricing" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors hidden sm:block">Pricing</a>
            <a href="https://wa.me/918777685015?text=Hi%2C%20I%20want%20a%20free%20web%20presence%20audit" target="_blank"
              className="px-4 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white text-sm font-medium rounded-lg transition-all">
              Free Audit
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted)] mb-6 animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
            Scanning 321 businesses in Kolkata
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-[var(--foreground)] leading-[1.1] animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Your customers are<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[var(--accent-light)]">searching for you</span>
            <br />online.
          </h1>
          <p className="mt-6 text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed animate-fade-up" style={{ animationDelay: '0.2s' }}>
            50% of local businesses in Kolkata have no website. We use AI to find them, build their online presence, and bring them more customers.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <a href="#demo" className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white font-semibold rounded-xl transition-all glow-accent">
              Try Live Scanner
            </a>
            <a href="https://wa.me/918777685015?text=Hi%2C%20I%20want%20a%20free%20web%20presence%20audit" target="_blank"
              className="px-6 py-3 border border-[var(--border)] hover:border-[var(--accent)] text-[var(--foreground)] font-semibold rounded-xl transition-all">
              Free Audit →
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[var(--border)] bg-[var(--surface)]/50">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center stagger">
          {[
            { value: '321', label: 'Businesses Scanned', sub: 'in Kolkata' },
            { value: '27%', label: 'Have No Website', sub: '88 businesses' },
            { value: '50%', label: 'Weak Presence', sub: 'score > 20' },
            { value: '16', label: 'Categories', sub: 'restaurants to spas' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-[var(--foreground)] font-mono">{s.value}</p>
              <p className="text-sm text-[var(--muted)] mt-1">{s.label}</p>
              <p className="text-xs text-[var(--muted)]/60">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[var(--foreground)] mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger">
            {[
              { step: '01', title: 'We Scan', desc: 'Our AI scans Google Maps to find businesses with weak online presence — no website, poor reviews, missing photos.', icon: '🔍' },
              { step: '02', title: 'We Build', desc: 'We create a professional website, optimize your Google Business Profile, and set up your digital presence in days.', icon: '🛠️' },
              { step: '03', title: 'You Grow', desc: 'More customers find you online. Better reviews. More walk-ins. We track everything with monthly reports.', icon: '📈' },
            ].map(item => (
              <div key={item.step} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--accent)]/30 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs font-mono text-[var(--accent)]">STEP {item.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Demo */}
      <section id="demo" className="py-20 px-6 bg-[var(--surface)]/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[var(--foreground)]">Live Scanner</h2>
            <p className="mt-2 text-[var(--muted)]">See which businesses near you need help — powered by Google Maps AI.</p>
          </div>
          <LiveDemo />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[var(--foreground)] mb-4">Simple Pricing</h2>
          <p className="text-center text-[var(--muted)] mb-12">Start free. Pay only when you see results.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger">
            {[
              {
                name: 'Starter', price: 'Free', period: '', desc: 'See where you stand',
                features: ['Web presence audit', 'Google profile review', 'Competitor comparison', 'Improvement checklist'],
                cta: 'Get Free Audit',
                href: 'https://wa.me/918777685015?text=Hi%2C%20I%20want%20a%20free%20web%20presence%20audit',
                popular: false,
              },
              {
                name: 'Growth', price: '₹4,999', period: '/month', desc: 'Full digital presence',
                features: ['Professional website', 'Google Business optimization', 'Monthly SEO updates', 'Review management', 'WhatsApp integration', 'Monthly performance report'],
                cta: 'Get Started',
                href: 'https://wa.me/918777685015?text=Hi%2C%20I%27m%20interested%20in%20the%20Growth%20plan',
                popular: true,
              },
              {
                name: 'For Agencies', price: '₹9,999', period: '/month', desc: 'White-label lead gen',
                features: ['50 qualified leads/week', 'Auto-generated demos', 'Personalized outreach', 'Your branding', 'API access', 'Priority support'],
                cta: 'Contact Us',
                href: 'https://wa.me/918777685015?text=Hi%2C%20I%27m%20a%20digital%20agency%20interested%20in%20ReachRight',
                popular: false,
              },
            ].map(plan => (
              <div key={plan.name} className={`relative bg-[var(--surface)] border rounded-2xl p-6 flex flex-col ${plan.popular ? 'border-[var(--accent)] glow-accent' : 'border-[var(--border)]'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-full">Most Popular</div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{plan.name}</h3>
                  <p className="text-sm text-[var(--muted)] mt-1">{plan.desc}</p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-[var(--foreground)]">{plan.price}</span>
                    <span className="text-sm text-[var(--muted)]">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                      <span className="text-[var(--success)] mt-0.5">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <a href={plan.href} target="_blank"
                  className={`block text-center py-2.5 rounded-xl font-semibold text-sm transition-all ${plan.popular ? 'bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white' : 'border border-[var(--border)] hover:border-[var(--accent)] text-[var(--foreground)]'}`}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[var(--accent)] flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">R</span>
            </div>
            <span className="text-sm text-[var(--muted)]">ReachRight</span>
          </div>
          <p className="text-xs text-[var(--muted)]">AI-powered growth for local businesses.</p>
          <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
            <a href="https://wa.me/918777685015" target="_blank" className="hover:text-[var(--foreground)]">WhatsApp</a>
            <a href="mailto:hello@reachright.app" className="hover:text-[var(--foreground)]">Email</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
