import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

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

function auditBusiness(place: Record<string, unknown>): { score: number; items: AuditItem[]; summary: string } {
  const items: AuditItem[] = [];
  let score = 100;

  // Website
  const website = (place.websiteUri as string) || '';
  if (!website) {
    score -= 30;
    items.push({ label: 'Website', status: 'bad', value: 'Not found', tip: 'A website helps customers find you 24/7. Even a simple one-page site makes a difference.' });
  } else if (website.includes('instagram.com') || website.includes('facebook.com')) {
    score -= 15;
    items.push({ label: 'Website', status: 'warn', value: 'Social media only', tip: 'Social pages are good, but a dedicated website ranks better on Google and looks more professional.' });
  } else {
    items.push({ label: 'Website', status: 'good', value: website.replace(/https?:\/\//, '').replace(/\/$/, '').substring(0, 35), tip: 'You have a website. Make sure it loads fast on mobile.' });
  }

  // Rating
  const rating = (place.rating as number) || 0;
  if (rating === 0) {
    score -= 15;
    items.push({ label: 'Google Rating', status: 'bad', value: 'No rating', tip: 'Ask your happy customers to leave a Google review. Even 10 reviews makes a big difference.' });
  } else if (rating < 4.0) {
    score -= 10;
    items.push({ label: 'Google Rating', status: 'warn', value: `${rating} / 5.0`, tip: 'Below 4.0 can turn customers away. Respond to negative reviews professionally to improve perception.' });
  } else {
    items.push({ label: 'Google Rating', status: 'good', value: `${rating} / 5.0`, tip: 'Great rating! Keep it up by consistently delivering quality service.' });
  }

  // Reviews
  const reviews = (place.userRatingCount as number) || 0;
  if (reviews === 0) {
    score -= 15;
    items.push({ label: 'Reviews', status: 'bad', value: '0 reviews', tip: 'Zero reviews means Google won\'t show you in search results. Ask 10 regular customers this week.' });
  } else if (reviews < 50) {
    score -= 8;
    items.push({ label: 'Reviews', status: 'warn', value: `${reviews} reviews`, tip: `You have ${reviews} reviews. Your competitors may have hundreds. A simple "please review us" card at checkout helps.` });
  } else {
    items.push({ label: 'Reviews', status: 'good', value: `${reviews.toLocaleString()} reviews`, tip: 'Strong review count. Keep encouraging happy customers to review.' });
  }

  // Photos
  const photos = (place.photos as unknown[]) || [];
  if (photos.length === 0) {
    score -= 12;
    items.push({ label: 'Photos', status: 'bad', value: 'No photos', tip: 'Businesses with photos get 42% more requests for directions. Upload at least 10 quality photos.' });
  } else if (photos.length < 5) {
    score -= 5;
    items.push({ label: 'Photos', status: 'warn', value: `${photos.length} photos`, tip: 'Add more photos — interior, food/products, team, exterior. Aim for 15+.' });
  } else {
    items.push({ label: 'Photos', status: 'good', value: `${photos.length}+ photos`, tip: 'Good photo coverage. Update seasonally to keep your listing fresh.' });
  }

  // Hours
  const hasHours = Boolean(place.regularOpeningHours);
  if (!hasHours) {
    score -= 8;
    items.push({ label: 'Opening Hours', status: 'bad', value: 'Not listed', tip: 'Customers check hours before visiting. Missing hours = lost walk-ins.' });
  } else {
    items.push({ label: 'Opening Hours', status: 'good', value: 'Listed', tip: 'Hours are set. Make sure to update for holidays.' });
  }

  // Phone
  const phone = (place.internationalPhoneNumber as string) || '';
  if (!phone) {
    score -= 5;
    items.push({ label: 'Phone Number', status: 'bad', value: 'Not listed', tip: 'Add your phone number so customers can call directly from Google.' });
  } else {
    items.push({ label: 'Phone Number', status: 'good', value: 'Listed', tip: 'Phone is set. Consider adding WhatsApp for younger customers.' });
  }

  score = Math.max(0, score);

  const badCount = items.filter(i => i.status === 'bad').length;
  const summary = score >= 80
    ? 'Your online presence is strong. Small tweaks can make it even better.'
    : score >= 50
    ? `You have ${badCount} issues holding you back. Fixing these could bring you significantly more customers.`
    : `Your business is hard to find online. ${badCount} critical issues are costing you customers every day.`;

  return { score, items, summary };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';

  if (!query || query.length < 3) {
    return NextResponse.json({ error: 'Enter your business name and city' }, { status: 400 });
  }
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(PLACES_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Search failed' }, { status: 502 });
    }

    const data = await response.json();
    const places = (data.places || []) as Record<string, unknown>[];

    const results = places.map(place => {
      const { score, items, summary } = auditBusiness(place);
      return {
        name: ((place.displayName as Record<string, string>)?.text) || 'Unknown',
        address: (place.formattedAddress as string) || '',
        type: (place.primaryType as string) || '',
        mapsUrl: (place.googleMapsUri as string) || '',
        score,
        items,
        summary,
      };
    });

    return NextResponse.json({ query, results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
