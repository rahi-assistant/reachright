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
].join(',');

interface PlaceResult {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryType?: string;
  businessStatus?: string;
  photos?: unknown[];
  regularOpeningHours?: unknown;
}

function scorePlace(place: PlaceResult): { score: number; issues: string[] } {
  let score = 0;
  const issues: string[] = [];

  const website = place.websiteUri || '';
  if (!website) {
    score += 35;
    issues.push('No website');
  } else if (website.includes('instagram.com') || website.includes('facebook.com')) {
    score += 25;
    issues.push('Social media as website');
  }

  const rating = place.rating || 0;
  if (rating === 0) { score += 10; issues.push('No Google rating'); }
  else if (rating < 3.5) { score += 8; issues.push(`Low rating (${rating})`); }
  else if (rating < 4.0) { score += 4; issues.push(`Below avg rating (${rating})`); }

  const reviews = place.userRatingCount || 0;
  if (reviews === 0) { score += 12; issues.push('Zero reviews'); }
  else if (reviews < 10) { score += 8; issues.push(`Very few reviews (${reviews})`); }
  else if (reviews < 50) { score += 4; issues.push(`Low reviews (${reviews})`); }

  const photos = place.photos || [];
  if (photos.length === 0) { score += 8; issues.push('No photos'); }
  else if (photos.length < 3) { score += 4; issues.push(`Few photos (${photos.length})`); }

  if (!place.regularOpeningHours) { score += 5; issues.push('No hours listed'); }

  return { score: Math.min(score, 100), issues };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city') || 'Kolkata';
  const type = searchParams.get('type') || 'restaurants';

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
      body: JSON.stringify({
        textQuery: `${type} in ${city}`,
        maxResultCount: 20,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Google API error: ${response.status}`, detail: errText }, { status: 502 });
    }

    const data = await response.json();
    const places: PlaceResult[] = data.places || [];

    const results = places
      .map(place => {
        const { score, issues } = scorePlace(place);
        return {
          name: place.displayName?.text || 'Unknown',
          address: place.formattedAddress || '',
          website: place.websiteUri || 'NONE',
          rating: place.rating || 0,
          reviews: place.userRatingCount || 0,
          score,
          issues,
        };
      })
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({
      city,
      type,
      count: results.length,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
