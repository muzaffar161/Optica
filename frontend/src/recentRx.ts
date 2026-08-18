const KEYS = {
  lens: 'optika_recent_lenses',
  frame: 'optika_recent_frames',
} as const

const MAX = 8

function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export function mergeRecent(...lists: string[][]) {
  const out: string[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    for (const item of list) {
      const value = item.trim()
      if (!value) continue
      const key = value.toLocaleLowerCase('ru-RU')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(value)
      if (out.length >= MAX) return out
    }
  }
  return out
}

export function readRecent(kind: 'lens' | 'frame') {
  return mergeRecent(read(KEYS[kind]))
}

export function rememberRecent(kind: 'lens' | 'frame', value: string) {
  const next = mergeRecent([value], read(KEYS[kind]))
  localStorage.setItem(KEYS[kind], JSON.stringify(next))
  return next
}
