import { createContext, useCallback, useContext, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from './lib/supabase'
import { fetchAccess, fetchOrgs, fetchSuppliers, guessCanteenOrg } from './lib/api'
import { LangContext, translate, useT, type Key, type Lang } from './lib/i18n'
import type { Access, Org, Supplier } from './lib/types'
import { Icon, Logo, ToastProvider, type IconName } from './components/ui'
import Intake from './pages/Intake'
import Overview from './pages/Overview'
import Suppliers from './pages/Suppliers'
import Documents from './pages/Documents'
import Reports from './pages/Reports'

export type View = 'overview' | 'intake' | 'suppliers' | 'docs' | 'reports'
export interface NavParams { date?: string; selected?: string }

interface AppState {
  access: Access
  orgId: string
  orgName: string
  canManage: boolean
  suppliers: Supplier[]
  reloadSuppliers: () => Promise<void>
  go: (v: View, p?: NavParams) => void
  params: NavParams
}
const AppCtx = createContext<AppState>(null as never)
export const useApp = () => useContext(AppCtx)

const NAV: [View, Key, IconName][] = [
  ['overview', 'nav.overview', 'home'],
  ['intake', 'nav.intake', 'box'],
  ['suppliers', 'nav.suppliers', 'truck'],
  ['docs', 'nav.docs', 'doc'],
  ['reports', 'nav.reports', 'chart'],
]

const LS = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
}

