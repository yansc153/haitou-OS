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
 * PDF: tries multiple strategies — binary parse → pdf-parse lib → Qwen Vision.
 * DOCX: XML-based extraction (reliable).
 */
export async function extractResumeText(bytes: Uint8Array, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    // Strategy 1: Binary extraction (works for uncompressed PDFs)
    try {
      const text = await extractTextFromPdf(bytes);
      if (text.length > 100) return text;
    } catch {
      // Binary extraction failed
    }

    // Strategy 2: Use pdf-parse (works with FlateDecode compressed PDFs)
    try {
      const pdfParse = (await import('https://esm.sh/pdf-parse@1.1.1')).default;
      const result = await pdfParse(bytes);
      if (result.text && result.text.trim().length > 100) return result.text;
    } catch {
      // pdf-parse failed
    }

    // Strategy 2b: Use unpdf (Mozilla pdf.js wrapper)
    try {
      const { extractText } = await import('https://esm.sh/unpdf@0.11.0');
      const { text } = await extractText(bytes);
      if (text && text.length > 100) return text;
    } catch {
      // unpdf not available or failed
    }

    // Strategy 3: Qwen Vision API
    const apiKey = Deno.env.get('DASHSCOPE_API_KEY');
    if (apiKey) {
      try {
        return await extractPdfViaVision(bytes, apiKey);
      } catch {
        // Vision also failed
      }
    }

    throw new Error('PDF_EXTRACTION_FAILED: 无法提取 PDF 文本。请尝试上传 DOCX 格式的简历。');
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(bytes);
  }
  throw new Error(`UNSUPPORTED_FORMAT: Only PDF and DOCX are supported, got ${mimeType}`);
}

/**
 * Use DashScope file API + Qwen-Long to extract text from a PDF.
 * Step 1: Upload PDF to DashScope temp storage
 * Step 2: Use qwen-long model with file_id to extract text
 */
async function extractPdfViaVision(bytes: Uint8Array, apiKey: string): Promise<string> {
  // Step 1: Upload to DashScope file API
  const formData = new FormData();
  formData.append('file', new Blob([bytes], { type: 'application/pdf' }), 'resume.pdf');
  formData.append('purpose', 'file-extract');

  const uploadRes = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (uploadRes.ok) {
    const uploadJson = await uploadRes.json();
    const fileId = uploadJson.id;

    if (fileId) {
      // Step 2: Use qwen-long to extract text using file_id
      const extractRes = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-long',
          max_tokens: 4096,
          messages: [
            { role: 'system', content: `fileid://${fileId}` },
            { role: 'user', content: '请完整提取这份简历中的所有文字内容。按原始段落结构输出全部文字，保留所有标题、列表、日期等格式信息。不要总结或修改任何内容，原样输出。' },
          ],
        }),
      });

      if (extractRes.ok) {
        const json = await extractRes.json();
        const text = json.choices?.[0]?.message?.content || '';
        if (text.length > 50) return text;
      }
    }
  }

  // Fallback: base64 approach with qwen-vl-max
  const CHUNK = 32768;
  let base64 = '';
  for (let i = 0; i < bytes.length && i < 500000; i += CHUNK) {
    const slice = bytes.slice(i, Math.min(i + CHUNK, bytes.length, 500000));
    base64 += btoa(String.fromCharCode(...Array.from(slice)));
  }

  const vlRes = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-vl-max',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64}` } },
          { type: 'text', text: '请提取这份简历中的所有文字内容，按原始结构输出。' },
        ],
      }],
    }),
  });

  if (vlRes.ok) {
    const json = await vlRes.json();
    const text = json.choices?.[0]?.message?.content || '';
    if (text.length > 50) return text;
  }

  throw new Error('PDF extraction failed via all methods (binary, unpdf, file-extract, vision)');
}
