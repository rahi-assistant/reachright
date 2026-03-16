import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.primaryType',
  'places.businessStatus',
  'places.photos',
  'places.regularOpeningHours',
  'places.internationalPhoneNumber',
  'places.reviews',
].join(',');

interface AuditItem {
  label: string;
  status: 'good' | 'warn' | 'bad';
  value: string;
  tip: string;
}

/* ── Gemini: LLM Visibility Check ──────────────────────────────────────────── */

async function checkLLMVisibility(businessName: string, businessType: string, city: string): Promise<{
  found: boolean;
  rank: number | null;
  mentioned: string[];
  tip: string;
}> {
  if (!GEMINI_API_KEY) return { found: false, rank: null, mentioned: [], tip: 'AI visibility check unavailable.' };

  // Normalize type for natural query
  const typeLabel = (businessType || '').replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim().toLowerCase() || 'business';

  const prompt = `List the top 10 best ${typeLabel}s in ${city}, India. Just names, numbered 1-10. No descriptions, no explanations.`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
      }),
    });

    if (!res.ok) return { found: false, rank: null, mentioned: [], tip: 'AI check failed.' };

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the numbered list
    const lines = text.split('\n').filter((l: string) => l.trim());
    const mentioned: string[] = [];
    let rank: number | null = null;
    const nameLower = businessName.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/^\d+[\.\)\-]\s*/, '').trim();
      if (line) mentioned.push(line);
      if (line.toLowerCase().includes(nameLower) || nameLower.includes(line.toLowerCase())) {
        rank = i + 1;
      }
    }

    return {
      found: rank !== null,
      rank,
      mentioned: mentioned.slice(0, 10),
      tip: rank
        ? `Your business ranks #${rank} in AI recommendations. This means AI assistants will suggest you to potential customers.`
        : `AI assistants like ChatGPT and Google Gemini don't recommend your business when asked for "best ${typeLabel}s in ${city}." This means you're invisible to a growing number of customers who search using AI.`,
    };
  } catch {
    return { found: false, rank: null, mentioned: [], tip: 'AI visibility check timed out.' };
  }
}

/* ── Gemini: Review Sentiment Analysis ─────────────────────────────────────── */

async function analyzeReviewSentiment(reviews: Array<Record<string, unknown>>, businessName: string): Promise<{
  sentiment: 'positive' | 'mixed' | 'negative' | 'none';
  strengths: string[];
  weaknesses: string[];
  tip: string;
}> {
  if (!GEMINI_API_KEY || !reviews || reviews.length === 0) {
    return { sentiment: 'none', strengths: [], weaknesses: [], tip: 'No reviews to analyze.' };
  }

  // Extract review texts (Google Places API returns reviews with text)
  const reviewTexts = reviews
    .slice(0, 5)
    .map(r => {
      const textObj = r.text as Record<string, string> | undefined;
      return textObj?.text || '';
    })
    .filter(t => t.length > 0)
    .join('\n---\n');

  if (!reviewTexts) {
    return { sentiment: 'none', strengths: [], weaknesses: [], tip: 'No review text available.' };
  }

  const prompt = `Analyze these customer reviews for "${businessName}". Return ONLY a JSON object with:
- "sentiment": "positive" or "mixed" or "negative"
- "strengths": array of 2-3 short phrases customers praise
- "weaknesses": array of 1-2 short phrases customers complain about (empty if none)

Reviews:
${reviewTexts}

Return ONLY valid JSON, nothing else.`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
      }),
    });

    if (!res.ok) return { sentiment: 'none', strengths: [], weaknesses: [], tip: 'Sentiment analysis failed.' };

    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    const sentiment = parsed.sentiment || 'mixed';
    const strengths: string[] = parsed.strengths || [];
    const weaknesses: string[] = parsed.weaknesses || [];

    let tip = '';
    if (sentiment === 'positive') {
      tip = `Customers love ${strengths.slice(0, 2).join(' and ')}. Highlight these in your online presence.`;
    } else if (sentiment === 'negative') {
      tip = `Customers mention issues with ${weaknesses.slice(0, 2).join(' and ')}. Addressing these in your Google responses can improve perception.`;
    } else {
      tip = strengths.length > 0
        ? `Customers praise ${strengths[0]} but some mention ${weaknesses[0] || 'room for improvement'}. Responding to reviews shows you care.`
        : 'Mixed reviews. Respond professionally to negative ones and encourage happy customers to review.';
    }

    return { sentiment, strengths, weaknesses, tip };
  } catch {
    return { sentiment: 'none', strengths: [], weaknesses: [], tip: 'Could not analyze reviews.' };
  }
}