export default function App() {
  const [lang, setLangState] = useState<Lang>(() => (LS.get('lang') as Lang) || 'ru')
  const setLang = (l: Lang) => { setLangState(l); LS.set('lang', l) }
  useEffect(() => { document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru' }, [lang])

  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <LangContext.Provider value={lang}>
      <ToastProvider>
        {!configured ? <Centered>{translate(lang, 'config.missing')}</Centered>
          : session === undefined ? <Centered>{translate(lang, 'loading')}</Centered>
          : !session ? <Login lang={lang} setLang={setLang} />
          : <Workspace key={session.user.id} lang={lang} setLang={setLang} />}
      </ToastProvider>
    </LangContext.Provider>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="centered"><div className="centered-box">{children}</div></div>
}

function LangSwitch({ lang, setLang, dark = false }: { lang: Lang; setLang: (l: Lang) => void; dark?: boolean }) {
  return (
    <div className={`lang-switch ${dark ? 'on-dark' : ''}`} role="group" aria-label="Язык / Тіл">
      {(['kk', 'ru'] as Lang[]).map((l) => (
        <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l === 'kk' ? 'Қаз' : 'Рус'}</button>
      ))}
    </div>
  )
}

function Login({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const t = (k: Key) => translate(lang, k)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr(t('login.error'))
  }
  return (
    <div className="login">
      <div className="login-brand">
        <Logo size={64} />
        <div><b>Damdy Ashana</b><small>{t('tagline')}</small></div>
      </div>
      <form className="login-card" onSubmit={submit}>
        <div className="login-head"><h1>{t('login.title')}</h1><LangSwitch lang={lang} setLang={setLang} /></div>
        <label className="fl"><span>{t('login.email')}</span>
          <input className="inp" id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="fl"><span>{t('login.password')}</span>
          <input className="inp" id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn primary big" disabled={busy}>{busy ? t('loading') : t('login.submit')}</button>
        <p className="muted small">{t('login.hint')}</p>
      </form>
    </div>
  )
}

function Workspace({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const { t } = useT()
  const [access, setAccess] = useState<Access | null | undefined>(undefined)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [view, setView] = useState<View>(() => {
    const h = location.hash.slice(1) as View
    return NAV.some(([v]) => v === h) ? h : 'intake'
  })
  const [params, setParams] = useState<NavParams>({})
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const a = await fetchAccess()
        setAccess(a)
        if (!a) return
        if (!LS.get('lang') && a.lang) setLang(a.lang)
        if (a.org_scoped) { setOrgId(a.org_id); return }
        const list = await fetchOrgs()
        setOrgs(list)
        const saved = LS.get('org')
        const pick = (saved && list.some((o) => o.id === saved) && saved) || (await guessCanteenOrg()) || a.org_id || list[0]?.id || null
        setOrgId(pick)
      } catch (e) {
        setLoadErr((e as Error).message)
        setAccess(null)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reloadSuppliers = useCallback(async () => {
    if (orgId) setSuppliers(await fetchSuppliers(orgId).catch(() => []))
  }, [orgId])
  useEffect(() => { reloadSuppliers() }, [reloadSuppliers])

  const go = useCallback((v: View, p: NavParams = {}) => {
    setView(v); setParams(p)
    history.replaceState(null, '', '#' + v)
    window.scrollTo(0, 0)
  }, [])

  const logout = () => supabase.auth.signOut()

  if (access === undefined) return <Centered>{t('loading')}</Centered>
  const canView = !!access?.perms.includes('canteen.view') || !!access?.perms.includes('canteen.manage')
  if (!access || !canView) {
    return <Centered><p>{loadErr ? t('err.load', { x: loadErr }) : t('access.none')}</p><button className="btn" onClick={logout}><Icon name="logout" />{t('nav.logout')}</button></Centered>
  }
  if (!orgId) return <Centered><p>{t('access.noOrg')}</p><button className="btn" onClick={logout}>{t('nav.logout')}</button></Centered>

  const orgName = access.org_scoped ? access.org_name ?? '' : orgs.find((o) => o.id === orgId)?.name ?? ''
  const state: AppState = {
    access, orgId, orgName, canManage: access.perms.includes('canteen.manage'),
    suppliers, reloadSuppliers, go, params,
  }

  return (
    <AppCtx.Provider value={state}>
      <div className="app">
        <aside className="side">
          <div className="brand">
            <Logo />
            <div><b>Damdy<br />Ashana</b><small>{t('tagline')}</small></div>
          </div>
          <nav className="nav" aria-label="Menu">
            {NAV.map(([v, k, ic]) => (
              <button key={v} aria-current={view === v ? 'page' : undefined} onClick={() => go(v)}>
                <Icon name={ic} /><span>{t(k)}</span>
              </button>
            ))}
          </nav>
          <div className="side-foot">
            {!access.org_scoped && orgs.length > 1 && (
              <label className="side-org"><span>{t('nav.org')}</span>
                <select id="org-select" value={orgId} onChange={(e) => { setOrgId(e.target.value); LS.set('org', e.target.value); setParams({}) }}>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            )}
            <LangSwitch lang={lang} setLang={setLang} dark />
            <div className="side-user">
              <span title={access.email}>{access.full_name || access.email}</span>
              <button onClick={logout} aria-label={t('nav.logout')} title={t('nav.logout')}><Icon name="logout" /></button>
            </div>
            <div className="side-art" aria-hidden="true">
              <svg viewBox="0 0 120 80"><path d="M10 46h100c0 16-22 28-50 28S10 62 10 46z" /><path d="M60 44c-2-12 3-22 14-28 2 12-3 22-14 28z" /><path d="M58 44c-10-6-15-14-13-26 10 4 15 14 13 26z" /><path d="M36 38c-3-4 3-8 0-12M44 36c-3-4 3-8 0-12" /></svg>
              <p>{t('motto')}</p>
            </div>
          </div>
        </aside>
        <main className="main" key={orgId}>
          {view === 'intake' && <Intake />}
          {view === 'overview' && <Overview />}
          {view === 'suppliers' && <Suppliers />}
          {view === 'docs' && <Documents />}
          {view === 'reports' && <Reports />}
        </main>
      </div>
    </AppCtx.Provider>
  )
}

/** Page header: title in the current language, the other language underneath (as on the paper journal). */
export function PageHead({ k, children }: { k: Key; children?: React.ReactNode }) {
  const { lang } = useT()
  return (
    <header className="page-head">
      <div>
        <h1>{translate(lang, k)}</h1>
        <p className="kz">{translate(lang === 'kk' ? 'ru' : 'kk', k)}</p>
      </div>
      {children && <div className="head-actions">{children}</div>}
    </header>
  )
}
