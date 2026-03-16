'use client';

import { useState } from 'react';
import Image from 'next/image';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface ScanResult {
  name: string;
  address: string;
  website: string;
  rating: number;
  reviews: number;
  score: number;
  issues: string[];
}

/* ── Scanner Demo ──────────────────────────────────────────────────────────── */

function Scanner() {
  const [city, setCity] = useState('Kolkata');
  const [type, setType] = useState('restaurants');
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const types = ['restaurants','salons','hotels','gyms','clinics','dentists','bakeries','boutiques','photographers','spas'];

  async function scan() {
    setLoading(true); setDone(false);
    try {
      const res = await fetch(`/api/scan?city=${encodeURIComponent(city)}&type=${encodeURIComponent(type)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch { setResults([]); }
    setDone(true); setLoading(false);
  }

  const barColor = (s: number) => s >= 40 ? '#dc2626' : s >= 20 ? '#ca8a04' : '#15803d';

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--data-bg)' }}>
      {/* Terminal-style header */}
      <div className="px-5 py-3 flex items-center gap-2 border-b" style={{ borderColor: 'var(--data-border)' }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-xs font-mono ml-2" style={{ color: 'var(--data-muted)' }}>reachright scanner v1.0</span>
      </div>

      {/* Search controls */}
      <div className="p-5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono" style={{ color: 'var(--data-muted)' }}>city:</span>
            <input
              type="text" value={city} onChange={e => setCity(e.target.value)}
              className="w-full rounded-lg px-3 pl-12 py-2.5 text-sm font-mono border focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              style={{ background: 'var(--data-surface)', borderColor: 'var(--data-border)', color: 'var(--data-text)' }}
            />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono" style={{ color: 'var(--data-muted)' }}>type:</span>
            <select value={type} onChange={e => setType(e.target.value)}
              className="rounded-lg pl-12 pr-4 py-2.5 text-sm font-mono border focus:outline-none appearance-none cursor-pointer"
              style={{ background: 'var(--data-surface)', borderColor: 'var(--data-border)', color: 'var(--data-text)' }}>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={scan} disabled={loading || !city}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 cursor-pointer"
            style={{ background: 'var(--accent)' }}>
            {loading ? '● Scanning...' : '→ Scan'}
          </button>
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="text-center py-10">
          <div className="inline-block w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <p className="mt-2 text-xs font-mono" style={{ color: 'var(--data-muted)' }}>querying google maps for {type} in {city}...</p>
        </div>
      )}

      {done && results.length > 0 && (
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-mono" style={{ color: 'var(--data-muted)' }}>
              {results.length} results — sorted by opportunity score ↓
            </p>
            <p className="text-xs font-mono" style={{ color: 'var(--data-muted)' }}>
              {results.filter(r => r.website === 'NONE').length} without website
            </p>
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-[1fr_80px_80px_100px] gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--data-muted)' }}>
              <span>Business</span>
              <span className="text-right">Rating</span>
              <span className="text-right">Reviews</span>
              <span className="text-right">Score</span>
            </div>
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i}
                  className="grid grid-cols-[1fr_80px_80px_100px] gap-2 items-center px-3 py-2.5 rounded-lg transition-colors animate-reveal"
                  style={{ background: i % 2 === 0 ? 'var(--data-surface)' : 'transparent', animationDelay: `${i * 0.03}s` }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--data-text)' }}>{r.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {r.website === 'NONE' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold" style={{ background: '#dc262620', color: '#f87171' }}>NO SITE</span>
                      )}
                      {r.issues.slice(0, 2).map((issue, j) => (
                        <span key={j} className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--data-border)', color: 'var(--data-muted)' }}>{issue}</span>
                      ))}
                    </div>
                  </div>
                  <span className="text-right text-sm font-mono" style={{ color: r.rating >= 4 ? '#4ade80' : r.rating >= 3 ? '#fbbf24' : '#f87171' }}>{r.rating || '—'}</span>
                  <span className="text-right text-sm font-mono" style={{ color: 'var(--data-muted)' }}>{r.reviews.toLocaleString()}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--data-border)' }}>
                      <div className="h-full rounded-full score-bar" style={{ width: `${Math.min(r.score, 100)}%`, background: barColor(r.score) }} />
                    </div>
                    <span className="text-xs font-mono font-bold w-6 text-right" style={{ color: barColor(r.score) }}>{r.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: card layout */}
          <div className="sm:hidden space-y-2">
            {results.map((r, i) => (
              <div key={i} className="rounded-lg p-3 animate-reveal"
                style={{ background: 'var(--data-surface)', animationDelay: `${i * 0.03}s` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--data-text)' }}>{r.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs font-mono" style={{ color: 'var(--data-muted)' }}>
                      <span style={{ color: r.rating >= 4 ? '#4ade80' : '#fbbf24' }}>★ {r.rating || '—'}</span>
                      <span>{r.reviews.toLocaleString()} reviews</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--data-border)' }}>
                      <div className="h-full rounded-full score-bar" style={{ width: `${Math.min(r.score, 100)}%`, background: barColor(r.score) }} />
                    </div>
                    <span className="text-xs font-mono font-bold" style={{ color: barColor(r.score) }}>{r.score}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.website === 'NONE' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold" style={{ background: '#dc262620', color: '#f87171' }}>NO SITE</span>
                  )}
                  {r.issues.slice(0, 2).map((issue, j) => (
                    <span key={j} className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--data-border)', color: 'var(--data-muted)' }}>{issue}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {done && results.length === 0 && (
        <p className="text-center py-10 text-sm font-mono" style={{ color: 'var(--data-muted)' }}>No results. Try a different city or type.</p>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ background: 'var(--bg)', borderColor: 'var(--border)', backgroundColor: 'rgba(250,248,245,0.85)' }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="ReachRight" width={28} height={28} className="rounded-md" />
            <span className="font-semibold text-[15px] tracking-tight" style={{ color: 'var(--text)' }}>ReachRight</span>
          </a>
          <div className="flex items-center gap-5 text-[13px]">
            <a href="#scanner" className="hidden sm:block transition-colors" style={{ color: 'var(--text-secondary)' }}>Scanner</a>
            <a href="#how" className="hidden sm:block transition-colors" style={{ color: 'var(--text-secondary)' }}>How it works</a>
            <a href="#pricing" className="hidden sm:block transition-colors" style={{ color: 'var(--text-secondary)' }}>Pricing</a>
            <a href="https://wa.me/918777685015?text=Hi%2C%20I%20want%20a%20free%20audit%20for%20my%20business" target="_blank"
              className="px-4 py-1.5 text-white text-[13px] font-semibold rounded-lg transition-all"
              style={{ background: 'var(--accent)' }}>
              Free Audit
            </a>
          </div>
        </div>
      </nav>

      {/* Hero — editorial style, serif headline */}
      <section className="pt-20 sm:pt-28 pb-16 px-6 dot-grid relative">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-6 animate-reveal">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
            <span className="text-xs font-mono tracking-wide" style={{ color: 'var(--text-muted)' }}>321 businesses scanned in Kolkata today</span>
          </div>

          <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.08] tracking-tight animate-reveal" style={{ animationDelay: '0.06s', color: 'var(--text)' }}>
            Half the businesses<br />in your city are<br />
            <em className="not-italic" style={{ color: 'var(--accent)' }}>invisible online.</em>
          </h1>

          <p className="mt-6 text-lg leading-relaxed max-w-xl animate-reveal" style={{ animationDelay: '0.12s', color: 'var(--text-secondary)' }}>
            We scan Google Maps, find businesses with no website or weak presence, and help them get found by customers who are already searching.
          </p>

          <div className="mt-8 flex flex-wrap gap-3 animate-reveal" style={{ animationDelay: '0.18s' }}>
            <a href="#scanner"
              className="px-5 py-2.5 text-white font-semibold text-sm rounded-lg transition-all hover:opacity-90"
              style={{ background: 'var(--accent)' }}>
              Try the Scanner ↓
            </a>
            <a href="https://wa.me/918777685015?text=Hi%2C%20I%20want%20a%20free%20audit" target="_blank"
              className="px-5 py-2.5 font-semibold text-sm rounded-lg border transition-all hover:bg-[var(--bg-alt)]"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text)' }}>
              Get Free Audit →
            </a>
          </div>

          {/* Quick stats — newspaper-style data strip */}
          <div className="mt-14 grid grid-cols-4 gap-px rounded-xl overflow-hidden animate-reveal" style={{ animationDelay: '0.24s', background: 'var(--border)' }}>
            {[
              { num: '321', label: 'Scanned' },
              { num: '88', label: 'No Website' },
              { num: '27%', label: 'Missing Online' },
              { num: '16', label: 'Categories' },
            ].map(s => (
              <div key={s.label} className="py-4 text-center" style={{ background: 'var(--surface)' }}>
                <p className="text-2xl sm:text-3xl font-mono font-bold" style={{ color: 'var(--text)' }}>{s.num}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scanner — the hero product */}
      <section id="scanner" className="py-16 px-6" style={{ background: 'var(--bg-alt)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="font-display text-3xl sm:text-4xl" style={{ color: 'var(--text)' }}>Live Scanner</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Enter any city. See which businesses are invisible to their customers.
            </p>
          </div>
          <Scanner />
        </div>
      </section>

      {/* How it works — clean editorial */}
      <section id="how" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl mb-12" style={{ color: 'var(--text)' }}>How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 stagger">
            {[
              { num: '01', title: 'Scan', body: 'Our AI scans Google Maps across your city. We find every business with no website, poor ratings, missing photos, or incomplete profiles.' },
              { num: '02', title: 'Build', body: 'We create a professional website, optimize your Google Business listing, add photos, fix your hours, and set up WhatsApp ordering.' },
              { num: '03', title: 'Grow', body: 'Customers find you when they search. More walk-ins, more calls, more orders. We send you a monthly report showing the growth.' },
            ].map(step => (
              <div key={step.num}>
                <span className="text-xs font-mono font-bold" style={{ color: 'var(--accent)' }}>{step.num}</span>
                <h3 className="text-xl font-semibold mt-2 mb-3" style={{ color: 'var(--text)' }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof / data callout */}
      <section className="py-16 px-6 border-y relative noise" style={{ background: 'var(--data-bg)', borderColor: 'var(--data-border)' }}>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <p className="font-display text-3xl sm:text-4xl italic" style={{ color: 'var(--data-text)' }}>
            &ldquo;Peter Cat has 39,806 Google reviews<br />and no website.&rdquo;
          </p>
          <p className="mt-4 text-sm font-mono" style={{ color: 'var(--data-muted)' }}>
            One of Kolkata&apos;s most famous restaurants. Found by our scanner.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl mb-3" style={{ color: 'var(--text)' }}>Pricing</h2>
          <p className="text-sm mb-12" style={{ color: 'var(--text-secondary)' }}>Start with a free audit. Upgrade when you see the results.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-2xl overflow-hidden stagger" style={{ background: 'var(--border)' }}>
            {[
              {
                name: 'Audit', price: 'Free', desc: 'See where you stand',
                features: ['Full web presence report', 'Google profile review', 'Competitor comparison', '5 actionable fixes'],
                cta: 'Get Free Audit', primary: false,
              },
              {
                name: 'Growth', price: '₹4,999/mo', desc: 'Complete digital presence',
                features: ['Professional website', 'Google Business setup', 'Monthly SEO updates', 'Review management', 'WhatsApp integration', 'Monthly report'],
                cta: 'Start Growing', primary: true,
              },
              {
                name: 'Agency', price: '₹9,999/mo', desc: 'For marketing agencies',
                features: ['50 leads per week', 'Auto-generated demos', 'Custom outreach', 'White-label ready', 'API access', 'Priority support'],
                cta: 'Contact Us', primary: false,
              },
            ].map(plan => (
              <div key={plan.name} className="p-6 flex flex-col" style={{ background: plan.primary ? 'var(--accent-soft)' : 'var(--surface)' }}>
                <div className="mb-5">
                  <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: plan.primary ? 'var(--accent)' : 'var(--text-muted)' }}>{plan.name}</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{plan.price}</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{plan.desc}</p>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--success)' }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <a href={`https://wa.me/918777685015?text=Hi%2C%20interested%20in%20${plan.name}%20plan`} target="_blank"
                  className="block text-center py-2.5 rounded-lg font-semibold text-sm transition-all"
                  style={plan.primary
                    ? { background: 'var(--accent)', color: 'white' }
                    : { border: '1px solid var(--border-strong)', color: 'var(--text)' }
                  }>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6" style={{ background: 'var(--bg-alt)' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl mb-4" style={{ color: 'var(--text)' }}>
            Your customers are searching.<br />Can they find you?
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Get a free audit of your business&apos;s online presence in 24 hours.
          </p>
          <a href="https://wa.me/918777685015?text=Hi%2C%20I%20want%20a%20free%20audit%20for%20my%20business" target="_blank"
            className="inline-block px-6 py-3 text-white font-semibold rounded-lg transition-all hover:opacity-90"
            style={{ background: 'var(--accent)' }}>
            Get Free Audit on WhatsApp →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="ReachRight" width={20} height={20} className="rounded" />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>ReachRight</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>AI-powered growth for local businesses</p>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <a href="https://wa.me/918777685015" target="_blank" className="hover:underline">WhatsApp</a>
            <a href="mailto:hello@reachright.app" className="hover:underline">Email</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
