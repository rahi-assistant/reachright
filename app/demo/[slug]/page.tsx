import { notFound } from 'next/navigation';

// Demo pages are generated per-business as static HTML
// To create a demo: add a folder in public/demos/{slug}.html
// Or we generate them dynamically from the DB

const DEMOS: Record<string, {
  name: string;
  tagline: string;
  type: string;
  address: string;
  phone: string;
  hours: string;
  rating: number;
  reviews: number;
  heroImage: string;
  color: string;
  features: string[];
}> = {
  'peter-cat': {
    name: 'Peter Cat',
    tagline: 'Legendary Continental & Indian cuisine since 1991',
    type: 'Restaurant & Bar',
    address: '18A, Park Street, Kolkata 700071',
    phone: '+91 33 2229 8841',
    hours: 'Mon-Sun: 12 PM - 11 PM',
    rating: 4.2,
    reviews: 39807,
    heroImage: 'https://lh3.googleusercontent.com/places/ANXAkqG8xN1J4GHVnT_2LTxPqRqPRJWqBYFvOGrD_EMLdtVBLl05OPHjNj6FqUjXJnHl2KqFr6_yH1pFPVAqUz6XWUvVJBDqGw=s1600-w400',
    color: '#8B2500',
    features: ['Chelo Kebab', 'Sizzlers', 'Full Bar', 'Live Music Weekends'],
  },
  'mocambo': {
    name: 'Mocambo',
    tagline: 'Where Kolkata comes to celebrate — since 1956',
    type: 'Restaurant & Bar',
    address: '25B, Free School Street, Kolkata 700016',
    phone: '+91 33 4065 5380',
    hours: 'Mon-Sun: 12 PM - 10:30 PM',
    rating: 4.3,
    reviews: 16836,
    heroImage: '',
    color: '#1a365d',
    features: ['Continental Cuisine', 'Devilled Crab', 'Classic Ambiance', 'Family Dining'],
  },
  'wavelength-salon': {
    name: 'Wavelength Salon',
    tagline: 'Premium hair & beauty — Kankurgachi',
    type: 'Salon & Spa',
    address: 'P-62, CIT Road, Kankurgachi, Kolkata 700054',
    phone: '+91 62901 92038',
    hours: 'Mon-Sat: 10 AM - 8 PM',
    rating: 4.6,
    reviews: 2878,
    heroImage: '',
    color: '#7c3aed',
    features: ['Hair Styling', 'Bridal Makeup', 'Spa Treatments', 'Keratin Treatment'],
  },
};

export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const biz = DEMOS[slug];
  if (!biz) notFound();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1a1a1a', background: '#fff' }}>
      {/* Demo banner */}
      <div style={{ background: '#f59e0b', color: '#000', textAlign: 'center', padding: '8px', fontSize: '13px', fontWeight: 600 }}>
        This is a demo website created by ReachRight.app — not affiliated with {biz.name}
      </div>

      {/* Hero */}
      <div style={{ background: biz.color, color: 'white', padding: '60px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', opacity: 0.8, letterSpacing: '2px', textTransform: 'uppercase' }}>{biz.type}</p>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: '12px 0', fontWeight: 700 }}>{biz.name}</h1>
        <p style={{ fontSize: '18px', opacity: 0.9, maxWidth: '500px', margin: '0 auto' }}>{biz.tagline}</p>
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`tel:${biz.phone}`} style={{ background: 'white', color: biz.color, padding: '12px 24px', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>
            Call Now
          </a>
          <a href={`https://wa.me/${biz.phone.replace(/[^0-9]/g, '')}`} style={{ background: '#25D366', color: 'white', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>
            WhatsApp
          </a>
        </div>
      </div>

      {/* Info strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1px', background: '#e5e5e5' }}>
        {[
          { label: 'Rating', value: `★ ${biz.rating}/5` },
          { label: 'Reviews', value: `${biz.reviews.toLocaleString()}+` },
          { label: 'Hours', value: biz.hours.split(': ')[1] || biz.hours },
        ].map(item => (
          <div key={item.label} style={{ background: 'white', padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.label}</p>
            <p style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ padding: '48px 24px', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '24px', textAlign: 'center', marginBottom: '24px' }}>What We Offer</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {biz.features.map(f => (
            <div key={f} style={{ padding: '16px', background: '#f8f8f8', borderRadius: '8px', textAlign: 'center', fontSize: '14px', fontWeight: 500 }}>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Location */}
      <div style={{ padding: '48px 24px', background: '#f8f8f8', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Visit Us</h2>
        <p style={{ color: '#666', fontSize: '15px' }}>{biz.address}</p>
        <p style={{ color: '#666', fontSize: '15px', marginTop: '4px' }}>{biz.hours}</p>
        <p style={{ color: '#666', fontSize: '15px', marginTop: '4px' }}>{biz.phone}</p>
      </div>

      {/* CTA */}
      <div style={{ padding: '48px 24px', textAlign: 'center', background: biz.color, color: 'white' }}>
        <p style={{ fontSize: '14px', opacity: 0.8 }}>Want a website like this for your business?</p>
        <h2 style={{ fontSize: '24px', margin: '8px 0' }}>Built by ReachRight in 48 hours</h2>
        <a href="https://reachright.app" style={{ display: 'inline-block', marginTop: '16px', background: 'white', color: biz.color, padding: '12px 24px', borderRadius: '8px', fontWeight: 600, textDecoration: 'none' }}>
          Get Your Free Audit →
        </a>
      </div>
    </div>
  );
}
