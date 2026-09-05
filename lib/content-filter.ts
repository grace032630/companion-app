export const MAX_QUOTE_LENGTH = 60;

const BLOCK_PATTERNS = [
  /\b(?:kill|rape|nazi)\b/i,
  /(?:殺了你|殺死你|去死|強姦|強奸|納粹|纳粹)/i,
  /(?:レイプ|殺すぞ|死ね)/i,
  /(?:강간|죽여버|죽어)/i,
];

export function validatePublicQuote(value: string): { ok: true; value: string } | { ok: false; message: string } {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (cleaned.length > MAX_QUOTE_LENGTH) return { ok: false, message: `每日一句最多 ${MAX_QUOTE_LENGTH} 個字` };
  if (BLOCK_PATTERNS.some((pattern) => pattern.test(cleaned))) return { ok: false, message: '這句有點太兇了 換一句啦' };
  return { ok: true, value: cleaned };
}
