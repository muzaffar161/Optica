type RxEye = { sph?: string; cyl?: string; ax?: string };
type RxBlock = { label?: string; od?: RxEye; os?: RxEye; dpp?: string };
export type RxPayload = {
  blocks?: RxBlock[];
  lens?: string;
  frame?: string;
};

function clean(value?: string) {
  return value?.trim() ?? '';
}

function hasNumber(value?: string) {
  return clean(value).replace(/^[+-]+/, '') !== '';
}

/** Sph without a sign is plus; cyl without a sign is minus. */
export function formatDiopter(value?: string, fallback: '+' | '-' = '+') {
  const raw = clean(value);
  if (!hasNumber(raw)) return '';
  const body = raw.replace(/^[+-]+/, '');
  if (raw.startsWith('+') || raw.startsWith('-')) {
    return `${raw[0]}${body}`;
  }
  return `${fallback}${body}`;
}

export function withSign(value?: string, fallback: '+' | '-' = '+') {
  return formatDiopter(value, fallback);
}

function formatEye(side: string, eye?: RxEye) {
  if (!eye) return '';
  const parts = [side];
  if (hasNumber(eye.sph)) parts.push(`Sph ${formatDiopter(eye.sph, '+')}`);
  if (hasNumber(eye.cyl)) parts.push(`Cyl ${formatDiopter(eye.cyl, '-')}`);
  if (clean(eye.ax)) parts.push(`ax ${clean(eye.ax)}`);
  return parts.length > 1 ? parts.join(' ') : '';
}

export function signedRx(rx: RxPayload): RxPayload {
  return {
    lens: clean(rx.lens),
    frame: clean(rx.frame),
    blocks: (rx.blocks ?? []).map((block) => ({
      label: clean(block.label),
      dpp: clean(block.dpp),
      od: {
        sph: withSign(block.od?.sph, '+'),
        cyl: withSign(block.od?.cyl, '-'),
        ax: clean(block.od?.ax),
      },
      os: {
        sph: withSign(block.os?.sph, '+'),
        cyl: withSign(block.os?.cyl, '-'),
        ax: clean(block.os?.ax),
      },
    })),
  };
}

export function formatRxTitle(rx: RxPayload, amount?: number | null) {
  const blocks = (rx.blocks ?? [])
    .map((block) => {
      const label = clean(block.label) || 'Рецепт';
      const eyes = [formatEye('OD', block.od), formatEye('OS', block.os)].filter(Boolean);
      const dpp = clean(block.dpp) ? `Dpp ${clean(block.dpp)} мм` : '';
      const body = [...eyes, dpp].filter(Boolean).join(', ');
      return body ? `${label}: ${body}` : '';
    })
    .filter(Boolean);
  const extras = [
    clean(rx.lens) ? `Линза: ${clean(rx.lens)}` : '',
    clean(rx.frame) ? `Оправа: ${clean(rx.frame)}` : '',
    typeof amount === 'number' ? `${amount.toLocaleString('ru-RU')} сум` : '',
  ].filter(Boolean);
  return [...blocks, ...extras].filter(Boolean).join('. ');
}

export function formatRxBody(rx: RxPayload) {
  const blocks = (rx.blocks ?? [])
    .map((block) => {
      const lines = [
        clean(block.label) || 'Рецепт',
        formatEye('OD', block.od),
        formatEye('OS', block.os),
        clean(block.dpp) ? `Dpp ${clean(block.dpp)} мм` : '',
      ].filter(Boolean);
      return lines.length > 1 ? lines.join('\n') : '';
    })
    .filter(Boolean);
  return blocks.join('\n\n');
}

export function parseRxJson(raw?: string | null): RxPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RxPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}
