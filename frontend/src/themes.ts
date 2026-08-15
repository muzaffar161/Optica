export type ThemeKey = 'atelier' | 'clinic' | 'boutique' | 'sage' | 'marble'

export const THEMES: {
  key: ThemeKey
  name: string
  hint: string
  swatches: [string, string, string]
}[] = [
  {
    key: 'atelier',
    name: 'Ателье',
    hint: 'Тёплый крем, зелень витрины и латунь',
    swatches: ['#f3eee4', '#14261f', '#c49a5a'],
  },
  {
    key: 'clinic',
    name: 'Клиника',
    hint: 'Белый кабинет, морская волна',
    swatches: ['#f7fafc', '#1a365d', '#319795'],
  },
  {
    key: 'boutique',
    name: 'Бутик',
    hint: 'Шампань, чёрный бархат и золото',
    swatches: ['#faf6f0', '#1c1917', '#b8860b'],
  },
  {
    key: 'sage',
    name: 'Шалфей',
    hint: 'Лён и спокойная олива',
    swatches: ['#f3f1ea', '#3f4a3c', '#8a9a7b'],
  },
  {
    key: 'marble',
    name: 'Мрамор',
    hint: 'Светлый камень и графит',
    swatches: ['#f4f2ef', '#2f343a', '#8b8680'],
  },
]

const STORAGE = 'optika-theme'

export function applyTheme(theme?: string | null) {
  const key = THEMES.some((item) => item.key === theme) ? theme! : 'atelier'
  document.documentElement.dataset.theme = key
  localStorage.setItem(STORAGE, key)
}

export function readStoredTheme() {
  return localStorage.getItem(STORAGE)
}
