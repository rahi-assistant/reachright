import { NextRequest, NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { ReportPDF } from '@/app/components/ReportPDF';
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
    const mentioned = parseRankedMentions(res.text || '');
    let rank: number | null = null;
    const nameLower = name.toLowerCase();
    for (let i = 0; i < mentioned.length; i++) {
      const line = mentioned[i];
      if (line.toLowerCase().includes(nameLower) || nameLower.includes(line.toLowerCase())) rank = i + 1;
    }
    return { found: rank !== null, rank, mentioned };
  } catch { return { found: false, rank: null as number | null, mentioned: [] as string[] }; }
}

async function getRecommendations(name: string, type: string, items: AuditItem[], score: number) {
  const fallback = [
    'Build a professional, mobile-responsive website with online booking and service menu to capture customers searching online.',
    'Optimize your Google Business listing with high-quality photos, complete hours, and respond to reviews to boost local ranking.',
    'Encourage satisfied customers to leave Google reviews and maintain a consistent posting schedule to strengthen AI visibility.',
  ];
  if (!genai) return fallback;
  const issues = items.filter(i => i.status === 'bad' || i.status === 'warn').map(i => `${i.label}: ${i.value}`).join(', ');
  try {
    const res = await genai.models.generateContent({
      model: MODEL,
      contents: `You are a digital marketing consultant. A ${type || 'business'} called "${name}" scored ${score}/100 on our audit. Issues: ${issues}. Write exactly 3 specific, actionable recommendations as 3 separate paragraphs. Each paragraph should be 1-2 sentences max. Separate each recommendation with a blank line. No numbering, no bullet points. Be specific to this business type.`,
      config: { temperature: 0.3, maxOutputTokens: 400 },
    });
    const text = (res.text || '').replace(/^\d+[\.\)]\s*/gm, '').replace(/^[-*]\s*/gm, '');
    let recs = text.split(/\n\s*\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 15);
    if (recs.length < 3) {
      recs = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 15);
    }
    if (recs.length < 3) {
      while (recs.length < 3) recs.push(fallback[recs.length]);
    }
    return recs.slice(0, 3);
  } catch { return fallback; }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseRankedMentions(text: string): string[] {
  const normalized = text
    .replace(/\r/g, '')
    .replace(/(^|\n)\s*(\d{1,2})[\.\)]?\s*\n\s*(?=\S)/g, '$1$2. ')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '');

  const junk = /^(true|false|yes|no|none|null|undefined|n\/a|na|the|and|or|in|of|a|an)$/i;

  return normalized
    .split('\n')
    .map(line => line.replace(/^\s*\d{1,2}[\.\)\-:]\s*/, '').trim())
    .filter(line => line.length > 2)
    .filter(line => !/^\d+$/.test(line))
    .filter(line => /[A-Za-z]/.test(line))
    .filter(line => !junk.test(line))
    .slice(0, 10);
}

