/**
 * PDF and DOCX text extraction for Deno Edge Functions.
 *
 * PDF: Extracts text by parsing PDF binary structure (lightweight, no Node deps).
 * DOCX: Unzips the file → parses word/document.xml.
 */

// @ts-ignore — Deno ESM import
import JSZip from 'https://esm.sh/jszip@3.10.1';

/**
 * Extract text from a PDF file.
 * Uses a lightweight approach: reads PDF text objects directly.
 */
export async function extractTextFromPdf(bytes: Uint8Array): Promise<string> {
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);

  const textParts: string[] = [];

  // Strategy 1: Look for text in PDF streams (BT/ET text blocks)
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(raw)) !== null) {
    const streamData = match[1];
    const textInStream = extractTextFromPdfStream(streamData);
    if (textInStream) textParts.push(textInStream);
  }

  // Strategy 2: Parenthesized strings (uncompressed PDFs)
  const parenRegex = /\(([^)]{2,})\)/g;
  while ((match = parenRegex.exec(raw)) !== null) {
    const text = match[1].trim();
    if (text.length > 1 && /[a-zA-Z\u4e00-\u9fff]/.test(text)) {
      textParts.push(text);
    }
  }

  // Strategy 3: UTF-16BE hex strings (Chinese PDFs)
  const hexRegex = /<([0-9A-Fa-f\s]{8,})>/g;
  while ((match = hexRegex.exec(raw)) !== null) {
    const hex = match[1].replace(/\s/g, '');
    if (hex.length >= 8) {
      const decoded = decodeHexString(hex);
      if (decoded && decoded.length > 1) textParts.push(decoded);
    }
  }

  const text = textParts.join('\n').trim();

  if (text.length < 50) {
    const fallback = extractReadableStrings(bytes);
    if (fallback.length > 50) return fallback;
    throw new Error('PDF_EXTRACTION_LIMITED: Could not extract sufficient text. Please upload a DOCX file for best results.');
  }

  return text;
}

function extractTextFromPdfStream(stream: string): string | null {
  const parts: string[] = [];
  let m;

  const tjRegex = /\(([^)]*)\)\s*Tj/g;
  while ((m = tjRegex.exec(stream)) !== null) {
    parts.push(m[1]);
  }

  const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
  while ((m = tjArrayRegex.exec(stream)) !== null) {
    const arrayContent = m[1];
    const innerParts = arrayContent.match(/\(([^)]*)\)/g);
    if (innerParts) {
      parts.push(innerParts.map(p => p.slice(1, -1)).join(''));
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

function decodeHexString(hex: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 4) {
    const code = parseInt(hex.substring(i, i + 4), 16);
    if (code > 0 && code < 0xFFFF) bytes.push(code);
  }
  return String.fromCharCode(...bytes);
}

function extractReadableStrings(bytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(bytes);
  const runs = text.match(/[\u4e00-\u9fff\u3000-\u303fa-zA-Z0-9\s,.;:!?@#$%&*()\-+='"]{10,}/g);
  return runs ? runs.join('\n') : '';
}

/**
 * Extract text from a DOCX file.
 */
export async function extractTextFromDocx(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const docXml = zip.file('word/document.xml');

  if (!docXml) {
    throw new Error('DOCX_INVALID: word/document.xml not found in DOCX archive');
  }

  const xmlContent = await docXml.async('string');
  const paragraphs: string[] = [];
  const parts = xmlContent.split(/<\/w:p>/);

  for (const part of parts) {
    const textMatches = part.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    if (textMatches) {
      const texts = textMatches.map(m => {
        const inner = m.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
        return inner ? decodeXmlEntities(inner[1]) : '';
      });
      const paragraph = texts.join('').trim();
      if (paragraph) paragraphs.push(paragraph);
    }
  }

  const text = paragraphs.join('\n');
  if (!text.trim()) {
    throw new Error('DOCX_EMPTY: No text content could be extracted from DOCX');
  }
  return text;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extract text from a resume file based on its MIME type.
 * PDF: tries binary extraction first, falls back to LLM vision if available.
 * DOCX: XML-based extraction (reliable).
 */
export async function extractResumeText(bytes: Uint8Array, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    // Try binary extraction first (works for uncompressed PDFs)
    try {
      const text = await extractTextFromPdf(bytes);
      if (text.length > 100) return text;
    } catch {
      // Binary extraction failed — PDF is likely compressed
    }

    // Fallback: use Qwen vision API to extract text from PDF
    const apiKey = Deno.env.get('DASHSCOPE_API_KEY');
    if (apiKey) {
      try {
        return await extractPdfViaVision(bytes, apiKey);
      } catch {
        // Vision also failed
      }
    }

    throw new Error('PDF_EXTRACTION_FAILED: 无法提取 PDF 文本。PDF 可能使用了压缩格式。请上传 DOCX 格式的简历以获得最佳效果。');
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(bytes);
  }
  throw new Error(`UNSUPPORTED_FORMAT: Only PDF and DOCX are supported, got ${mimeType}`);
}

/**
 * Use Qwen VL (vision-language) model to extract text from a PDF rendered as base64.
 */
async function extractPdfViaVision(bytes: Uint8Array, apiKey: string): Promise<string> {
  const base64 = btoa(String.fromCharCode(...Array.from(bytes.slice(0, 500000)))); // Limit size

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-vl-plus',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'file', file: { file_type: 'pdf', file_data: base64 } },
          { type: 'text', text: 'Extract ALL text content from this resume PDF. Return the full text verbatim, preserving section structure. Do not summarize or modify.' },
        ],
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Vision API error: ${response.status}`);
  }

  const json = await response.json();
  const text = json.choices?.[0]?.message?.content || '';
  if (text.length < 50) throw new Error('Vision extraction returned insufficient text');
  return text;
}
