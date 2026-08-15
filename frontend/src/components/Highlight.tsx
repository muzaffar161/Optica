type Props = {
  text: string
  query: string
  phone?: boolean
}

export default function Highlight({ text, query, phone }: Props) {
  const q = query.trim()
  if (!q) return <>{text}</>

  const ranges = mergeRanges(
    phone ? phoneRanges(text, q) : tokenRanges(text, q),
  )
  if (ranges.length === 0) return <>{text}</>

  const parts: { value: string; hit: boolean }[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push({ value: text.slice(cursor, start), hit: false })
    parts.push({ value: text.slice(start, end), hit: true })
    cursor = end
  }
  if (cursor < text.length) parts.push({ value: text.slice(cursor), hit: false })

  return (
    <>
      {parts.map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded-sm bg-amber-200 px-0.5 text-ink">
            {part.value}
          </mark>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  )
}

function tokenRanges(text: string, query: string): [number, number][] {
  const ranges: [number, number][] = []
  for (const token of query.split(/\s+/).filter(Boolean)) {
    ranges.push(...textRanges(text, token))
  }
  return ranges
}

function textRanges(text: string, query: string): [number, number][] {
  const hay = text.toLowerCase()
  const needle = query.toLowerCase()
  const ranges: [number, number][] = []
  let from = 0
  while (needle && from <= hay.length - needle.length) {
    const i = hay.indexOf(needle, from)
    if (i < 0) break
    ranges.push([i, i + needle.length])
    from = i + needle.length
  }
  return ranges
}

function phoneRanges(text: string, query: string): [number, number][] {
  const digits = query.replace(/\D/g, '')
  if (digits.length < 3) return tokenRanges(text, query)

  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i])) map.push(i)
  }
  const hay = map.map((i) => text[i]).join('')
  const start = hay.indexOf(digits)
  if (start < 0) return tokenRanges(text, query)

  const from = map[start]
  const to = map[start + digits.length - 1] + 1
  return [[from, to]]
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const out: [number, number][] = [sorted[0]]
  for (const [start, end] of sorted.slice(1)) {
    const last = out[out.length - 1]
    if (start <= last[1]) last[1] = Math.max(last[1], end)
    else out.push([start, end])
  }
  return out
}