/* ── HTML Report Generator ─────────────────────────────────────────────────── */
function generateReportHTML(data: {
  name: string; address: string; type: string; score: number;
  items: AuditItem[]; ai: { found: boolean; rank: number | null; mentioned: string[]; geminiRank: number | null; geminiFound: boolean; chatgptRank: number | null; chatgptFound: boolean; chatgptMentioned: string[] };
  recommendations: string[]; date: string;
}): string {
  const { name, address, type, score, items, ai, recommendations, date } = data;
  
  const scoreLabel = score >= 80 ? 'Strong Presence' : score >= 50 ? 'Needs Work' : 'Critical Gaps';
  const scoreSummary = score >= 80
    ? 'Your presence is already credible. The next move is holding rank and compounding discovery.'
    : score >= 50
    ? 'Your business is visible, but trust and discovery signals are still inconsistent.'
    : 'Your business is losing visibility across both Google and AI-assisted discovery.';

  const safeName = escapeHtml(name);
  const safeAddress = escapeHtml(address);
  const safeType = escapeHtml(type.replace(/_/g, ' '));
  const safeDate = escapeHtml(date);

  const statCards = items.slice(0, 4).map(item => `
    <div class="stat-card">
      <div class="stat-header">
        <div class="stat-label">${escapeHtml(item.label)}</div>
        <div class="status-badge status-${item.status}">${item.status}</div>
      </div>
      <div class="stat-value">${escapeHtml(item.value)}</div>
      <div class="stat-tip">${escapeHtml(item.tip)}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeName} - ReachRight Premium Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #F8F6F2;
    --card-bg: #FFFFFF;
    --dark-bg: #1A1816;
    --dark-card: #24211D;
    --text-main: #1A1A1A;
    --primary: #DC582A;
    --text-sec: #666666;
    --text-light: #F2EFE9;
    --accent: #C4623C;
    --accent-soft: #FFEDDE;
    --border: #E5E0D8;
    --danger: #DC2626;
    --warning: #CA8A04;
    --success: #15803D;
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body {
    background-color: #EAE8E4;
    color: var(--text-main);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .screen-toolbar {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 100;
  }

  .screen-button {
    background: var(--dark-bg);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 999px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .screen-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 30px rgba(0,0,0,0.3);
  }

  .page {
    width: 100%;
    max-width: 850px;
    background: var(--bg);
    margin-bottom: 40px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.08);
    position: relative;
    overflow: hidden;
  }

  .page-inner { padding: 50px 60px; }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 50px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 15px;
  }

  .brand-group { display: flex; align-items: center; gap: 12px; }
  .brand-logo {
    width: 32px; height: 32px;
    background: var(--primary);
    color: white;
    display: flex; justify-content: center; align-items: center;
    
    border-radius: 6px;
  }
  .brand-name { font-size: 18px; font-weight: bold; letter-spacing: 0.5px; }
  .brand-sub { font-size: 10px; color: var(--text-sec); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
  .date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-sec); }

  .hero { display: flex; justify-content: space-between; margin-bottom: 50px; gap: 40px; }
  .hero-copy { flex: 1; }
  
  .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-sec); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
  .report-title { font-family: 'Instrument Serif', serif; font-size: 46px; line-height: 1.1; margin-bottom: 16px; color: var(--text-main); }
  .hero-body { font-size: 15px; color: var(--text-sec); line-height: 1.6; margin-bottom: 24px; }

  .subject-card { border-top: 1px solid var(--border); padding-top: 20px; }
  .subject-name { font-size: 22px; font-weight: bold; margin-bottom: 6px; }
  .subject-meta { font-size: 13px; color: var(--text-sec); line-height: 1.5; }

  .score-card {
    width: 38%;
    background: var(--dark-bg);
    padding: 30px;
    border-radius: 12px;
    border: 1px solid var(--dark-card);
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }
  .score-ring {
    width: 150px; height: 150px;
    border-radius: 50%;
    border: 2px dashed var(--accent);
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    margin: 20px 0;
  }
  .score-number { font-size: 64px; font-weight: bold; color: var(--text-light); line-height: 1; }
  .score-max { font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--text-sec); margin-top: 4px; }
  .score-label { font-family: 'Instrument Serif', serif; font-size: 22px; color: var(--text-light); margin-bottom: 10px; }
  .score-body { font-size: 12px; color: #A09D98; line-height: 1.5; }

  .section-header { margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
  .section-title { font-family: 'Instrument Serif', serif; font-size: 28px; color: var(--text-main); }
  .section-copy { font-size: 13px; color: var(--text-sec); margin-top: 6px; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 50px; }
  .stat-card { background: var(--card-bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border); }
  .stat-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .stat-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-sec); text-transform: uppercase; letter-spacing: 1px; }
  .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; color: white; }
  .status-good { background: var(--success); }
  .status-warn { background: var(--warning); }
  .status-bad { background: var(--danger); }
  .stat-value { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
  .stat-tip { font-size: 13px; color: var(--text-sec); line-height: 1.5; }

  .ai-container { background: var(--dark-bg); padding: 30px; border-radius: 12px; margin-bottom: 50px; }
  .ai-title { font-family: 'Instrument Serif', serif; font-size: 28px; color: #F6D38F; margin-bottom: 16px; }
  .ai-text { font-size: 14px; color: var(--text-light); opacity: 0.9; margin-bottom: 30px; line-height: 1.6; }
  
  .model-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .model-card { background: var(--dark-card); padding: 20px; border-radius: 8px; border: 1px solid #332F2A; }
  .model-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .model-name { font-size: 14px; font-weight: bold; color: var(--text-light); }
  .model-rank { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent); background: rgba(196,98,60,0.1); padding: 4px 8px; border-radius: 4px; }
  .ai-row { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 6px; }
  .ai-row.match { background: rgba(21,128,61,0.15); }
  .ai-row.miss { background: rgba(255,255,255,0.03); }
  .ai-rank-text { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--text-sec); width: 30px; }
  .ai-name-text { font-size: 13px; color: var(--text-light); }

  .roadmap-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 50px; }
  .phase-card { background: var(--card-bg); padding: 24px; border-radius: 8px; border: 1px solid var(--border); }
  .phase-kicker { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--accent); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; display: block; }
  .phase-title { font-size: 18px; font-weight: bold; margin-bottom: 12px; }
  .phase-text { font-size: 13px; color: var(--text-sec); line-height: 1.6; }

  .cta-card { background: var(--accent-soft); padding: 30px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; gap: 40px; margin-bottom: 40px; }
  .cta-copy { flex: 1; }
  .cta-title { font-family: 'Instrument Serif', serif; font-size: 24px; margin-bottom: 12px; color: var(--text-main); }
  .cta-text { font-size: 14px; color: var(--text-sec); line-height: 1.6; }
  .contact-stack { width: 35%; display: flex; flex-direction: column; gap: 10px; }
  .contact-item { background: var(--card-bg); padding: 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
  .contact-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-sec); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .contact-value { font-size: 14px; font-weight: bold; }

  .footer { border-top: 1px solid var(--border); padding-top: 20px; display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-sec); margin-top: 20px; }

  @media print {
    body { background: var(--bg); padding: 0; }
    .screen-toolbar { display: none !important; }
    .page { box-shadow: none; max-width: 100%; margin: 0; }
  }

  @media (max-width: 768px) {
    .hero { flex-direction: column; }
    .score-card { width: 100%; }
    .grid, .model-grid, .roadmap-grid, .cta-card { grid-template-columns: 1fr; flex-direction: column; }
    .contact-stack { width: 100%; }
    .page-inner { padding: 30px 20px; }
    .screen-toolbar { top: auto; bottom: 20px; right: 20px; left: 20px; text-align: center; }
    .screen-button { width: 100%; padding: 16px; font-size: 16px; }
  }
</style>
<script>
  function downloadPDF() {
    const url = new URL(window.location.href);
    url.searchParams.set('format', 'pdf');
    window.location.href = url.toString();
  }
</script>
</head>
<body>
  <div class="screen-toolbar">
    <button class="screen-button" onclick="downloadPDF()">Download PDF</button>
  </div>

  <div class="page">
    <div class="page-inner">
      <div class="topbar">
        <div class="brand-group">
          
          <div class="brand-logo">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <div class="date">${safeDate}</div>
      </div>

      <div class="hero">
        <div class="hero-copy">
          <div class="eyebrow">Prepared for local businesses</div>
          <h1 class="report-title">AI Visibility &<br>Local Presence</h1>
          <p class="hero-body">A premium review of how this business appears across Google Business signals, website readiness, review strength, and modern AI-generated recommendations.</p>
          <div class="subject-card">
            <div class="eyebrow">Business under review</div>
            <div class="subject-name">${safeName}</div>
            <div class="subject-meta">${safeAddress}<br>${safeType}</div>
          </div>
        </div>
        
        <div class="score-card">
          <div class="eyebrow" style="color: rgba(255,255,255,0.5)">Overall Score</div>
          <div class="score-ring">
            <div class="score-number">${score}</div>
            <div class="score-max">/100</div>
          </div>
          <div class="score-label">${scoreLabel}</div>
          <div class="score-body">${scoreSummary}</div>
        </div>
      </div>

      <div class="section-header">
        <h2 class="section-title">Key Discovery Signals</h2>
        <p class="section-copy">These are the core metrics deciding if customers trust you enough to click, call, or visit.</p>
      </div>

      <div class="grid">
        ${statCards}
      </div>

      <div class="section-header">
        <h2 class="section-title">AI Recommendation Scan</h2>
        <p class="section-copy">How Large Language Models (LLMs) currently rank your business for local queries.</p>
      </div>

      <div class="ai-container">
        <h3 class="ai-title">${ai.found ? 'Recommended by AI models' : 'Invisible to AI models'}</h3>
        <p class="ai-text">${ai.found 
          ? `${safeName} appears in at least one leading AI recommendation set. The next step is cementing your position to capture AI-first customers.` 
          : `${safeName} is absent from current AI recommendation sets. This means AI-first customers are actively being routed to your competitors.`}</p>

        <div class="model-grid">
          <div class="model-card">
            <div class="model-head">
              <div class="model-name">Google Gemini</div>
              <div class="model-rank">${ai.geminiFound ? `Ranked #${ai.geminiRank}` : 'Not Ranked'}</div>
            </div>
            <div class="ai-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${ai.mentioned.length > 0 
                ? ai.mentioned.slice(0, 3).map((comp, idx) => `
                    <div class="ai-row ${ai.geminiFound && comp.toLowerCase().includes(name.toLowerCase()) ? 'match' : 'miss'}">
                      <div class="ai-rank-text">${idx + 1}</div>
                      <div class="ai-name-text">${escapeHtml(comp)}</div>
                    </div>
                  `).join('')
                : `<div class="ai-row miss"><div class="ai-rank-text">-</div><div class="ai-name-text">No competitors found</div></div>`
              }
            </div>
              <div class="ai-name-text">${ai.geminiFound ? safeName : 'Competitors recommended instead'}</div>
            </div>
          </div>

          <div class="model-card">
            <div class="model-head">
              <div class="model-name">OpenAI ChatGPT</div>
              <div class="model-rank">${ai.chatgptFound ? `Ranked #${ai.chatgptRank}` : 'Not Ranked'}</div>
            </div>
            <div class="ai-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${ai.chatgptMentioned && ai.chatgptMentioned.length > 0 
                ? ai.chatgptMentioned.slice(0, 3).map((comp, idx) => `
                    <div class="ai-row ${ai.chatgptFound && comp.toLowerCase().includes(name.toLowerCase()) ? 'match' : 'miss'}">
                      <div class="ai-rank-text">${idx + 1}</div>
                      <div class="ai-name-text">${escapeHtml(comp)}</div>
                    </div>
                  `).join('')
                : `<div class="ai-row miss"><div class="ai-rank-text">-</div><div class="ai-name-text">No competitors found</div></div>`
              }
            </div>
              <div class="ai-name-text">${ai.chatgptFound ? safeName : 'Competitors recommended instead'}</div>
            </div>
          </div>
        </div>
      </div>

      
      <div class="section-header">
        <h2 class="section-title">Signal-by-Signal Checklist</h2>
        <p class="section-copy">Every row is a trust or discovery signal customers check before they decide.</p>
      </div>

      <div class="checklist-stack" style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 50px;">
        ${items.map(item => `
          <div style="display: flex; align-items: center; background: var(--card-bg); padding: 24px; border-radius: 8px; border: 1px solid var(--border); gap: 20px;">
            <div style="width: 32px; height: 32px; border-radius: 16px; background: var(--${item.status === 'bad' ? 'danger' : item.status === 'warn' ? 'warning' : 'success'}); flex-shrink: 0;"></div>
            <div style="flex: 1;">
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 6px;">${escapeHtml(item.label)}</div>
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-sec); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px;">
                ${item.status === 'bad' ? 'CRITICAL' : item.status === 'warn' ? 'NEEDS WORK' : 'HEALTHY'}
              </div>
              <div style="font-size: 13px; color: var(--text-sec);">${escapeHtml(item.tip)}</div>
            </div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--text-sec);">${escapeHtml(item.value)}</div>
          </div>
        `).join('')}
      </div>