/* ── Core Audit ────────────────────────────────────────────────────────────── */

function auditBusiness(place: Record<string, unknown>): { score: number; items: AuditItem[] } {
  const items: AuditItem[] = [];
  let score = 100;

  // Website
  const website = (place.websiteUri as string) || '';
  if (!website) {
    score -= 25;
    items.push({ label: 'Website', status: 'bad', value: 'Not found', tip: 'A website helps customers find you 24/7. Even a simple one-page site makes a difference.' });
  } else if (website.includes('instagram.com') || website.includes('facebook.com')) {
    score -= 12;
    items.push({ label: 'Website', status: 'warn', value: 'Social media only', tip: 'Social pages are good, but a dedicated website ranks better on Google and looks more professional.' });
  } else {
    items.push({ label: 'Website', status: 'good', value: website.replace(/https?:\/\//, '').replace(/\/$/, '').substring(0, 35), tip: 'You have a website. Make sure it loads fast on mobile.' });
  }

  // Rating
  const rating = (place.rating as number) || 0;
  if (rating === 0) {
    score -= 10;
    items.push({ label: 'Google Rating', status: 'bad', value: 'No rating', tip: 'Ask your happy customers to leave a Google review. Even 10 reviews makes a big difference.' });
  } else if (rating < 4.0) {
    score -= 7;
    items.push({ label: 'Google Rating', status: 'warn', value: `${rating} / 5.0`, tip: 'Below 4.0 can turn customers away. Respond to negative reviews professionally.' });
  } else {
    items.push({ label: 'Google Rating', status: 'good', value: `${rating} / 5.0`, tip: 'Great rating. Keep delivering quality service.' });
  }

  // Reviews
  const reviews = (place.userRatingCount as number) || 0;
  if (reviews === 0) {
    score -= 10;
    items.push({ label: 'Reviews', status: 'bad', value: '0 reviews', tip: 'Zero reviews means Google won\'t show you in results. Ask 10 regular customers this week.' });
  } else if (reviews < 50) {
    score -= 5;
    items.push({ label: 'Reviews', status: 'warn', value: `${reviews} reviews`, tip: `You have ${reviews} reviews. Competitors may have hundreds. A "please review us" card at checkout helps.` });
  } else {
    items.push({ label: 'Reviews', status: 'good', value: `${reviews.toLocaleString()} reviews`, tip: 'Strong review count. Keep encouraging reviews.' });
  }

  // Photos
  const photos = (place.photos as unknown[]) || [];
  if (photos.length === 0) {
    score -= 8;
    items.push({ label: 'Photos', status: 'bad', value: 'No photos', tip: 'Businesses with photos get 42% more direction requests. Upload at least 10 quality photos.' });
  } else if (photos.length < 5) {
    score -= 4;
    items.push({ label: 'Photos', status: 'warn', value: `${photos.length} photos`, tip: 'Add more — interior, products, team, exterior. Aim for 15+.' });
  } else {
    items.push({ label: 'Photos', status: 'good', value: `${photos.length}+ photos`, tip: 'Good photo coverage. Update seasonally.' });
  }

  // Hours
  if (!place.regularOpeningHours) {
    score -= 5;
    items.push({ label: 'Opening Hours', status: 'bad', value: 'Not listed', tip: 'Customers check hours before visiting. Missing hours = lost walk-ins.' });
  } else {
    items.push({ label: 'Opening Hours', status: 'good', value: 'Listed', tip: 'Hours are set. Update for holidays.' });
  }

  // Phone
  if (!(place.internationalPhoneNumber as string)) {
    score -= 3;
    items.push({ label: 'Phone Number', status: 'bad', value: 'Not listed', tip: 'Add your phone so customers can call from Google.' });
  } else {
    items.push({ label: 'Phone Number', status: 'good', value: 'Listed', tip: 'Phone is set. Consider adding WhatsApp for younger customers.' });
  }

  return { score: Math.max(0, score), items };
}

/* ── API Route ─────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';

  if (!query || query.length < 3) {
    return NextResponse.json({ error: 'Enter your business name and city' }, { status: 400 });
  }
  if (!MAPS_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    // Step 1: Find the business on Google Maps
    const response = await fetch(PLACES_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': MAPS_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Search failed' }, { status: 502 });
    }

    const data = await response.json();
    const places = (data.places || []) as Record<string, unknown>[];

    // Step 2: Audit each place + AI checks (run in parallel for the first result)
    const results = await Promise.all(places.map(async (place, index) => {
      const name = ((place.displayName as Record<string, string>)?.text) || 'Unknown';
      const address = (place.formattedAddress as string) || '';
      const type = (place.primaryType as string) || '';
      const city = address.split(',').slice(-3, -1).join(',').trim() || 'the city';

      const { score: baseScore, items } = auditBusiness(place);

      // Only run AI checks for the first result (to save API calls)
      // Other results get basic audit only
      let aiVisibility = null;
      let reviewSentiment = null;
      let finalScore = baseScore;

      if (index === 0) {
        // Run AI checks in parallel
        const [visibility, sentiment] = await Promise.all([
          checkLLMVisibility(name, type, city),
          analyzeReviewSentiment((place.reviews as Array<Record<string, unknown>>) || [], name),
        ]);

        aiVisibility = visibility;
        reviewSentiment = sentiment;

        // AI Visibility scoring (worth 20 points of the total)
        if (!visibility.found) {
          finalScore -= 20;
          items.unshift({
            label: 'AI Visibility',
            status: 'bad',
            value: 'Not found in AI',
            tip: visibility.tip,
          });
        } else {
          items.unshift({
            label: 'AI Visibility',
            status: visibility.rank! <= 3 ? 'good' : 'warn',
            value: `#${visibility.rank} in AI results`,
            tip: visibility.tip,
          });
          if (visibility.rank! > 5) finalScore -= 8;
        }

        // Sentiment scoring (worth 7 points)
        if (sentiment.sentiment === 'negative') {
          finalScore -= 7;
          items.push({
            label: 'Review Sentiment',
            status: 'bad',
            value: 'Negative trend',
            tip: sentiment.tip,
          });
        } else if (sentiment.sentiment === 'mixed') {
          finalScore -= 3;
          items.push({
            label: 'Review Sentiment',
            status: 'warn',
            value: 'Mixed feedback',
            tip: sentiment.tip,
          });
        } else if (sentiment.sentiment === 'positive') {
          items.push({
            label: 'Review Sentiment',
            status: 'good',
            value: 'Positive',
            tip: sentiment.tip,
          });
        }
      }

      finalScore = Math.max(0, Math.min(100, finalScore));

      const badCount = items.filter(i => i.status === 'bad').length;
      const summary = finalScore >= 80
        ? 'Your online presence and AI visibility are strong.'
        : finalScore >= 50
        ? `${badCount} issues are limiting your visibility. Fixing these could bring significantly more customers.`
        : `Your business is hard to find online and invisible to AI. ${badCount} critical issues are costing you customers every day.`;

      return {
        name,
        address,
        type,
        mapsUrl: (place.googleMapsUri as string) || '',
        score: finalScore,
        items,
        summary,
        aiVisibility: index === 0 ? aiVisibility : null,
        reviewSentiment: index === 0 ? reviewSentiment : null,
      };
    }));

    return NextResponse.json({ query, results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
