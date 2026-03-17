import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Svg, Circle, Path } from '@react-pdf/renderer';

// Register JetBrains Mono for data/labels
Font.register({
  family: 'Mono',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});

// Disable hyphenation globally
Font.registerHyphenationCallback(word => [word]);

const theme = {
  bg: '#F8F6F2',
  cardBg: '#FFFFFF',
  darkBg: '#1A1816',
  darkCard: '#24211D',
  textMain: '#1A1A1A',
  textSecondary: '#666666',
  textLight: '#F2EFE9',
  accent: '#C4623C',
  accentSoft: '#FFF5EE',
  border: '#E5E0D8',
  danger: '#DC2626',
  warning: '#CA8A04',
  success: '#15803D',
};

const s = StyleSheet.create({
  page: { padding: 40, backgroundColor: theme.bg, fontFamily: 'Helvetica' },

  // Topbar
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${theme.border}`, paddingBottom: 12, marginBottom: 30 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandLogo: { width: 28, height: 28, backgroundColor: theme.accent, borderRadius: 6, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  brandName: { fontSize: 16, fontWeight: 'bold', color: theme.textMain },
  brandSub: { fontSize: 8, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 1, fontFamily: 'Mono' },
  pageNum: { fontSize: 9, color: theme.textSecondary, fontFamily: 'Mono' },

  // Hero
  hero: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  heroCopy: { width: '54%' },
  eyebrow: { fontSize: 8, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6, fontFamily: 'Mono' },
  reportTitle: { fontSize: 32, fontWeight: 'bold', marginBottom: 12, color: theme.textMain, lineHeight: 1.1, fontFamily: 'Helvetica-Bold' },
  heroBody: { fontSize: 11, color: theme.textSecondary, lineHeight: 1.55 },
  subjectCard: { borderTop: `1px solid ${theme.border}`, paddingTop: 12, marginTop: 16 },
  subjectName: { fontSize: 16, fontWeight: 'bold', color: theme.textMain, marginBottom: 3 },
  subjectMeta: { fontSize: 10, color: theme.textSecondary, lineHeight: 1.4 },

  // Score card
  scoreCard: { width: '40%', backgroundColor: theme.darkBg, padding: 20, borderRadius: 10, alignItems: 'center' },
  scoreNum: { fontSize: 44, fontWeight: 'bold', color: theme.textLight, fontFamily: 'Helvetica-Bold' },
  scoreMax: { fontSize: 11, color: theme.textSecondary, fontFamily: 'Mono', marginTop: -2 },
  scoreLabel: { fontSize: 14, fontWeight: 'bold', color: theme.textLight, marginTop: 12, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  scoreBody: { fontSize: 9, color: '#A09D98', textAlign: 'center', lineHeight: 1.5 },

  // Stat cards
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statCard: { width: '24%', backgroundColor: theme.cardBg, padding: 12, border: `1px solid ${theme.border}`, borderRadius: 6 },
  statLabel: { fontSize: 7, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontFamily: 'Mono' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: theme.textMain },

  // Summary
  summaryCard: { backgroundColor: theme.accentSoft, padding: 14, borderRadius: 8, marginBottom: 10 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', color: theme.textMain, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  summaryText: { fontSize: 10, color: theme.textSecondary, lineHeight: 1.5 },

  // Section header
  sectionHeader: { marginBottom: 16, borderBottom: `1px solid ${theme.border}`, paddingBottom: 8 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: theme.textMain, fontFamily: 'Helvetica-Bold' },
  sectionCopy: { fontSize: 10, color: theme.textSecondary, marginTop: 3 },

  // Checklist
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: theme.cardBg, padding: 12, border: `1px solid ${theme.border}`, borderRadius: 6, marginBottom: 8 },
  checkBadge: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 1 },
  checkMain: { flex: 1 },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  checkTitle: { fontSize: 12, fontWeight: 'bold', color: theme.textMain },
  checkValue: { fontSize: 9, color: theme.textSecondary, fontFamily: 'Mono' },
  checkMeta: { fontSize: 7, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Mono', marginBottom: 2 },
  checkTip: { fontSize: 9, color: theme.textSecondary, lineHeight: 1.4 },

  // AI panel
  aiPanel: { backgroundColor: theme.darkBg, padding: 20, borderRadius: 10, marginBottom: 20 },
  aiTitle: { fontSize: 20, color: '#F6D38F', marginBottom: 10, fontFamily: 'Helvetica-Bold' },
  aiText: { fontSize: 11, color: theme.textLight, opacity: 0.8, marginBottom: 16, lineHeight: 1.5 },
  modelGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  modelCard: { width: '48%', backgroundColor: theme.darkCard, padding: 14, borderRadius: 8 },
  modelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modelName: { fontSize: 11, fontWeight: 'bold', color: theme.textLight },
  modelBadge: { fontSize: 8, color: theme.accent, fontFamily: 'Mono', backgroundColor: 'rgba(196,98,60,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  aiRow: { flexDirection: 'row', padding: 8, borderRadius: 4, alignItems: 'center', marginBottom: 4 },
  aiRank: { width: 20, fontSize: 10, color: theme.textSecondary, fontFamily: 'Mono' },
  aiName: { flex: 1, fontSize: 10, color: theme.textLight },

  // Roadmap
  roadmapRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  phaseCard: { width: '31%', backgroundColor: theme.cardBg, padding: 14, border: `1px solid ${theme.border}`, borderRadius: 8 },
  phaseKicker: { fontSize: 8, color: theme.accent, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontFamily: 'Mono' },
  phaseTitle: { fontSize: 14, fontWeight: 'bold', color: theme.textMain, marginBottom: 6 },
  phaseText: { fontSize: 9, color: theme.textSecondary, lineHeight: 1.5 },

  // CTA
  ctaCard: { padding: 20, backgroundColor: theme.accentSoft, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between' },
  ctaCopy: { width: '58%' },
  ctaTitle: { fontSize: 16, fontWeight: 'bold', color: theme.textMain, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  ctaText: { fontSize: 10, color: theme.textSecondary, lineHeight: 1.5 },
  contactStack: { width: '36%' },
  contactItem: { backgroundColor: theme.cardBg, padding: 10, borderRadius: 5, marginBottom: 6 },
  contactLabel: { fontSize: 7, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, fontFamily: 'Mono' },
  contactValue: { fontSize: 10, fontWeight: 'bold', color: theme.textMain },

  // Footer
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTop: `1px solid ${theme.border}`, paddingTop: 10 },
  footerText: { fontSize: 8, color: theme.textSecondary, fontFamily: 'Mono' },
});

const getStatusColor = (status: string) => status === 'good' ? theme.success : status === 'warn' ? theme.warning : theme.danger;
const getStatusLabel = (status: string) => status === 'good' ? 'Healthy' : status === 'warn' ? 'Watch' : 'Critical';

const Topbar = ({ sub, pageNum, name: _name }: { sub: string; pageNum: string; name?: string }) => (
  <View style={s.topbar}>
    <View style={s.brandRow}>
      <View style={s.brandLogo}>
        <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold', fontFamily: 'Helvetica-Bold' }}>R</Text>
      </View>
      <View>
        <Text style={s.brandName}>ReachRight</Text>
        <Text style={s.brandSub}>{sub}</Text>
      </View>
    </View>
    <Text style={s.pageNum}>{pageNum}</Text>
  </View>
);

const Footer = ({ name }: { name: string }) => (
  <View style={s.footer}>
    <Text style={s.footerText}>reachright.app</Text>
    <Text style={s.footerText}>Confidential report for {name}</Text>
  </View>
);

export const ReportPDF = ({ data }: { data: any }) => {
  const { name, address, type, score, items, ai, recommendations, date } = data;

  const scoreLabel = score >= 80 ? 'Strong Presence' : score >= 50 ? 'Needs Work' : 'Critical Gaps';
  const scoreSummary = score >= 80
    ? 'Your presence is already credible. The next move is holding rank and compounding discovery.'
    : score >= 50
    ? 'Your business is visible, but trust and discovery signals are still inconsistent.'
    : 'Your business is losing visibility across both Google and AI-assisted discovery.';

  const typeLabel = (type || 'business').replace(/_/g, ' ');

  // Split items for stat cards (first 4 key metrics)
  const statItems = items.slice(0, 4);
  // All items for checklist
  const allItems = items;

  return (
    <Document>
      {/* PAGE 1: Cover + Stats + Executive Summary */}
      <Page size="A4" style={s.page}>
        <Topbar sub="Premium Visibility Report" pageNum={date} />

        <View style={s.hero}>
          <View style={s.heroCopy}>
            <Text style={s.eyebrow}>Prepared for local businesses</Text>
            <Text style={s.reportTitle}>{'AI Visibility &\nLocal Presence'}</Text>
            <Text style={s.heroBody}>
              A premium review of how {name} appears across Google Business signals, website readiness, review strength, and AI-generated recommendations.
            </Text>
            <View style={s.subjectCard}>
              <Text style={s.eyebrow}>Business reviewed</Text>
              <Text style={s.subjectName}>{name}</Text>
              <Text style={s.subjectMeta}>{address}</Text>
              <Text style={s.subjectMeta}>{typeLabel}</Text>
            </View>
          </View>

          <View style={s.scoreCard}>
            <Text style={{ ...s.eyebrow, color: '#A09D98' }}>Overall Score</Text>
            <View style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: theme.accent, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginVertical: 12 }}>
              <Text style={s.scoreNum}>{score}</Text>
              <Text style={s.scoreMax}>/100</Text>
            </View>
            <Text style={s.scoreLabel}>{scoreLabel}</Text>
            <Text style={s.scoreBody}>{scoreSummary}</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          {statItems.map((item: any, i: number) => (
            <View key={i} style={s.statCard}>
              <Text style={s.statLabel}>{item.label}</Text>
              <Text style={{ ...s.statValue, color: getStatusColor(item.status) }}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={s.summaryCard}>
          <Text style={s.summaryTitle}>Executive Summary</Text>
          <Text style={s.summaryText}>
            This report shows what already looks credible online, where discovery is breaking, and which fixes should be prioritised first.
          </Text>
        </View>

        <Footer name={name} />
      </Page>

      {/* PAGE 2: AI Scan + Signal Checklist */}
      <Page size="A4" style={s.page}>
        <Topbar sub="Detailed Diagnosis" pageNum="Page 2 of 3" />

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>AI Recommendation Scan</Text>
          <Text style={s.sectionCopy}>How leading AI models currently rank your business for local queries.</Text>
        </View>

        <View style={s.aiPanel}>
          <Text style={s.aiTitle}>{ai.found ? 'Recommended by AI' : 'Invisible to AI models'}</Text>
          <Text style={s.aiText}>
            {ai.found
              ? `${name} appears in at least one AI recommendation set. The next step is improving position across all models.`
              : `${name} is absent from AI recommendation sets. AI-first customers are being routed to competitors.`}
          </Text>
          <View style={s.modelGrid}>
            <View style={s.modelCard}>
              <View style={s.modelHead}>
                <Text style={s.modelName}>Google Gemini</Text>
                <Text style={s.modelBadge}>{ai.geminiFound ? `#${ai.geminiRank}` : 'Not Ranked'}</Text>
              </View>
              {(ai.mentioned || []).slice(0, 5).map((m: string, i: number) => (
                <View key={i} style={{ ...s.aiRow, backgroundColor: m.toLowerCase().includes(name.toLowerCase()) ? 'rgba(21,128,61,0.15)' : 'rgba(255,255,255,0.03)' }}>
                  <Text style={s.aiRank}>{i + 1}</Text>
                  <Text style={s.aiName}>{m}</Text>
                </View>
              ))}
              {(!ai.mentioned || ai.mentioned.length === 0) && (
                <View style={{ ...s.aiRow, backgroundColor: 'rgba(255,255,255,0.03)' }}>
                  <Text style={s.aiRank}>-</Text>
                  <Text style={s.aiName}>No recommendations found</Text>
                </View>
              )}
            </View>
            <View style={s.modelCard}>
              <View style={s.modelHead}>
                <Text style={s.modelName}>OpenAI ChatGPT</Text>
                <Text style={s.modelBadge}>{ai.chatgptFound ? `#${ai.chatgptRank}` : 'Not Ranked'}</Text>
              </View>
              {(ai.chatgptMentioned || []).slice(0, 5).map((m: string, i: number) => (
                <View key={i} style={{ ...s.aiRow, backgroundColor: m.toLowerCase().includes(name.toLowerCase()) ? 'rgba(21,128,61,0.15)' : 'rgba(255,255,255,0.03)' }}>
                  <Text style={s.aiRank}>{i + 1}</Text>
                  <Text style={s.aiName}>{m}</Text>
                </View>
              ))}
              {(!ai.chatgptMentioned || ai.chatgptMentioned.length === 0) && (
                <View style={{ ...s.aiRow, backgroundColor: 'rgba(255,255,255,0.03)' }}>
                  <Text style={s.aiRank}>-</Text>
                  <Text style={s.aiName}>No recommendations found</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Signal-by-Signal Checklist</Text>
          <Text style={s.sectionCopy}>Every row is a trust or discovery signal customers check before they decide.</Text>
        </View>

        {allItems.map((item: any, i: number) => (
          <View key={i} style={s.checkItem}>
            <View style={{ ...s.checkBadge, backgroundColor: getStatusColor(item.status) }}>
              <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>{item.status === 'good' ? '\u2713' : '\u2717'}</Text>
            </View>
            <View style={s.checkMain}>
              <View style={s.checkRow}>
                <Text style={s.checkTitle}>{item.label}</Text>
                <Text style={s.checkValue}>{item.value}</Text>
              </View>
              <Text style={s.checkMeta}>{getStatusLabel(item.status)}</Text>
              <Text style={s.checkTip}>{item.tip}</Text>
            </View>
          </View>
        ))}

        <Footer name={name} />
      </Page>

      {/* PAGE 3: Roadmap + CTA */}
      <Page size="A4" style={s.page}>
        <Topbar sub="Action Roadmap" pageNum="Page 3 of 3" />

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Recommended Next Moves</Text>
          <Text style={s.sectionCopy}>This roadmap is ordered to improve trust first, then local discovery, then durable ranking strength.</Text>
        </View>

        <View style={s.roadmapRow}>
          {recommendations.slice(0, 3).map((rec: string, i: number) => (
            <View key={i} style={s.phaseCard}>
              <Text style={s.phaseKicker}>Phase {i + 1}</Text>
              <Text style={s.phaseTitle}>{i === 0 ? 'Weeks 1-2' : i === 1 ? 'Weeks 3-6' : 'Weeks 7-12'}</Text>
              <Text style={s.phaseText}>{rec}</Text>
            </View>
          ))}
        </View>

        <View style={s.ctaCard}>
          <View style={s.ctaCopy}>
            <Text style={s.eyebrow}>Execution Support</Text>
            <Text style={s.ctaTitle}>Turn this audit into action.</Text>
            <Text style={s.ctaText}>
              ReachRight builds the websites, sharpens Google listings, and upgrades the signals that help AI and customers pick your business over alternatives.
            </Text>
          </View>
          <View style={s.contactStack}>
            <View style={s.contactItem}>
              <Text style={s.contactLabel}>WhatsApp</Text>
              <Text style={s.contactValue}>+91 7439 677 931</Text>
            </View>
            <View style={s.contactItem}>
              <Text style={s.contactLabel}>Website</Text>
              <Text style={s.contactValue}>reachright.app</Text>
            </View>
            <View style={s.contactItem}>
              <Text style={s.contactLabel}>Email</Text>
              <Text style={s.contactValue}>mriganka.mondal@reachright.app</Text>
            </View>
          </View>
        </View>

        <Footer name={name} />
      </Page>
    </Document>
  );
};
