'use client';

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

type TailoredSection = {
  section_name: string;
  tailored_text: string;
  changes_made?: string[];
};

type ResumePdfProps = {
  fullName: string;
  contactEmail?: string;
  sections: TailoredSection[];
  companyName?: string;
  jobTitle?: string;
};

// Register a CJK-capable font for Chinese text rendering
Font.register({
  family: 'NotoSansSC',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest/chinese-simplified-400-normal.woff2', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest/chinese-simplified-700-normal.woff2', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'NotoSansSC',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#222',
  },
  header: {
    textAlign: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  name: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
  },
  contact: {
    fontSize: 9,
    color: '#666',
  },
  badge: {
    fontSize: 8,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionText: {
    fontSize: 9.5,
    lineHeight: 1.55,
    color: '#333',
  },
});

export function ResumePdf({ fullName, contactEmail, sections, companyName, jobTitle }: ResumePdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{fullName}</Text>
          {contactEmail && <Text style={styles.contact}>{contactEmail}</Text>}
        </View>

        {companyName && jobTitle && (
          <Text style={styles.badge}>
            AI Tailored for {companyName} — {jobTitle}
          </Text>
        )}

        {sections.map((section, i) => (
          <View key={i} wrap={false}>
            <Text style={styles.sectionTitle}>{section.section_name}</Text>
            <Text style={styles.sectionText}>{section.tailored_text}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
