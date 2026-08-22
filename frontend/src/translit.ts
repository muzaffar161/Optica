/**
 * Русская и узбекская кириллица → латиница для SMS.
 *
 * Узбекский алфавит целиком:
 * а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш ъ э ю я
 * плюс свои: ў қ ғ ҳ
 *
 * ў→o'  қ→q  ғ→g'  ҳ→h
 * В узбекском SMS: ж→j, х→x (lotin o‘zbek). В русском: ж→zh, х→h.
 */
const BASE: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ў: "o'",
  қ: 'q',
  ғ: "g'",
  ҳ: 'h',
}

const UZ: Record<string, string> = {
  ж: 'j',
  х: 'x',
}

const PUNCT: Record<string, string> = {
  '\u00AB': '"',
  '\u00BB': '"',
  '\u201E': '"',
  '\u201C': '"',
  '\u201D': '"',
  '\u2018': "'",
  '\u2019': "'",
  '\u02BC': "'",
  '\u02BB': "'",
  '\u2013': '-',
  '\u2014': '-',
  '\u2026': '...',
  '\u2116': 'N',
}

function titleCase(value: string) {
  if (!value) return ''
  return value[0].toUpperCase() + value.slice(1)
}

export type TranslitLang = 'ru' | 'uz'

export function transliterateCyrillic(input: string, lang: TranslitLang = 'ru') {
  const extra = lang === 'uz' ? UZ : null
  let out = ''
  for (const ch of input) {
    const lower = ch.toLowerCase()
    const mapped = extra?.[lower] ?? BASE[lower]
    if (mapped != null) {
      out += ch === lower ? mapped : titleCase(mapped)
      continue
    }
    out += PUNCT[ch] ?? ch
  }
  return out
}