<div class="section-header">
        <h2 class="section-title">Recommended Next Moves</h2>
        <p class="section-copy">Ordered to improve trust first, local discovery second, and durable ranking strength third.</p>
      </div>

      <div class="roadmap-grid">
        ${recommendations.slice(0, 3).map((rec, i) => `
          <div class="phase-card">
            <span class="phase-kicker">Phase ${i + 1}</span>
            <div class="phase-title">Week ${i * 2 + 1}-${i * 2 + 2}</div>
            <div class="phase-text">${escapeHtml(rec)}</div>
          </div>
        `).join('')}
      </div>

      <div class="cta-card">
        <div class="cta-copy">
          <div class="eyebrow">Execution Support</div>
          <h2 class="cta-title">Turn this audit into action.</h2>
          <p class="cta-text">ReachRight builds the high-converting websites, sharpens Google listings, and upgrades the signals that help both AI and human customers pick your business over alternatives.</p>
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
        </div>
      </div>

      <div class="footer">
        <span>reachright.app</span>
        <span>Confidential report for ${safeName}</span>
      </div>
    </div>
  </div>
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
    const mentioned = parseRankedMentions(data?.choices?.[0]?.message?.content || '');
    let rank: number | null = null;
    const nameLower = name.toLowerCase();
    for (let i = 0; i < mentioned.length; i++) {
      const line = mentioned[i];
      if (line.toLowerCase().includes(nameLower) || nameLower.includes(line.toLowerCase())) rank = i + 1;
    }
    return { found: rank !== null, rank, mentioned };
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

    // PDF download
    if (format === 'pdf') {
      const pdfElement = React.createElement(ReportPDF, { data: { name, address, type, score: finalScore, items, ai, recommendations, date } });
      const stream = await renderToStream(pdfElement as any);

      const readableStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)));
          stream.on('end', () => controller.close());
          stream.on('error', (err) => controller.error(err));
        }
      });

      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${name.replace(/[^a-zA-Z0-9]/g, '-')}-ReachRight-Report.pdf"`,
        },
      });
    }

    // HTML preview (default — shareable link)
    const html = generateReportHTML({ name, address, type, score: finalScore, items, ai, recommendations, date });
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
