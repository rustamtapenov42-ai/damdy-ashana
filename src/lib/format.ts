import type { Lang } from './i18n'

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => isoDate(new Date())
export const nowTime = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const shiftDay = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return isoDate(d)
}
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 864e5)

export const monthBounds = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${ym}-01`, to: `${ym}-${pad(last)}`, days: last }
}

export const fmtD = (iso?: string | null) => (iso ? iso.split('-').reverse().join('.') : '—')
export const fmtShort = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : '')
export const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : '')
export const fmtQty = (n?: number | null) =>
  n == null ? '' : String(Math.round(Number(n) * 1000) / 1000).replace('.', ',')
export const parseNum = (v: string) => {
  const n = parseFloat(v.replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : null
}

const MONTHS_GEN: Record<Lang, string[]> = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  kk: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
}
const MONTHS_NOM: Record<Lang, string[]> = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  kk: ['Қаңтар', 'Ақпан', 'Наурыз', 'Сәуір', 'Мамыр', 'Маусым', 'Шілде', 'Тамыз', 'Қыркүйек', 'Қазан', 'Қараша', 'Желтоқсан'],
}

export const fmtLong = (iso: string, lang: Lang) => {
  const [y, m, d] = iso.split('-')
  return lang === 'kk' ? `${y} жылғы ${+d} ${MONTHS_GEN.kk[+m - 1]}` : `${+d} ${MONTHS_GEN.ru[+m - 1]} ${y}`
}
export const fmtMonth = (ym: string, lang: Lang) => {
  const [y, m] = ym.split('-')
  return lang === 'kk' ? `${y} ж. ${MONTHS_NOM.kk[+m - 1]}` : `${MONTHS_NOM.ru[+m - 1]} ${y}`
}

export const expiryState = (expiry: string | null, status: string): '' | 'warn' | 'bad' => {
  if (!expiry || status === 'rejected') return ''
  const d = daysBetween(today(), expiry)
  return d < 0 ? 'bad' : d <= 2 ? 'warn' : ''
}
