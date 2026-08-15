import { digitsOnly, foldText } from './phone';

export type SearchTokens = {
  text: string[];
  digits: string[];
};

export function searchTokens(q?: string): SearchTokens | null {
  const term = q?.trim();
  if (!term) {
    return null;
  }

  const text: string[] = [];
  const digits: string[] = [];

  for (const part of term.split(/\s+/).filter(Boolean)) {
    const d = digitsOnly(part);
    const letters = foldText(part).replace(/[0-9+()\-.]/g, '');
    if (letters) {
      text.push(foldText(part));
    }
    if (d.length >= 3) {
      digits.push(d);
    }
  }

  const allDigits = digitsOnly(term);
  if (digits.length === 0 && allDigits.length >= 3) {
    digits.push(allDigits);
  }

  if (text.length === 0 && digits.length === 0) {
    return null;
  }
  return { text, digits };
}
