import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
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

/* ── HTML Report Generator ─────────────────────────────────────────────────── */

function generateReportHTML(data: {
  name: string; address: string; type: string; score: number;
  items: AuditItem[]; ai: { found: boolean; rank: number | null; mentioned: string[] };
  recommendations: string[]; date: string;
}): string {
  const { name, address, type, score, items, ai, recommendations, date } = data;
  const scoreColor = score >= 80 ? '#15803d' : score >= 50 ? '#ca8a04' : '#dc2626';
  const scoreLabel = score >= 80 ? 'Strong' : score >= 50 ? 'Needs Work' : 'Critical';
  const badCount = items.filter(i => i.status === 'bad').length;

  const statusIcon = (s: string) => s === 'good' ? '&#10003;' : s === 'warn' ? '&#9888;' : '&#10007;';
  const statusColor = (s: string) => s === 'good' ? '#15803d' : s === 'warn' ? '#ca8a04' : '#dc2626';
  const statusBg = (s: string) => s === 'good' ? '#f0fdf4' : s === 'warn' ? '#fefce8' : '#fef2f2';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; color: #1a1814; background: #fff; }
  .page { width: 794px; min-height: 1123px; padding: 48px; position: relative; page-break-after: always; }
  .page:last-child { page-break-after: avoid; }

  /* ── Page 1: Cover ── */
  .cover { background: linear-gradient(180deg, #faf8f5 0%, #fff 100%); }
  .cover-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 48px; }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-mark { width: 32px; height: 32px; background: #c2410c; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px; }
  .logo-text { font-size: 16px; font-weight: 600; color: #1a1814; letter-spacing: -0.3px; }
  .report-date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #9c9590; }
  .report-type { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #c2410c; margin-bottom: 12px; }
  .biz-name { font-family: 'Instrument Serif', serif; font-size: 42px; color: #1a1814; line-height: 1.1; margin-bottom: 8px; }
  .biz-address { font-size: 14px; color: #6b6560; margin-bottom: 48px; }

  .score-card { background: #1a1814; border-radius: 20px; padding: 40px; display: flex; align-items: center; gap: 40px; margin-bottom: 36px; }
  .score-circle { width: 120px; height: 120px; border-radius: 50%; border: 6px solid ${scoreColor}; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
  .score-num { font-family: 'JetBrains Mono', monospace; font-size: 40px; font-weight: 700; color: ${scoreColor}; line-height: 1; }
  .score-of { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #9c9590; margin-top: 2px; }
  .score-info h3 { font-size: 20px; font-weight: 700; color: ${scoreColor}; margin-bottom: 8px; }
  .score-info p { font-size: 14px; color: #9c9590; line-height: 1.5; }

  .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .stat-box { background: #faf8f5; border: 1px solid #e8e4dd; border-radius: 12px; padding: 16px; text-align: center; }
  .stat-val { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; color: #1a1814; }
  .stat-label { font-size: 11px; color: #9c9590; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }

  /* ── Page 2: Audit Details ── */
  .section-title { font-family: 'Instrument Serif', serif; font-size: 26px; color: #1a1814; margin-bottom: 20px; }
  .section-sub { font-size: 12px; color: #9c9590; margin-bottom: 16px; }

  .ai-box { background: #1a1814; border-radius: 16px; padding: 24px; margin-bottom: 32px; }
  .ai-title { font-size: 14px; font-weight: 600; color: #f2efe9; margin-bottom: 4px; }
  .ai-subtitle { font-size: 11px; color: #9c9590; margin-bottom: 16px; }
  .ai-list { list-style: none; }
  .ai-list li { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #9c9590; padding: 6px 12px; border-radius: 6px; margin-bottom: 3px; display: flex; align-items: center; gap: 8px; }
  .ai-list li.found { background: rgba(21, 128, 61, 0.1); color: #4ade80; }
  .ai-badge { font-size: 9px; background: rgba(21, 128, 61, 0.2); color: #4ade80; padding: 2px 6px; border-radius: 4px; }
  .ai-not-found { background: rgba(220, 38, 38, 0.08); border-radius: 8px; padding: 12px; margin-top: 12px; }
  .ai-not-found p { font-size: 11px; color: #fca5a5; line-height: 1.5; }

  .checklist { margin-bottom: 32px; }
  .check-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 12px; margin-bottom: 6px; }
  .check-icon { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; flex-shrink: 0; margin-top: 1px; }
  .check-content { flex: 1; }
  .check-label { font-size: 13px; font-weight: 600; color: #1a1814; }
  .check-value { font-family: 'JetBrains Mono', monospace; font-size: 11px; float: right; }
  .check-tip { font-size: 11px; color: #6b6560; margin-top: 3px; }

  /* ── Page 3: Recommendations + CTA ── */
  .rec-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #c2410c; font-weight: 700; margin-bottom: 6px; }
  .rec-text { font-size: 14px; color: #1a1814; line-height: 1.6; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e8e4dd; }
  .rec-text:last-child { border-bottom: none; }

  .cta-box { background: #c2410c; border-radius: 20px; padding: 36px; text-align: center; margin-top: 40px; }
  .cta-box h3 { font-family: 'Instrument Serif', serif; font-size: 26px; color: white; margin-bottom: 8px; }
  .cta-box p { font-size: 13px; color: rgba(255,255,255,0.8); margin-bottom: 20px; }
  .cta-contact { display: flex; justify-content: center; gap: 32px; }
  .cta-item { text-align: center; }
  .cta-item .label { font-size: 10px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; }
  .cta-item .val { font-family: 'JetBrains Mono', monospace; font-size: 14px; color: white; font-weight: 600; margin-top: 4px; }

  .footer { position: absolute; bottom: 24px; left: 48px; right: 48px; display: flex; justify-content: space-between; font-size: 10px; color: #9c9590; }

  @media print {
    .page { width: 100%; padding: 36px; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- PAGE 1: COVER + SCORE -->
<div class="page cover">
  <div class="cover-header">
    <div class="logo">
      <div class="logo-mark"><svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="15" r="9" stroke="white" stroke-width="2" fill="none" opacity="0.35"/><circle cx="16" cy="15" r="5" stroke="white" stroke-width="2" fill="none" opacity="0.65"/><circle cx="16" cy="15" r="2" fill="white"/><path d="M20 11L25 6" stroke="white" stroke-width="2.2" stroke-linecap="round"/><path d="M25 6L25 10" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M25 6L21 6" stroke="white" stroke-width="2" stroke-linecap="round"/></svg></div>
      <div class="logo-text">ReachRight</div>
    </div>
    <div class="report-date">${date}</div>
  </div>

  <div class="report-type">AI Visibility Report</div>
  <div class="biz-name">${name}</div>
  <div class="biz-address">${address}</div>

  <div class="score-card">
    <div class="score-circle">
      <div class="score-num">${score}</div>
      <div class="score-of">/100</div>
    </div>
    <div class="score-info">
      <h3>${scoreLabel}</h3>
      <p>${score >= 80 ? 'Your online presence and AI visibility are strong.' : score >= 50 ? `${badCount} issues are limiting your visibility. Fixing these could bring significantly more customers.` : `Your business is hard to find online. ${badCount} critical issues are costing you customers every day.`}</p>
    </div>
  </div>

  <div class="stats-row">
    <div class="stat-box">
      <div class="stat-val">${items.find(i => i.label === 'Google Rating')?.value || '—'}</div>
      <div class="stat-label">Google Rating</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${items.find(i => i.label === 'Reviews')?.value || '—'}</div>
      <div class="stat-label">Reviews</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${items.find(i => i.label === 'Website')?.status === 'good' ? 'Yes' : 'No'}</div>
      <div class="stat-label">Website</div>
    </div>
  </div>

  <div class="footer">
    <span>reachright.app</span>
    <span>Confidential — Prepared for ${name}</span>
  </div>
</div>

<!-- PAGE 2: DETAILED AUDIT -->
<div class="page">
  <div class="cover-header">
    <div class="logo"><div class="logo-mark"><svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="15" r="9" stroke="white" stroke-width="2" fill="none" opacity="0.35"/><circle cx="16" cy="15" r="5" stroke="white" stroke-width="2" fill="none" opacity="0.65"/><circle cx="16" cy="15" r="2" fill="white"/><path d="M20 11L25 6" stroke="white" stroke-width="2.2" stroke-linecap="round"/><path d="M25 6L25 10" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M25 6L21 6" stroke="white" stroke-width="2" stroke-linecap="round"/></svg></div><div class="logo-text">ReachRight</div></div>
    <div class="report-date">Page 2 of 3</div>
  </div>

  <div class="section-title">AI Visibility</div>
  <div class="ai-box">
    <div class="ai-title">${ai.found ? `Your business ranks #${ai.rank} in AI recommendations` : 'Your business is not recommended by AI'}</div>
    <div class="ai-subtitle">We asked: "Best ${(type || 'business').replace(/_/g, ' ')}s in your city"</div>
    <ul class="ai-list">
      ${ai.mentioned.map((m, i) => {
        const isMatch = m.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(m.toLowerCase());
        return `<li class="${isMatch ? 'found' : ''}">${i + 1}. ${m} ${isMatch ? '<span class="ai-badge">YOUR BUSINESS</span>' : ''}</li>`;
      }).join('\n      ')}
    </ul>
    ${!ai.found ? `<div class="ai-not-found"><p>When customers ask ChatGPT, Gemini, or Siri for recommendations, your business doesn't appear. As AI search grows, this gap will cost you more customers.</p></div>` : ''}
  </div>

  <div class="section-title">Google Presence Checklist</div>
  <div class="checklist">
    ${items.map(item => `
    <div class="check-item" style="background: ${statusBg(item.status)}">
      <div class="check-icon" style="background: ${statusColor(item.status)}">${statusIcon(item.status)}</div>
      <div class="check-content">
        <div class="check-label">${item.label} <span class="check-value" style="color: ${statusColor(item.status)}">${item.value}</span></div>
        <div class="check-tip">${item.tip}</div>
      </div>
    </div>`).join('\n    ')}
  </div>

  <div class="footer">
    <span>reachright.app</span>
    <span>Confidential — Prepared for ${name}</span>
  </div>
</div>

<!-- PAGE 3: RECOMMENDATIONS + CTA -->
<div class="page">
  <div class="cover-header">
    <div class="logo"><div class="logo-mark"><svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="15" r="9" stroke="white" stroke-width="2" fill="none" opacity="0.35"/><circle cx="16" cy="15" r="5" stroke="white" stroke-width="2" fill="none" opacity="0.65"/><circle cx="16" cy="15" r="2" fill="white"/><path d="M20 11L25 6" stroke="white" stroke-width="2.2" stroke-linecap="round"/><path d="M25 6L25 10" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M25 6L21 6" stroke="white" stroke-width="2" stroke-linecap="round"/></svg></div><div class="logo-text">ReachRight</div></div>
    <div class="report-date">Page 3 of 3</div>
  </div>

  <div class="section-title">What We Recommend</div>
  <div class="section-sub">Based on your audit, here are the top actions to improve your visibility:</div>

  ${recommendations.map((r, i) => `
  <div>
    <div class="rec-num">RECOMMENDATION ${i + 1}</div>
    <div class="rec-text">${r}</div>
  </div>`).join('\n  ')}

  <div class="cta-box">
    <h3>Ready to get found?</h3>
    <p>We'll build your website, optimize your Google listing, and make AI recommend your business.</p>
    <div class="cta-contact">
      <div class="cta-item">
        <div class="label">WhatsApp</div>
        <div class="val">+91 7439 677 931</div>
      </div>
      <div class="cta-item">
        <div class="label">Website</div>
        <div class="val">reachright.app</div>
      </div>
      <div class="cta-item">
        <div class="label">Email</div>
        <div class="val">mriganka.mondal@reachright.app</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>reachright.app</span>
    <span>Confidential — Prepared for ${name}</span>
  </div>
</div>

</body>
</html>`;
}

/* ── API Route ─────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const format = searchParams.get('format') || 'html'; // html or json

  if (!query || query.length < 3) {
    return NextResponse.json({ error: 'Enter business name and city' }, { status: 400 });
  }

  try {
    // 1. Find business
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

    // 2. Audit + AI checks in parallel
    const { score, items } = auditBusiness(place);
    const [ai, recommendations] = await Promise.all([
      getAIVisibility(name, type, city),
      getRecommendations(name, type, items, score),
    ]);

    // Add AI visibility to items
    if (ai.found) {
      items.unshift({ label: 'AI Visibility', status: ai.rank! <= 3 ? 'good' : 'warn', value: `#${ai.rank} in AI`, tip: 'AI assistants recommend your business.' });
    } else {
      items.unshift({ label: 'AI Visibility', status: 'bad', value: 'Not found', tip: 'AI assistants don\'t recommend your business.' });
      if (score > 20) { /* adjust score */ }
    }

    const finalScore = ai.found ? Math.min(100, score) : Math.max(0, score - 20);
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
