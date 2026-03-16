'use client';

import { useState } from 'react';
import Image from 'next/image';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface AuditItem {
  label: string;
  status: 'good' | 'warn' | 'bad';
  value: string;
  tip: string;
}

interface AIVisibility {
  found: boolean;
  rank: number | null;
  mentioned: string[];
  tip: string;
}

interface ReviewSentiment {
  sentiment: 'positive' | 'mixed' | 'negative' | 'none';
  strengths: string[];
  weaknesses: string[];
  tip: string;
}

interface AuditResult {
  name: string;
  address: string;
  type: string;
  mapsUrl: string;
  score: number;
  items: AuditItem[];
  summary: string;
  aiVisibility: AIVisibility | null;
  reviewSentiment: ReviewSentiment | null;
}

/* ── Audit Tool (the hero) ─────────────────────────────────────────────────── */

function AuditTool() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AuditResult[]>([]);
  const [selected, setSelected] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'search' | 'pick' | 'report'>('search');

  async function search() {
    if (!query.trim() || query.length < 3) return;
    setLoading(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/audit?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results || []);
      setStep(data.results?.length > 0 ? 'pick' : 'search');
    } catch { setResults([]); }
    setLoading(false);
  }

  function pickBusiness(r: AuditResult) {
    setSelected(r);
    setStep('report');
  }

  function reset() {
    setQuery('');
    setResults([]);
    setSelected(null);
    setStep('search');
  }

  const statusIcon = (s: string) => s === 'good' ? '✓' : s === 'warn' ? '!' : '✕';
  const statusColor = (s: string) => s === 'good' ? 'var(--success)' : s === 'warn' ? 'var(--warning)' : 'var(--danger)';
  const statusBg = (s: string) => s === 'good' ? '#15803d12' : s === 'warn' ? '#ca8a0412' : '#dc262612';

  const scoreColor = (s: number) => s >= 80 ? 'var(--success)' : s >= 50 ? 'var(--warning)' : 'var(--danger)';
  const scoreLabel = (s: number) => s >= 80 ? 'Strong' : s >= 50 ? 'Needs Work' : 'Critical';

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Step 1: Search */}
      {step === 'search' && (
        <div className="animate-reveal">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="e.g. Peter Cat Kolkata, Green Leaf Salon Mumbai..."
              className="flex-1 rounded-xl px-4 py-3.5 text-sm border focus:outline-none focus:ring-2 transition-all"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties}
            />
            <button
              onClick={search}
              disabled={loading || query.length < 3}
              className="px-6 py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap"
              style={{ background: 'var(--accent)' }}>
              {loading ? 'Searching...' : 'Check Now'}
            </button>
          </div>
          <p className="text-xs mt-2.5" style={{ color: 'var(--text-muted)' }}>
            Enter your business name and city. We&apos;ll check your Google presence and AI visibility.
          </p>
        </div>
      )}

      {/* Step 2: Pick your business from results */}
      {step === 'pick' && (
        <div className="animate-reveal">
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            Is this your business? Select it to see your report.
          </p>
          <div className="space-y-2">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => pickBusiness(r)}
                className="w-full text-left rounded-xl p-4 border transition-all hover:shadow-sm cursor-pointer"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{r.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.address}</p>
              </button>
            ))}
          </div>
          <button onClick={reset} className="mt-3 text-xs underline cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            Not here? Search again
          </button>
        </div>
      )}

      {/* Step 3: The Audit Report */}
      {step === 'report' && selected && (
        <div className="animate-reveal">
          {/* Business header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{selected.name}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{selected.address}</p>
            </div>
            <button onClick={reset} className="text-xs underline flex-shrink-0 cursor-pointer" style={{ color: 'var(--text-muted)' }}>
              Check another
            </button>
          </div>

          {/* Score circle */}
          <div className="flex items-center gap-6 p-5 rounded-2xl mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="var(--border)" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke={scoreColor(selected.score)} strokeWidth="3"
                  strokeDasharray={`${selected.score}, 100`}
                  strokeLinecap="round"
                  className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold font-mono" style={{ color: scoreColor(selected.score) }}>{selected.score}</span>
                <span className="text-[9px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>/100</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: scoreColor(selected.score) }}>{scoreLabel(selected.score)}</p>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{selected.summary}</p>
            </div>
          </div>

          {/* Audit items */}
          <div className="space-y-2 mb-6">
            {selected.items.map((item, i) => (
              <div key={i} className="rounded-xl p-4 border" style={{ background: statusBg(item.status), borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ background: statusColor(item.status) }}>
                      {statusIcon(item.status)}
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.label}</span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: statusColor(item.status) }}>{item.value}</span>
                </div>
                <p className="text-xs mt-2 ml-[30px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.tip}</p>
              </div>
            ))}
          </div>

          {/* AI Visibility Detail */}
          {selected.aiVisibility && (
            <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--data-bg)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--data-text)' }}>AI Visibility Report</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: selected.aiVisibility.found ? '#15803d25' : '#dc262625', color: selected.aiVisibility.found ? '#4ade80' : '#f87171' }}>
                  {selected.aiVisibility.found ? `Rank #${selected.aiVisibility.rank}` : 'Not Found'}
                </span>
              </div>
              <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--data-muted)' }}>
                When someone asks AI &quot;best {selected.type?.replace(/_/g, ' ') || 'business'}s in your city,&quot; here&apos;s what it recommends:
              </p>
              <div className="space-y-1">
                {selected.aiVisibility.mentioned.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono px-2 py-1 rounded"
                    style={{
                      background: name.toLowerCase().includes(selected.name.toLowerCase()) || selected.name.toLowerCase().includes(name.toLowerCase())
                        ? '#15803d15' : 'transparent',
                      color: name.toLowerCase().includes(selected.name.toLowerCase()) || selected.name.toLowerCase().includes(name.toLowerCase())
                        ? '#4ade80' : 'var(--data-muted)'
                    }}>
                    <span style={{ color: 'var(--data-muted)' }}>{i + 1}.</span>
                    <span>{name}</span>
                    {(name.toLowerCase().includes(selected.name.toLowerCase()) || selected.name.toLowerCase().includes(name.toLowerCase())) && (
                      <span className="text-[9px] px-1 rounded" style={{ background: '#15803d30', color: '#4ade80' }}>YOUR BUSINESS</span>
                    )}
                  </div>
                ))}
              </div>
              {!selected.aiVisibility.found && (
                <p className="text-xs mt-3 p-2 rounded" style={{ background: '#dc262615', color: '#fca5a5' }}>
                  Your business is not in the AI&apos;s top recommendations. As more customers use AI to search, this gap will cost you customers.
                </p>
              )}
            </div>
          )}

          {/* Review Sentiment Detail */}
          {selected.reviewSentiment && selected.reviewSentiment.sentiment !== 'none' && (
            <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>What Customers Say</p>
              {selected.reviewSentiment.strengths.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selected.reviewSentiment.strengths.map((s, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#15803d15', color: '#15803d', border: '1px solid #15803d30' }}>{s}</span>
                  ))}
                </div>
              )}
              {selected.reviewSentiment.weaknesses.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.reviewSentiment.weaknesses.map((w, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#dc262610', color: '#dc2626', border: '1px solid #dc262625' }}>{w}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Download + CTA */}
          <div className="flex gap-3 mb-6">
            <a
              href={`/api/report?q=${encodeURIComponent(selected.name + ' ' + selected.address.split(',').slice(-3).join(','))}&format=html`}
              target="_blank"
              className="flex-1 text-center py-3 rounded-xl font-semibold text-sm border transition-all"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text)' }}>
              Download Full Report
            </a>
            <a
              href={`https://wa.me/917439677931?text=${encodeURIComponent(`Hi, I just checked my business "${selected.name}" on ReachRight. Score: ${selected.score}/100. I'd like help improving my online presence.`)}`}
              target="_blank"
              className="flex-1 text-center py-3 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: 'var(--accent)' }}>
              Talk to us on WhatsApp →
            </a>
          </div>

          {/* CTA card */}
          <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--accent)', color: 'white' }}>
            <p className="text-lg font-semibold">Want us to fix this for you?</p>
            <p className="text-sm mt-1 opacity-80">We build your website, optimize your Google listing, and make AI recommend your business.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(250,248,245,0.85)' }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="ReachRight" width={28} height={28} className="rounded-md" />
            <span className="font-semibold text-[15px] tracking-tight" style={{ color: 'var(--text)' }}>ReachRight</span>
          </a>
          <div className="flex items-center gap-5 text-[13px]">
            <a href="#audit" className="hidden sm:block transition-colors" style={{ color: 'var(--text-secondary)' }}>Free Audit</a>
            <a href="#how" className="hidden sm:block transition-colors" style={{ color: 'var(--text-secondary)' }}>How it works</a>
            <a href="#pricing" className="hidden sm:block transition-colors" style={{ color: 'var(--text-secondary)' }}>Pricing</a>
            <a href="https://wa.me/917439677931?text=Hi%2C%20I%20want%20help%20with%20my%20business%20online%20presence" target="_blank"
              className="px-4 py-1.5 text-white text-[13px] font-semibold rounded-lg transition-all"
              style={{ background: 'var(--accent)' }}>
              Contact Us
            </a>
          </div>
        </div>
      </nav>

      {/* Hero — one clear message */}
      <section className="pt-20 sm:pt-28 pb-8 px-6 dot-grid">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display text-[clamp(2.2rem,5.5vw,4rem)] leading-[1.1] tracking-tight animate-reveal" style={{ color: 'var(--text)' }}>
            When someone asks AI<br />for the best in your city,<br />
            <em className="not-italic" style={{ color: 'var(--accent)' }}>do you show up?</em>
          </h1>
          <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto animate-reveal" style={{ animationDelay: '0.08s', color: 'var(--text-secondary)' }}>
            ChatGPT, Gemini, and Siri now recommend businesses. We check if AI can find yours — plus your Google presence, reviews, and website. Free. 30 seconds.
          </p>
        </div>
      </section>

      {/* Audit Tool — the product */}
      <section id="audit" className="pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <AuditTool />
        </div>
      </section>

      {/* Quick stats */}
      <section className="border-y py-8 px-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-alt)' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6 text-center">
          {[
            { num: '80%', label: 'of local businesses are invisible to AI' },
            { num: '27%', label: 'have no website at all' },
            { num: '5x', label: 'more discovery when AI recommends you' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-2xl sm:text-3xl font-bold font-mono" style={{ color: 'var(--text)' }}>{s.num}</p>
              <p className="text-[11px] sm:text-xs mt-1 leading-snug" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl text-center mb-14" style={{ color: 'var(--text)' }}>How we help</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 stagger">
            {[
              { num: '01', title: 'AI Audit', body: 'Enter your business name. We check if ChatGPT, Gemini, and Google recommend you — plus your website, reviews, photos, and ratings. Score out of 100.' },
              { num: '02', title: 'Get Visible', body: 'We build your website, optimize your Google listing, and improve your digital footprint so AI assistants start recommending you to customers.' },
              { num: '03', title: 'Stay Ahead', body: 'Monthly AI visibility reports. Track your ranking in AI recommendations. See how you compare to competitors. We keep you visible as AI evolves.' },
            ].map(step => (
              <div key={step.num} className="text-center md:text-left">
                <span className="inline-block text-xs font-mono font-bold px-2 py-0.5 rounded-md mb-3" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}>{step.num}</span>
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-14 px-6 relative noise" style={{ background: 'var(--data-bg)' }}>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <p className="font-display text-2xl sm:text-3xl italic" style={{ color: 'var(--data-text)' }}>
            &ldquo;We asked AI for the best restaurants in Kolkata.<br className="hidden sm:block" /> 80% of actual top restaurants didn&apos;t show up.&rdquo;
          </p>
          <p className="mt-4 text-sm" style={{ color: 'var(--data-muted)' }}>
            AI is the new search. If you&apos;re not in its recommendations, you&apos;re losing customers to competitors who are.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl text-center mb-3" style={{ color: 'var(--text)' }}>Pricing</h2>
          <p className="text-sm text-center mb-12" style={{ color: 'var(--text-secondary)' }}>One-time setup + affordable yearly maintenance. No hidden fees.</p>

          {/* One-time setup */}
          <div className="rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid var(--border)' }}>
            <div className="p-6 sm:p-8" style={{ background: 'var(--accent-soft)' }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>One-Time Setup</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>₹9,999</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Everything you need to get found online</p>
                </div>
                <a href="https://wa.me/917439677931?text=Hi%2C%20interested%20in%20the%20₹9,999%20setup%20package" target="_blank"
                  className="px-6 py-3 rounded-xl font-semibold text-sm text-white text-center transition-all whitespace-nowrap"
                  style={{ background: 'var(--accent)' }}>
                  Get Started →
                </a>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
                {['Professional website (custom design)', 'Google Business optimization', 'AI visibility audit + fixes', 'Brand kit (colors, fonts)', 'WhatsApp Business setup', 'Staff training session'].map(f => (
                  <div key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--success)', flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly/Yearly plans */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-2xl overflow-hidden stagger" style={{ background: 'var(--border)' }}>
            {[
              {
                name: 'Free Audit', price: 'Free', period: '', desc: 'See where you stand',
                features: ['AI visibility score (ChatGPT + Gemini)', 'Google presence checklist', 'Review sentiment analysis', 'Downloadable PDF report'],
                cta: 'Check My Score', href: '#audit', primary: false,
              },
              {
                name: 'Yearly Maintenance', price: '₹5,999', period: '/year', desc: 'Keep your presence running',
                features: ['Domain renewal included', 'Hosting + SSL', 'Monthly AI visibility report', '2 website updates/month', 'Google review response drafts', 'Technical support'],
                cta: 'Add Maintenance', href: 'https://wa.me/917439677931?text=Hi%2C%20interested%20in%20yearly%20maintenance%20(₹5,999/year)', primary: true,
              },
              {
                name: 'Content Pack', price: '₹2,999', period: '/month', desc: 'For salons & active businesses',
                features: ['8 branded offer posters/month', '4 Instagram stories', '2 Google Business posts', 'Festival/seasonal designs', 'WhatsApp broadcast content', 'Brand-consistent templates'],
                cta: 'Start Content', href: 'https://wa.me/917439677931?text=Hi%2C%20interested%20in%20Content%20Pack%20(₹2,999/month)', primary: false,
              },
            ].map(plan => (
              <div key={plan.name} className="p-6 flex flex-col" style={{ background: plan.primary ? 'var(--accent-soft)' : 'var(--surface)' }}>
                <div className="mb-5">
                  <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: plan.primary ? 'var(--accent)' : 'var(--text-muted)' }}>{plan.name}</p>
                  <div>
                    <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{plan.price}</span>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{plan.period}</span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{plan.desc}</p>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--success)' }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <a href={plan.href} target={plan.href.startsWith('http') ? '_blank' : undefined}
                  className="block text-center py-2.5 rounded-lg font-semibold text-sm transition-all"
                  style={plan.primary ? { background: 'var(--accent)', color: 'white' } : { border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          {/* Total value */}
          <div className="mt-6 rounded-xl p-4 text-center" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>Total first year: ₹15,998</span> (setup + maintenance)
              <span className="mx-2" style={{ color: 'var(--border-strong)' }}>|</span>
              Agencies charge ₹50,000+ for the same service
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-6" style={{ background: 'var(--bg-alt)' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl mb-4" style={{ color: 'var(--text)' }}>
            AI is recommending<br />your competitors. Not you.
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Check your AI visibility score. 30 seconds. Free.
          </p>
          <a href="#audit" className="inline-block px-6 py-3 text-white font-semibold rounded-xl" style={{ background: 'var(--accent)' }}>
            Check My AI Score →
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
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Helping local businesses get found online.</p>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <a href="https://wa.me/917439677931" target="_blank" className="hover:underline">WhatsApp</a>
            <a href="mailto:hello@reachright.app" className="hover:underline">Email</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
