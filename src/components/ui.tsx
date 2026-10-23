import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { isImagePath, useSignedUrl } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Status } from '../lib/types'

/* ---------- icons ---------- */
const paths = {
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  box: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>,
  truck: <><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  chart: <path d="M6 20V11M12 20V5M18 20v-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  cal: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  dots: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  clip: <path d="M20 11l-8 8a5 5 0 01-7-7l8-8a3.5 3.5 0 015 5l-8 8a2 2 0 01-3-3l7-7" />,
  cam: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  xl: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 9l4 6M12 9l-4 6M15 9h3M15 12h3M15 15h3" /></>,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  print: <><path d="M7 9V4h10v5" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M7 14h10v6H7z" /></>,
  logout: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  globe: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16" /></>,
} as const
export type IconName = keyof typeof paths
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="i" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export function Logo({ size = 52 }: { size?: number }) {
  return (
    <svg viewBox="0 0 52 52" width={size} height={size} aria-hidden="true">
      <path d="M26 22c-1-6 1-11 6-14 1 6-1 11-6 14z" fill="#3fbf6a" />
      <path d="M24 22c-5-3-8-7-7-13 5 2 8 7 7 13z" fill="#2aa55c" />
      <path d="M27 22c3-4 8-6 13-5-2 4-7 6-13 5z" fill="#7bd38f" />
      <path d="M5 24h42c0 11-9.4 19-21 19S5 35 5 24z" fill="#f08a24" />
      <path d="M5 24h42c-.4 3-1.6 5.6-3.4 7.8C38 30 32 29 26 29S14 30 8.4 31.8C6.6 29.6 5.4 27 5 24z" fill="#ffb054" />
      <rect x="3" y="22" width="46" height="3.4" rx="1.7" fill="#2fb37a" />
    </svg>
  )
}

/* ---------- toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const show = useCallback((m: string) => {
    setMsg(m)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  )
}

/* ---------- small pieces ---------- */
export function StatusPill({ status }: { status: Status }) {
  const { t } = useT()
  return <span className={`pill st-${status}`}>{t(`status.${status}`)}</span>
}

export function Kpi({ tone, icon, label, value }: { tone: 'ok' | 'warn' | 'info'; icon: IconName; label: string; value: number | string }) {
  return (
    <div className={`kpi tone-${tone}`}>
      <div className="ic"><Icon name={icon} size={30} /></div>
      <div><div className="lb">{label}</div><div className="n">{value}</div></div>
    </div>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return <div className="empty"><b>{title}</b>{hint}</div>
}

export function FileLink({ path, label, className = '' }: { path: string; label: string; className?: string }) {
  const url = useSignedUrl(path)
  return url ? <a className={className} href={url} target="_blank" rel="noopener noreferrer">{label}</a> : <span className={className}>{label}</span>
}

export function Thumb({ path }: { path: string }) {
  const url = useSignedUrl(isImagePath(path) ? path : null)
  if (url) return <img className="doc-thumb" src={url} alt="" />
  return <span className="doc-thumb"><Icon name="doc" /></span>
}
