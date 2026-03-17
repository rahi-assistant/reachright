import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Svg, Circle, Path, Defs, LinearGradient, Stop } from '@react-pdf/renderer';

// Use built-in Helvetica for body, register only JetBrains Mono for data
Font.register({
  family: 'Mono',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-700-normal.ttf', fontWeight: 700 },
  ],
});

// Use Helvetica-Bold as Serif substitute (built-in, no download needed)
const SerifFamily = 'Helvetica-Bold';

// Primary Theme: Dark sophisticated + Warm accents
const theme = {
  bg: '#F8F6F2',           // Light warm background
  cardBg: '#FFFFFF',       // Clean white for cards
  darkBg: '#1A1816',       // Deep sophisticated dark
  darkCard: '#24211D',     // Slightly lighter dark
  textMain: '#1A1A1A',
  textSecondary: '#666666',
  textLight: '#F2EFE9',    // Text on dark backgrounds
  accent: '#C4623C',       // Warm rust/orange
  accentSoft: '#FFEDDE',   // Soft rust background
  border: '#E5E0D8',
  danger: '#DC2626',
  warning: '#CA8A04',
  success: '#15803D'
};

const styles = StyleSheet.create({
  page: { padding: 40, backgroundColor: theme.bg, fontFamily: 'Helvetica' },
  darkPage: { padding: 40, backgroundColor: theme.darkBg, fontFamily: 'Helvetica' },
  
  // Header
  topbar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 50, borderBottom: `1px solid ${theme.border}`, paddingBottom: 15, alignItems: 'flex-end' },
  brandGroup: { flexDirection: 'row', alignItems: 'center' },
  brandLogo: { width: 24, height: 24, backgroundColor: theme.textMain, borderRadius: 4, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  brandName: { fontSize: 16, fontWeight: 'bold', color: theme.textMain, letterSpacing: 0.5 },
  brandSub: { fontSize: 9, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  date: { fontSize: 10, color: theme.textSecondary, fontFamily: 'Mono' },

  // Hero Section
  hero: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  heroCopy: { width: '55%' },
  eyebrow: { fontSize: 9, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontFamily: 'Mono' },
  reportTitle: { fontSize: 36, fontWeight: 'bold', marginBottom: 16, color: theme.textMain, lineHeight: 1.1, fontFamily: 'Helvetica-Bold' },
  heroBody: { fontSize: 12, color: theme.textSecondary, lineHeight: 1.6, marginBottom: 24 },
  
  subjectCard: { borderTop: `1px solid ${theme.border}`, paddingTop: 16 },
  subjectName: { fontSize: 20, fontWeight: 'bold', color: theme.textMain, marginBottom: 4 },
  subjectMeta: { fontSize: 11, color: theme.textSecondary, lineHeight: 1.4 },

  // Score Card (Premium Dark)
  scoreCard: { width: '38%', backgroundColor: theme.darkBg, padding: 24, borderRadius: 12, alignItems: 'center', border: `1px solid ${theme.darkCard}` },
  scoreRing: { width: 120, height: 120, borderRadius: 60, border: `2px dashed ${theme.accent}`, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  scoreNumber: { fontSize: 48, fontWeight: 'bold', color: theme.textLight },
  scoreMax: { fontSize: 12, color: theme.textSecondary, fontFamily: 'Mono' },
  scoreLabel: { fontSize: 16, fontWeight: 'bold', color: theme.textLight, marginBottom: 8, fontFamily: 'Helvetica-Bold' },
  scoreBody: { fontSize: 10, color: '#A09D98', textAlign: 'center', lineHeight: 1.5 },

  // Section Headers
  sectionHeader: { marginBottom: 20, borderBottom: `1px solid ${theme.border}`, paddingBottom: 12 },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: theme.textMain, fontFamily: 'Helvetica-Bold' },
  sectionCopy: { fontSize: 11, color: theme.textSecondary, marginTop: 4 },

  // Audit Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  auditCard: { width: '48%', backgroundColor: theme.cardBg, padding: 16, marginBottom: 16, border: `1px solid ${theme.border}`, borderRadius: 8 },
  auditHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  auditLabel: { fontSize: 10, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Mono' },
  auditValue: { fontSize: 22, fontWeight: 'bold', color: theme.textMain, marginBottom: 6 },
  auditTip: { fontSize: 11, color: theme.textSecondary, lineHeight: 1.4 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, fontSize: 8, textTransform: 'uppercase', fontWeight: 'bold', color: '#FFF' },

  // AI Details (Dark Theme)
  aiContainer: { backgroundColor: theme.darkBg, padding: 24, borderRadius: 12, marginBottom: 24 },
  aiTitle: { fontSize: 24, color: '#F6D38F', marginBottom: 12, fontFamily: 'Helvetica-Bold' },
  aiText: { fontSize: 12, color: theme.textLight, opacity: 0.8, marginBottom: 24, lineHeight: 1.6 },
  
  modelGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  modelCard: { width: '48%', backgroundColor: theme.darkCard, padding: 16, borderRadius: 8, border: '1px solid #332F2A' },
  modelHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  modelName: { fontSize: 12, fontWeight: 'bold', color: theme.textLight },
  modelRank: { fontSize: 10, color: theme.accent, fontFamily: 'Mono', backgroundColor: 'rgba(196,98,60,0.1)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  
  aiRowMatch: { flexDirection: 'row', backgroundColor: 'rgba(21,128,61,0.15)', padding: 12, borderRadius: 6, alignItems: 'center' },
  aiRowMiss: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 6, alignItems: 'center' },
  aiRankText: { width: 24, color: theme.textSecondary, fontSize: 11, fontFamily: 'Mono' },
  aiNameText: { flex: 1, color: theme.textLight, fontSize: 11 },

  // Action Roadmap
  roadmapGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  phaseCard: { width: '31%', backgroundColor: theme.cardBg, padding: 20, border: `1px solid ${theme.border}`, borderRadius: 8 },
  phaseKicker: { fontSize: 9, color: theme.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontFamily: 'Mono' },
  phaseTitle: { fontSize: 16, fontWeight: 'bold', color: theme.textMain, marginBottom: 8 },
  phaseText: { fontSize: 11, color: theme.textSecondary, lineHeight: 1.5 },

  // Summary / CTA Card
  ctaCard: { marginTop: 30, padding: 24, backgroundColor: theme.accentSoft, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ctaCopy: { width: '60%' },
  ctaTitle: { fontSize: 20, fontWeight: 'bold', color: theme.textMain, marginBottom: 8, fontFamily: 'Helvetica-Bold' },
  ctaText: { fontSize: 11, color: theme.textSecondary, lineHeight: 1.5 },
  contactStack: { width: '35%' },
  contactItem: { backgroundColor: theme.cardBg, padding: 12, borderRadius: 6, marginBottom: 8 },
  contactLabel: { fontSize: 8, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontFamily: 'Mono' },
  contactValue: { fontSize: 11, fontWeight: 'bold', color: theme.textMain },

  // Footer
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTop: `1px solid ${theme.border}`, paddingTop: 15 },
  footerText: { fontSize: 9, color: theme.textSecondary, fontFamily: 'Mono' }
});

const getStatusColor = (status: string) => {
  if (status === 'good') return theme.success;
  if (status === 'warn') return theme.warning;
  return theme.danger;
};

export const ReportPDF = ({ data }: { data: any }) => {
  const { name, address, type, score, items, ai, recommendations, date } = data;
  
  const scoreLabel = score >= 80 ? 'Strong Presence' : score >= 50 ? 'Needs Work' : 'Critical Gaps';
  const scoreSummary = score >= 80
    ? 'Your presence is already credible. The next move is holding rank and compounding discovery.'
    : score >= 50
    ? 'Your business is visible, but trust and discovery signals are still inconsistent.'
    : 'Your business is losing visibility across both Google and AI-assisted discovery.';

  return (
    <Document>
      {/* PAGE 1: EXECUTIVE SUMMARY */}
      <Page size="A4" style={styles.page}>
        <View style={styles.topbar}>
          <View style={styles.brandGroup}>
            <View style={styles.brandLogo}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold', fontFamily: 'Helvetica-Bold' }}>R</Text>
            </View>
            <View>
              <Text style={styles.brandName}>ReachRight</Text>
              <Text style={styles.brandSub}>Premium visibility report</Text>
            </View>
          </View>
          <Text style={styles.date}>{date}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Prepared for local businesses</Text>
            <Text style={styles.reportTitle}>AI Visibility &{"\n"}Local Presence</Text>
            <Text style={styles.heroBody}>
              A premium review of how this business appears across Google Business signals, website readiness, review strength, and modern AI-generated recommendations.
            </Text>
            <View style={styles.subjectCard}>
              <Text style={styles.eyebrow}>Business under review</Text>
              <Text style={styles.subjectName}>{name}</Text>
              <Text style={styles.subjectMeta}>{address}</Text>
              <Text style={styles.subjectMeta}>{type.replace(/_/g, ' ')}</Text>
            </View>
          </View>
          
          <View style={styles.scoreCard}>
            <Text style={styles.eyebrow}>Overall Score</Text>
            <View style={styles.scoreRing}>
              <Text style={styles.scoreNumber}>{score}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
            <Text style={styles.scoreLabel}>{scoreLabel}</Text>
            <Text style={styles.scoreBody}>{scoreSummary}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Key Discovery Signals</Text>
          <Text style={styles.sectionCopy}>These are the core metrics deciding if customers trust you enough to click, call, or visit.</Text>
        </View>

        <View style={styles.grid}>
          {items.slice(0, 4).map((item: any, i: number) => (
            <View key={i} style={styles.auditCard}>
              <View style={styles.auditHeader}>
                <Text style={styles.auditLabel}>{item.label}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.auditValue}>{item.value}</Text>
              <Text style={styles.auditTip}>{item.tip}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>reachright.app</Text>
          <Text style={styles.footerText}>Confidential report for {name}</Text>
        </View>
      </Page>

      {/* PAGE 2: AI & ROADMAP */}
      <Page size="A4" style={styles.page}>
        <View style={styles.topbar}>
          <View style={styles.brandGroup}>
            <View style={styles.brandLogo}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold', fontFamily: 'Helvetica-Bold' }}>R</Text>
            </View>
            <View>
              <Text style={styles.brandName}>ReachRight</Text>
              <Text style={styles.brandSub}>Detailed Diagnosis</Text>
            </View>
          </View>
          <Text style={styles.date}>Page 2</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AI Recommendation Scan</Text>
          <Text style={styles.sectionCopy}>How Large Language Models (LLMs) currently rank your business for local queries.</Text>
        </View>

        <View style={styles.aiContainer}>
          <Text style={styles.aiTitle}>{ai.found ? 'Recommended by AI models' : 'Invisible to AI models'}</Text>
          <Text style={styles.aiText}>
            {ai.found 
              ? `${name} appears in at least one leading AI recommendation set. The next step is cementing your position to capture AI-first customers.` 
              : `${name} is absent from current AI recommendation sets. This means AI-first customers are actively being routed to your competitors.`}
          </Text>

          <View style={styles.modelGrid}>
            <View style={styles.modelCard}>
              <View style={styles.modelHead}>
                <Text style={styles.modelName}>Google Gemini</Text>
                <Text style={styles.modelRank}>{ai.geminiFound ? `Ranked #${ai.geminiRank}` : 'Not Ranked'}</Text>
              </View>
              <View style={ai.geminiFound ? styles.aiRowMatch : styles.aiRowMiss}>
                <Text style={styles.aiRankText}>{ai.geminiFound ? ai.geminiRank : '-'}</Text>
                <Text style={styles.aiNameText}>{ai.geminiFound ? name : 'Competitors recommended instead'}</Text>
              </View>
            </View>

            <View style={styles.modelCard}>
              <View style={styles.modelHead}>
                <Text style={styles.modelName}>OpenAI ChatGPT</Text>
                <Text style={styles.modelRank}>{ai.chatgptFound ? `Ranked #${ai.chatgptRank}` : 'Not Ranked'}</Text>
              </View>
              <View style={ai.chatgptFound ? styles.aiRowMatch : styles.aiRowMiss}>
                <Text style={styles.aiRankText}>{ai.chatgptFound ? ai.chatgptRank : '-'}</Text>
                <Text style={styles.aiNameText}>{ai.chatgptFound ? name : 'Competitors recommended instead'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Strategic Roadmap</Text>
          <Text style={styles.sectionCopy}>Ordered to improve trust first, local discovery second, and durable ranking strength third.</Text>
        </View>

        <View style={styles.roadmapGrid}>
          {recommendations.slice(0, 3).map((rec: string, i: number) => (
            <View key={i} style={styles.phaseCard}>
              <Text style={styles.phaseKicker}>Phase {i + 1}</Text>
              <Text style={styles.phaseTitle}>Week {i * 2 + 1}-{i * 2 + 2}</Text>
              <Text style={styles.phaseText}>{rec}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ctaCard}>
          <View style={styles.ctaCopy}>
            <Text style={styles.eyebrow}>Execution Support</Text>
            <Text style={styles.ctaTitle}>Turn this audit into action.</Text>
            <Text style={styles.ctaText}>
              ReachRight builds the high-converting websites, sharpens Google listings, and upgrades the signals that help both AI and human customers pick your business over alternatives.
            </Text>
          </View>
          <View style={styles.contactStack}>
            <View style={styles.contactItem}>
              <Text style={styles.contactLabel}>WhatsApp</Text>
              <Text style={styles.contactValue}>+91 7439 677 931</Text>
            </View>
            <View style={styles.contactItem}>
              <Text style={styles.contactLabel}>Website</Text>
              <Text style={styles.contactValue}>reachright.app</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>reachright.app</Text>
          <Text style={styles.footerText}>Confidential report for {name}</Text>
        </View>
      </Page>
    </Document>
  );
};
