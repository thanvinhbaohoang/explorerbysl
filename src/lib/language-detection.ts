/**
 * Detects if text contains Khmer Unicode characters
 * Khmer Unicode range: U+1780 to U+17FF
 */
export function detectKhmer(text: string): boolean {
  const khmerRegex = /[\u1780-\u17FF]/;
  return khmerRegex.test(text);
}

/**
 * Analyzes an array of message texts and determines the primary language
 * Returns 'km' for Khmer, 'en' for English, or 'mixed' for bilingual
 */
export function detectLanguage(messages: string[]): 'en' | 'km' | 'mixed' {
  let khmerCount = 0;
  let englishCount = 0;
  
  for (const text of messages) {
    if (!text || text.startsWith('[')) continue; // Skip empty or system messages
    
    if (detectKhmer(text)) {
      khmerCount++;
    } else {
      englishCount++;
    }
  }
  
  // No messages to analyze
  if (khmerCount === 0 && englishCount === 0) return 'en';
  
  // Predominantly Khmer (more than 2x English)
  if (khmerCount > englishCount * 2) return 'km';
  
  // Predominantly English (more than 2x Khmer)
  if (englishCount > khmerCount * 2) return 'en';
  
  // Mixed if both are present in significant amounts
  if (khmerCount > 0 && englishCount > 0) return 'mixed';
  
  return 'en';
}

/**
 * Returns a human-readable label for the language code
 */
export function getLanguageLabel(code: string | null): string {
  switch (code) {
    case 'km':
      return 'Khmer';
    case 'mixed':
      return 'Mixed';
    case 'en':
    default:
      return 'English';
  }
}
