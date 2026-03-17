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

function parseRankedMentions(text: string): string[] {
  const normalized = text
    .replace(/\r/g, '')
    .replace(/(^|\n)\s*(\d{1,2})[\.\)]?\s*\n\s*(?=\S)/g, '$1$2. ')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '');

  return normalized
    .split('\n')
    .map(line => line.replace(/^\s*\d{1,2}[\.\)\-:]\s*/, '').trim())
    .filter(line => line.length > 1)
    .filter(line => !/^\d+$/.test(line))
    .filter(line => /[A-Za-z]/.test(line))
    .slice(0, 10);
}

/* ── HTML Report Generator ─────────────────────────────────────────────────── */

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

    // 3. Generate PDF report


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
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
