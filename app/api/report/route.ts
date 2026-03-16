import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { rateLimit } from '@/app/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = 'gemini-3-flash-preview';

const genai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.rating', 'places.userRatingCount', 'places.websiteUri',
  'places.googleMapsUri', 'places.primaryType', 'places.photos',
  'places.regularOpeningHours', 'places.internationalPhoneNumber', 'places.reviews',
].join(',');

/* ── Audit logic (shared with /api/audit) ──────────────────────────────────── */

interface AuditItem { label: string; status: 'good' | 'warn' | 'bad'; value: string; tip: string; }

function auditBusiness(place: Record<string, unknown>): { score: number; items: AuditItem[] } {
  const items: AuditItem[] = [];
  let score = 100;

  const website = (place.websiteUri as string) || '';
  if (!website) { score -= 25; items.push({ label: 'Website', status: 'bad', value: 'Not found', tip: 'A website helps customers find you 24/7.' }); }
  else if (website.includes('instagram.com') || website.includes('facebook.com')) { score -= 12; items.push({ label: 'Website', status: 'warn', value: 'Social media only', tip: 'A dedicated website ranks better on Google.' }); }
  else { items.push({ label: 'Website', status: 'good', value: website.replace(/https?:\/\//, '').substring(0, 35), tip: 'Website exists. Ensure it loads fast on mobile.' }); }

  const rating = (place.rating as number) || 0;
  if (rating === 0) { score -= 10; items.push({ label: 'Google Rating', status: 'bad', value: 'No rating', tip: 'Ask customers to leave reviews.' }); }
  else if (rating < 4.0) { score -= 7; items.push({ label: 'Google Rating', status: 'warn', value: `${rating}/5.0`, tip: 'Below 4.0 turns customers away.' }); }
  else { items.push({ label: 'Google Rating', status: 'good', value: `${rating}/5.0`, tip: 'Great rating.' }); }

  const reviews = (place.userRatingCount as number) || 0;
  if (reviews === 0) { score -= 10; items.push({ label: 'Reviews', status: 'bad', value: '0', tip: 'Zero reviews = invisible on Google.' }); }
  else if (reviews < 50) { score -= 5; items.push({ label: 'Reviews', status: 'warn', value: `${reviews}`, tip: 'More reviews = higher Google ranking.' }); }
  else { items.push({ label: 'Reviews', status: 'good', value: reviews.toLocaleString(), tip: 'Strong review count.' }); }

  const photos = (place.photos as unknown[]) || [];
  if (photos.length === 0) { score -= 8; items.push({ label: 'Photos', status: 'bad', value: 'None', tip: '42% more direction requests with photos.' }); }
  else if (photos.length < 5) { score -= 4; items.push({ label: 'Photos', status: 'warn', value: `${photos.length}`, tip: 'Aim for 15+ photos.' }); }
  else { items.push({ label: 'Photos', status: 'good', value: `${photos.length}+`, tip: 'Good photo coverage.' }); }

  if (!place.regularOpeningHours) { score -= 5; items.push({ label: 'Hours', status: 'bad', value: 'Missing', tip: 'Missing hours = lost walk-ins.' }); }
  else { items.push({ label: 'Hours', status: 'good', value: 'Listed', tip: 'Update for holidays.' }); }

  if (!(place.internationalPhoneNumber as string)) { score -= 3; items.push({ label: 'Phone', status: 'bad', value: 'Missing', tip: 'Add phone for direct calls.' }); }
  else { items.push({ label: 'Phone', status: 'good', value: 'Listed', tip: 'Consider adding WhatsApp.' }); }

  return { score: Math.max(0, score), items };
}

async function getAIVisibility(name: string, type: string, city: string) {
  if (!genai) return { found: false, rank: null as number | null, mentioned: [] as string[] };
  const typeLabel = (type || '').replace(/_/g, ' ').toLowerCase() || 'business';
  try {
    const res = await genai.models.generateContent({
      model: MODEL, contents: `List the top 10 best ${typeLabel}s in ${city}, India. Just names, numbered 1-10. No descriptions.`,
      config: { temperature: 0.2, maxOutputTokens: 300 },
    });
    const lines = (res.text || '').split('\n').filter((l: string) => l.trim());
    const mentioned: string[] = [];
    let rank: number | null = null;
    const nameLower = name.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/^\d+[\.\)\-]\s*/, '').replace(/\*+/g, '').trim();
      if (line) mentioned.push(line);
      if (line.toLowerCase().includes(nameLower) || nameLower.includes(line.toLowerCase())) rank = i + 1;
    }
    return { found: rank !== null, rank, mentioned: mentioned.slice(0, 10) };
  } catch { return { found: false, rank: null as number | null, mentioned: [] as string[] }; }
}

async function getRecommendations(name: string, type: string, items: AuditItem[], score: number) {
  if (!genai) return ['Build a professional website', 'Optimize your Google Business listing', 'Ask customers for Google reviews'];
  const issues = items.filter(i => i.status === 'bad' || i.status === 'warn').map(i => `${i.label}: ${i.value}`).join(', ');
  try {
    const res = await genai.models.generateContent({
      model: MODEL,
      contents: `You are a digital marketing consultant. A ${type || 'business'} called "${name}" scored ${score}/100 on our audit. Issues: ${issues}. Write exactly 3 specific, actionable recommendations. Each should be 1-2 sentences. No numbering, no bullet points, just the 3 recommendations separated by newlines. Be specific to this business type.`,
      config: { temperature: 0.3, maxOutputTokens: 300 },
    });
    return (res.text || '').split('\n').filter((l: string) => l.trim().length > 10).slice(0, 3);
  } catch { return ['Build a professional website to capture online customers', 'Optimize your Google Business listing with photos and hours', 'Encourage satisfied customers to leave Google reviews']; }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── HTML Report Generator ─────────────────────────────────────────────────── */

function generateReportHTML(data: {
  name: string; address: string; type: string; score: number;
  items: AuditItem[]; ai: { found: boolean; rank: number | null; mentioned: string[]; geminiRank: number | null; geminiFound: boolean; chatgptRank: number | null; chatgptFound: boolean; chatgptMentioned: string[] };
  recommendations: string[]; date: string;
}): string {
  const { name, address, type, score, items, ai, recommendations, date } = data;
  const scoreColor = score >= 80 ? '#15803d' : score >= 50 ? '#ca8a04' : '#dc2626';
  const scoreLabel = score >= 80 ? 'Strong Presence' : score >= 50 ? 'Needs Work' : 'Critical Gaps';
  const scoreSummary = score >= 80
    ? 'Your presence is already credible. The next move is holding rank and compounding discovery.'
    : score >= 50
    ? 'Your business is visible, but trust and discovery signals are still inconsistent.'
    : 'Your business is losing visibility across both Google and AI-assisted discovery.';
  const typeLabel = (type || 'business').replace(/_/g, ' ');
  const badCount = items.filter(i => i.status === 'bad').length;
  const warnCount = items.filter(i => i.status === 'warn').length;
  const goodCount = items.filter(i => i.status === 'good').length;
  const websiteItem = items.find(i => i.label === 'Website');
  const ratingItem = items.find(i => i.label === 'Google Rating');
  const reviewsItem = items.find(i => i.label === 'Reviews');
  const priorityItems = items.filter(i => i.status !== 'good').slice(0, 3);

  const statusLabel = (status: AuditItem['status']) => status === 'good' ? 'Healthy' : status === 'warn' ? 'Improve' : 'Critical';
  const statusIcon = (status: AuditItem['status']) => status === 'good' ? '&#10003;' : status === 'warn' ? '&#9888;' : '&#10007;';
  const statusColor = (status: AuditItem['status']) => status === 'good' ? '#15803d' : status === 'warn' ? '#ca8a04' : '#dc2626';
  const statusBg = (status: AuditItem['status']) => status === 'good' ? '#eef8f0' : status === 'warn' ? '#fff7e7' : '#fdf0ec';

  const safeName = escapeHtml(name);
  const safeAddress = escapeHtml(address);
  const safeType = escapeHtml(typeLabel);
  const safeDate = escapeHtml(date);
  const safeScoreLabel = escapeHtml(scoreLabel);
  const safeScoreSummary = escapeHtml(scoreSummary);

  const statCards = [
    { label: 'AI Visibility', value: ai.found ? `Rank #${ai.rank ?? '—'}` : 'Not found', tone: ai.found ? 'good' : 'bad' },
    { label: 'Google Rating', value: ratingItem?.value || '—', tone: ratingItem?.status || 'warn' },
    { label: 'Review Volume', value: reviewsItem?.value || '—', tone: reviewsItem?.status || 'warn' },
    { label: 'Website', value: websiteItem?.status === 'good' ? 'Live' : websiteItem?.value || 'Missing', tone: websiteItem?.status || 'bad' },
  ].map(card => `
    <div class="stat-card">
      <div class="stat-label">${escapeHtml(card.label)}</div>
      <div class="stat-value" style="color:${statusColor(card.tone as AuditItem['status'])}">${escapeHtml(card.value)}</div>
    </div>
  `).join('');

  const priorityMarkup = (priorityItems.length ? priorityItems : items.slice(0, 3)).map((item, index) => `
    <div class="priority-item">
      <div class="priority-index">${String(index + 1).padStart(2, '0')}</div>
      <div>
        <div class="priority-title">${escapeHtml(item.label)}</div>
        <div class="priority-body">${escapeHtml(item.tip)}</div>
      </div>
    </div>
  `).join('');

  const checklistMarkup = items.map(item => `
    <div class="check-item" style="background:${statusBg(item.status)}; border-color:${statusColor(item.status)}22">
      <div class="check-top">
        <div class="check-badge" style="background:${statusColor(item.status)}">${statusIcon(item.status)}</div>
        <div class="check-main">
          <div class="check-row">
            <span class="check-title">${escapeHtml(item.label)}</span>
            <span class="check-value" style="color:${statusColor(item.status)}">${escapeHtml(item.value)}</span>
          </div>
          <div class="check-meta">${statusLabel(item.status)}</div>
          <div class="check-tip">${escapeHtml(item.tip)}</div>
        </div>
      </div>
    </div>
  `).join('');

  const geminiMarkup = ai.mentioned.slice(0, 5).map((entry, index) => {
    const isMatch = entry.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(entry.toLowerCase());
    return `
      <div class="ai-row ${isMatch ? 'match' : ''}">
        <span class="ai-rank">${index + 1}</span>
        <span class="ai-name">${escapeHtml(entry)}</span>
        ${isMatch ? '<span class="ai-tag">You</span>' : ''}
      </div>
    `;
  }).join('');

  const chatgptMarkup = (ai.chatgptMentioned || []).slice(0, 5).map((entry, index) => {
    const isMatch = entry.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(entry.toLowerCase());
    return `
      <div class="ai-row ${isMatch ? 'match' : ''}">
        <span class="ai-rank">${index + 1}</span>
        <span class="ai-name">${escapeHtml(entry)}</span>
        ${isMatch ? '<span class="ai-tag">You</span>' : ''}
      </div>
    `;
  }).join('');

  const recommendationsMarkup = recommendations.slice(0, 3).map((entry, index) => `
    <div class="rec-card">
      <div class="rec-kicker">Priority ${index + 1}</div>
      <div class="rec-title">${index === 0 ? 'Fix trust blockers' : index === 1 ? 'Increase local discovery' : 'Build durable visibility'}</div>
      <div class="rec-body">${escapeHtml(entry)}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeName} - ReachRight Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap');

  :root {
    --bg: #faf8f5;
    --bg-alt: #f2efe9;
    --surface: #ffffff;
    --border: #e8e4dd;
    --border-strong: #d4cfc5;
    --text: #1a1814;
    --text-secondary: #6b6560;
    --text-muted: #9c9590;
    --accent: #c2410c;
    --accent-soft: #fff2ec;
    --success: #15803d;
    --warning: #ca8a04;
    --danger: #dc2626;
    --data-bg: #1a1814;
    --data-surface: #252220;
    --data-border: #3a3632;
    --data-text: #f2efe9;
    --data-muted: #b7aea7;
  }

  @page {
    size: A4;
    margin: 0;
  }

  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #efe8de;
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 18mm;
    position: relative;
    page-break-after: always;
    background:
      radial-gradient(circle at top right, rgba(194,65,12,0.08), transparent 30%),
      linear-gradient(180deg, #fbfaf7 0%, var(--bg) 100%);
  }

  .page:last-child { page-break-after: auto; }

  .page::before {
    content: '';
    position: absolute;
    inset: 12mm;
    border: 1px solid rgba(212, 207, 197, 0.65);
    pointer-events: none;
  }

  .page-inner {
    position: relative;
    z-index: 1;
  }

  .topbar, .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-mark {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.22);
  }

  .brand-name {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .brand-sub,
  .eyebrow,
  .mono {
    font-family: 'JetBrains Mono', monospace;
  }

  .brand-sub, .eyebrow {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .hero {
    display: grid;
    grid-template-columns: 1.25fr 0.95fr;
    gap: 16px;
    margin-top: 18px;
  }

  .hero-copy,
  .score-card,
  .summary-card,
  .stat-card,
  .panel,
  .check-item,
  .rec-card,
  .timeline-card,
  .cta-card {
    border-radius: 20px;
  }

  .hero-copy {
    background: rgba(255,255,255,0.82);
    border: 1px solid var(--border);
    padding: 24px;
  }

  .report-title,
  .section-title,
  .subject-name,
  .score-label,
  .cta-title {
    font-family: 'Instrument Serif', serif;
    letter-spacing: -0.02em;
  }

  .report-title {
    font-size: 54px;
    line-height: 0.96;
    margin: 12px 0 14px;
  }

  .hero-body {
    max-width: 90%;
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  .subject-card {
    margin-top: 22px;
    padding-top: 18px;
    border-top: 1px solid var(--border);
  }

  .subject-name {
    font-size: 30px;
    line-height: 1.05;
    margin-bottom: 6px;
  }

  .subject-meta {
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  .score-card {
    background: linear-gradient(180deg, var(--data-bg) 0%, #231f1b 100%);
    color: var(--data-text);
    padding: 22px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .score-ring {
    width: 132px;
    height: 132px;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, #1f1b18 58%, transparent 59%),
      conic-gradient(${scoreColor} ${score}%, rgba(255,255,255,0.12) 0);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 18px;
  }

  .score-core {
    width: 94px;
    height: 94px;
    border-radius: 50%;
    background: #1f1b18;
    border: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .score-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 34px;
    font-weight: 700;
    line-height: 1;
    color: ${scoreColor};
  }

  .score-of {
    font-size: 10px;
    color: rgba(242,239,233,0.62);
    margin-top: 4px;
  }

  .score-label {
    font-size: 28px;
    line-height: 1;
    color: ${scoreColor};
    margin-bottom: 8px;
  }

  .score-body {
    font-size: 13px;
    line-height: 1.7;
    color: rgba(242,239,233,0.8);
  }

  .stats-grid,
  .two-up,
  .rec-grid,
  .timeline-grid {
    display: grid;
    gap: 12px;
  }

  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
    margin-top: 14px;
  }

  .stat-card,
  .summary-card,
  .panel,
  .timeline-card {
    background: rgba(255,255,255,0.84);
    border: 1px solid var(--border);
  }

  .stat-card {
    min-height: 92px;
    padding: 16px;
  }

  .stat-label {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 10px;
  }

  .stat-value {
    font-size: 24px;
    line-height: 1.05;
    font-weight: 700;
  }

  .summary-card {
    margin-top: 16px;
    padding: 18px 20px;
    background: linear-gradient(180deg, rgba(255,242,236,0.8), rgba(255,255,255,0.88));
  }

  .summary-title {
    font-size: 30px;
    margin-bottom: 8px;
    font-family: 'Instrument Serif', serif;
  }

  .summary-text {
    font-size: 14px;
    line-height: 1.75;
    color: var(--text-secondary);
  }

  .section-header {
    margin: 18px 0 14px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
  }

  .section-title {
    font-size: 36px;
    line-height: 1;
    margin: 0;
  }

  .section-copy {
    max-width: 300px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-secondary);
    text-align: right;
  }

  .two-up {
    grid-template-columns: 0.95fr 1.05fr;
  }

  .panel {
    padding: 20px;
  }

  .panel-dark {
    background: linear-gradient(180deg, var(--data-bg) 0%, var(--data-surface) 100%);
    border-color: var(--data-border);
    color: var(--data-text);
  }

  .panel-kicker {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: inherit;
    opacity: 0.72;
    margin-bottom: 12px;
    font-family: 'JetBrains Mono', monospace;
  }

  .ai-title {
    font-family: 'Instrument Serif', serif;
    font-size: 29px;
    line-height: 1;
    margin-bottom: 8px;
    color: ${ai.found ? '#f6d38f' : '#f4b0a0'};
  }

  .ai-copy {
    font-size: 13px;
    line-height: 1.7;
    color: rgba(242,239,233,0.8);
    margin-bottom: 14px;
  }

  .ai-model-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .ai-model {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 16px;
    padding: 14px;
  }

  .ai-model-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .ai-model-name {
    font-size: 12px;
    font-weight: 600;
  }

  .ai-model-pill,
  .ai-tag {
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    border-radius: 999px;
    padding: 4px 7px;
  }

  .ai-model-pill {
    background: rgba(255,255,255,0.08);
    color: rgba(242,239,233,0.8);
  }

  .ai-list {
    display: grid;
    gap: 6px;
  }

  .ai-row {
    display: grid;
    grid-template-columns: 22px 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(255,255,255,0.05);
  }

  .ai-row.match {
    background: rgba(21,128,61,0.14);
  }

  .ai-rank {
    color: rgba(242,239,233,0.62);
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
  }

  .ai-name {
    font-size: 11px;
    line-height: 1.5;
  }

  .ai-tag {
    background: rgba(21,128,61,0.2);
    color: #9ae6b4;
  }

  .risk-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 14px;
  }

  .risk-box {
    background: var(--bg-alt);
    border-radius: 16px;
    padding: 14px;
  }

  .risk-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .risk-value {
    font-size: 30px;
    line-height: 1;
    font-weight: 700;
  }

  .priority-list,
  .checklist {
    display: grid;
    gap: 10px;
  }

  .priority-item {
    display: grid;
    grid-template-columns: 42px 1fr;
    gap: 12px;
    padding: 14px;
    background: var(--bg-alt);
    border-radius: 16px;
  }

  .priority-index {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: var(--accent-soft);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 700;
  }

  .priority-title,
  .rec-title,
  .timeline-title {
    font-size: 17px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .priority-body,
  .check-tip,
  .rec-body,
  .timeline-copy,
  .cta-copy {
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  .check-item {
    padding: 16px;
    border: 1px solid transparent;
  }

  .check-top {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .check-badge {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .check-main {
    flex: 1;
  }

  .check-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .check-title {
    font-size: 15px;
    font-weight: 700;
  }

  .check-value {
    font-size: 11px;
    white-space: nowrap;
    font-family: 'JetBrains Mono', monospace;
  }

  .check-meta {
    margin: 3px 0 6px;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .rec-grid,
  .timeline-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .rec-card,
  .timeline-card {
    padding: 18px;
  }

  .rec-card {
    background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,242,236,0.64));
    border: 1px solid var(--border);
  }

  .rec-kicker,
  .timeline-kicker {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 8px;
    font-family: 'JetBrains Mono', monospace;
  }

  .cta-card {
    margin-top: 16px;
    padding: 20px;
    background: linear-gradient(180deg, var(--data-bg), var(--data-surface));
    border: 1px solid var(--data-border);
    color: var(--data-text);
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 16px;
  }

  .cta-title {
    font-size: 34px;
    line-height: 0.95;
    margin-bottom: 8px;
  }

  .contact-stack {
    display: grid;
    gap: 10px;
  }

  .contact-item {
    padding: 12px;
    border-radius: 14px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.06);
  }

  .contact-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: rgba(242,239,233,0.56);
    margin-bottom: 5px;
    font-family: 'JetBrains Mono', monospace;
  }

  .contact-value {
    font-size: 12px;
    line-height: 1.5;
    color: var(--data-text);
  }

  .footer {
    position: absolute;
    left: 18mm;
    right: 18mm;
    bottom: 10mm;
    color: var(--text-muted);
    font-size: 9px;
    background: var(--bg);
    padding: 4px 0;
    z-index: 10;
  }

  .page {
    padding-bottom: 28mm !important;
  }

  .screen-toolbar {
    position: fixed;
    top: 18px;
    right: 18px;
    display: flex;
    gap: 8px;
    z-index: 30;
  }

  .screen-button {
    border: 1px solid var(--border-strong);
    background: rgba(255,255,255,0.92);
    color: var(--text);
    border-radius: 999px;
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 700;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(26,24,20,0.08);
  }

  @media print {
    html, body { background: transparent; }
    .page { margin: 0; }
    .screen-toolbar { display: none; }
  }
</style>
</head>
<body>
  <div class="screen-toolbar">
    <button class="screen-button" onclick="window.print()">Download PDF</button>
  </div>
  <section class="page">
    <div class="page-inner">
      <div class="topbar">
        <div class="brand">
          <div class="brand-mark">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="16" cy="15" r="9" stroke="white" stroke-width="2" fill="none" opacity="0.35"/>
              <circle cx="16" cy="15" r="5" stroke="white" stroke-width="2" fill="none" opacity="0.65"/>
              <circle cx="16" cy="15" r="2" fill="white"/>
              <path d="M20 11L25 6" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
              <path d="M25 6L25 10" stroke="white" stroke-width="2" stroke-linecap="round"/>
              <path d="M25 6L21 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <div class="brand-name">ReachRight</div>
            <div class="brand-sub">Premium visibility report</div>
          </div>
        </div>
        <div class="mono">${safeDate}</div>
      </div>

      <div class="hero">
        <div class="hero-copy">
          <div class="eyebrow">Prepared for local businesses ready to grow</div>
          <div class="report-title">AI Visibility<br>and Local Presence</div>
          <div class="hero-body">
            A premium review of how ${safeName} appears across Google Business signals, website readiness, review strength, and AI-generated recommendations.
          </div>

          <div class="subject-card">
            <div class="eyebrow">Business reviewed</div>
            <div class="subject-name">${safeName}</div>
            <div class="subject-meta">${safeAddress}<br>${safeType}</div>
          </div>
        </div>

        <div class="score-card">
          <div>
            <div class="eyebrow" style="color: rgba(242,239,233,0.56);">Overall score</div>
            <div class="score-ring">
              <div class="score-core">
                <div class="score-num">${score}</div>
                <div class="score-of mono">/100</div>
              </div>
            </div>
            <div class="score-label">${safeScoreLabel}</div>
            <div class="score-body">${safeScoreSummary}</div>
          </div>
          <div class="mono" style="color: rgba(242,239,233,0.56);">ReachRight assessment model</div>
        </div>
      </div>

      <div class="stats-grid">
        ${statCards}
      </div>

      <div class="summary-card">
        <div class="summary-title">Executive Summary</div>
        <div class="summary-text">
          This report is designed to feel client-ready and decision-ready. It shows where your business is already credible, where visibility is breaking, and which fixes should be prioritised first to improve discovery and conversion.
        </div>
      </div>

      <div class="footer">
        <span>reachright.app</span>
        <span>Confidential report prepared for ${safeName}</span>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="page-inner">
      <div class="topbar">
        <div class="brand">
          <div class="brand-mark">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="16" cy="15" r="9" stroke="white" stroke-width="2" fill="none" opacity="0.35"/>
              <circle cx="16" cy="15" r="5" stroke="white" stroke-width="2" fill="none" opacity="0.65"/>
              <circle cx="16" cy="15" r="2" fill="white"/>
              <path d="M20 11L25 6" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
              <path d="M25 6L25 10" stroke="white" stroke-width="2" stroke-linecap="round"/>
              <path d="M25 6L21 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <div class="brand-name">ReachRight</div>
            <div class="brand-sub">Detailed diagnosis</div>
          </div>
        </div>
        <div class="mono">Page 2 of 3</div>
      </div>

      <div class="section-header">
        <h2 class="section-title">Where visibility is leaking</h2>
        <div class="section-copy">These are the signals affecting whether customers trust you enough to click, call, or visit.</div>
      </div>

      <div class="two-up">
        <div class="panel panel-dark">
          <div class="panel-kicker">AI recommendation scan</div>
          <div class="ai-title">${ai.found ? 'Recommended by AI models' : 'Not recommended by AI models'}</div>
          <div class="ai-copy">
            ${ai.found
              ? `${safeName} appears in at least one leading AI recommendation set. The next step is improving position and consistency across models.`
              : `${safeName} is absent from current AI recommendation sets. That means AI-first customers are more likely to be routed to competitors.`}
          </div>

          <div class="ai-model-grid">
            <div class="ai-model">
              <div class="ai-model-head">
                <span class="ai-model-name">Google Gemini</span>
                <span class="ai-model-pill">${ai.geminiFound ? `#${ai.geminiRank}` : 'Not found'}</span>
              </div>
              <div class="ai-list">
                ${geminiMarkup || '<div class="ai-row"><span class="ai-rank">-</span><span class="ai-name">No ranking returned.</span><span></span></div>'}
              </div>
            </div>

            <div class="ai-model">
              <div class="ai-model-head">
                <span class="ai-model-name">ChatGPT</span>
                <span class="ai-model-pill">${ai.chatgptFound ? `#${ai.chatgptRank}` : 'Not found'}</span>
              </div>
              <div class="ai-list">
                ${chatgptMarkup || '<div class="ai-row"><span class="ai-rank">-</span><span class="ai-name">No ranking returned.</span><span></span></div>'}
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-kicker" style="color: var(--text-muted);">Risk summary</div>
          <div class="risk-grid">
            <div class="risk-box">
              <div class="risk-label">Critical</div>
              <div class="risk-value" style="color: var(--danger);">${badCount}</div>
            </div>
            <div class="risk-box">
              <div class="risk-label">Watch</div>
              <div class="risk-value" style="color: var(--warning);">${warnCount}</div>
            </div>
            <div class="risk-box">
              <div class="risk-label">Healthy</div>
              <div class="risk-value" style="color: var(--success);">${goodCount}</div>
            </div>
          </div>

          <div class="panel-kicker" style="color: var(--text-muted);">Priority fixes</div>
          <div class="priority-list">
            ${priorityMarkup}
          </div>
        </div>
      </div>

      <div class="section-header">
        <h2 class="section-title">Signal-by-signal checklist</h2>
        <div class="section-copy">Every row below represents a trust or discovery signal customers see before they decide.</div>
      </div>

      <div class="checklist">
        ${checklistMarkup}
      </div>

      <div class="footer">
        <span>reachright.app</span>
        <span>Confidential report prepared for ${safeName}</span>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="page-inner">
      <div class="topbar">
        <div class="brand">
          <div class="brand-mark">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="16" cy="15" r="9" stroke="white" stroke-width="2" fill="none" opacity="0.35"/>
              <circle cx="16" cy="15" r="5" stroke="white" stroke-width="2" fill="none" opacity="0.65"/>
              <circle cx="16" cy="15" r="2" fill="white"/>
              <path d="M20 11L25 6" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
              <path d="M25 6L25 10" stroke="white" stroke-width="2" stroke-linecap="round"/>
              <path d="M25 6L21 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <div class="brand-name">ReachRight</div>
            <div class="brand-sub">Action roadmap</div>
          </div>
        </div>
        <div class="mono">Page 3 of 3</div>
      </div>

      <div class="section-header">
        <h2 class="section-title">Recommended next moves</h2>
        <div class="section-copy">This roadmap is ordered to improve trust first, then local discovery, then durable ranking strength.</div>
      </div>

      <div class="rec-grid">
        ${recommendationsMarkup}
      </div>

      <div class="timeline-grid" style="margin-top: 14px;">
        <div class="timeline-card">
          <div class="timeline-kicker">Phase 1</div>
          <div class="timeline-title">Weeks 1-2</div>
          <div class="timeline-copy">Fix incomplete or missing business fundamentals so customers see a credible presence immediately.</div>
        </div>
        <div class="timeline-card">
          <div class="timeline-kicker">Phase 2</div>
          <div class="timeline-title">Weeks 3-6</div>
          <div class="timeline-copy">Improve profile freshness, social proof, and service clarity to increase click-through and trust.</div>
        </div>
        <div class="timeline-card">
          <div class="timeline-kicker">Phase 3</div>
          <div class="timeline-title">Weeks 7-12</div>
          <div class="timeline-copy">Build repeated business signals so both Google and AI systems encounter stronger structured evidence.</div>
        </div>
      </div>

      <div class="cta-card">
        <div>
          <div class="eyebrow" style="color: rgba(242,239,233,0.56);">Execution support</div>
          <div class="cta-title">If needed, we can turn this audit into execution.</div>
          <div class="cta-copy" style="color: rgba(242,239,233,0.78);">
            ReachRight builds the website, sharpens the Google listing, and upgrades the signals that help AI and customers pick your business over nearby alternatives.
          </div>
        </div>

        <div class="contact-stack">
          <div class="contact-item">
            <div class="contact-label">WhatsApp</div>
            <div class="contact-value">+91 7439 677 931</div>
          </div>
          <div class="contact-item">
            <div class="contact-label">Website</div>
            <div class="contact-value">reachright.app</div>
          </div>
          <div class="contact-item">
            <div class="contact-label">Email</div>
            <div class="contact-value">mriganka.mondal@reachright.app</div>
          </div>
        </div>
      </div>

      <div class="footer">
        <span>reachright.app</span>
        <span>Confidential report prepared for ${safeName}</span>
      </div>
    </div>
  </section>
</body>
</html>`;
}

/* ── API Route ─────────────────────────────────────────────────────────────── */

async function checkChatGPTVisibility(name: string, type: string, city: string) {
  if (!OPENAI_API_KEY) return { found: false, rank: null as number | null, mentioned: [] as string[] };
  const typeLabel = (type || '').replace(/_/g, ' ').toLowerCase() || 'business';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: `List the top 10 best ${typeLabel}s in ${city}, India. Just names, numbered 1-10. No descriptions.` }], temperature: 0.2, max_tokens: 300 }),
    });
    if (!res.ok) return { found: false, rank: null as number | null, mentioned: [] as string[] };
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const lines = text.split('\n').filter((l: string) => l.trim());
    const mentioned: string[] = []; let rank: number | null = null;
    const nameLower = name.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/^\d+[\.\)\-]\s*/, '').replace(/\*+/g, '').trim();
      if (line) mentioned.push(line);
      if (line.toLowerCase().includes(nameLower) || nameLower.includes(line.toLowerCase())) rank = i + 1;
    }
    return { found: rank !== null, rank, mentioned: mentioned.slice(0, 10) };
  } catch { return { found: false, rank: null as number | null, mentioned: [] as string[] }; }
}

export async function GET(req: NextRequest) {
  // Rate limit: 5 reports per IP per hour
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed } = rateLimit(`report:${ip}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const format = searchParams.get('format') || 'html';

  if (!query || query.length < 3) {
    return NextResponse.json({ error: 'Enter business name and city' }, { status: 400 });
  }

  try {
    const response = await fetch(PLACES_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': MAPS_API_KEY, 'X-Goog-FieldMask': FIELD_MASK },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    });
    if (!response.ok) return NextResponse.json({ error: 'Search failed' }, { status: 502 });

    const data = await response.json();
    const place = (data.places || [])[0];
    if (!place) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const name = (place.displayName as Record<string, string>)?.text || 'Unknown';
    const address = (place.formattedAddress as string) || '';
    const type = (place.primaryType as string) || '';
    const city = address.split(',').slice(-3, -1).join(',').trim() || 'the city';

    // Audit + ALL AI checks in parallel (Gemini + ChatGPT + recommendations)
    const { score, items } = auditBusiness(place);
    const [geminiAI, chatgptAI, recommendations] = await Promise.all([
      getAIVisibility(name, type, city),
      checkChatGPTVisibility(name, type, city),
      getRecommendations(name, type, items, score),
    ]);

    // Merge AI results
    const bestRank = geminiAI.found && chatgptAI.found
      ? Math.min(geminiAI.rank!, chatgptAI.rank!)
      : geminiAI.rank || chatgptAI.rank;
    const foundInAny = geminiAI.found || chatgptAI.found;
    const foundCount = (geminiAI.found ? 1 : 0) + (chatgptAI.found ? 1 : 0);

    const ai = {
      found: foundInAny,
      rank: bestRank,
      mentioned: geminiAI.mentioned,
      geminiRank: geminiAI.rank, geminiFound: geminiAI.found,
      chatgptRank: chatgptAI.rank, chatgptFound: chatgptAI.found,
      chatgptMentioned: chatgptAI.mentioned,
    };

    // Score + AI item
    if (foundCount === 2) {
      items.unshift({ label: 'AI Visibility', status: bestRank! <= 3 ? 'good' : 'warn', value: `#${bestRank} (both AIs)`, tip: `Gemini: #${geminiAI.rank}. ChatGPT: #${chatgptAI.rank}.` });
    } else if (foundCount === 1) {
      items.unshift({ label: 'AI Visibility', status: 'warn', value: `Found in 1/2 AIs`, tip: `${geminiAI.found ? `Gemini: #${geminiAI.rank}` : 'Gemini: not found'}. ${chatgptAI.found ? `ChatGPT: #${chatgptAI.rank}` : 'ChatGPT: not found'}.` });
    } else {
      items.unshift({ label: 'AI Visibility', status: 'bad', value: 'Not found', tip: 'Neither ChatGPT nor Gemini recommend your business.' });
    }

    const finalScore = Math.max(0, foundCount === 2 ? score : foundCount === 1 ? score - 8 : score - 20);
    const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    if (format === 'json') {
      return NextResponse.json({ name, address, type, score: finalScore, items, ai, recommendations, date });
    }

    // 3. Generate HTML report
    const html = generateReportHTML({ name, address, type, score: finalScore, items, ai, recommendations, date });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${name.replace(/[^a-zA-Z0-9]/g, '-')}-ReachRight-Report.html"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
