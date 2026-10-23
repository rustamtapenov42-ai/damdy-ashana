import { useCallback, useEffect, useState } from 'react'
import { PageHead, useApp } from '../App'
import { countToday, receiptsExpiring, receiptsLatest, subscribeReceipts } from '../lib/api'
import { expiryState, fmtD, fmtQty, fmtShort, fmtTime, shiftDay, today } from '../lib/format'
import { useT } from '../lib/i18n'
import type { Receipt } from '../lib/types'
import { Empty, Kpi, StatusPill, useToast } from '../components/ui'

export default function Overview() {
  const { t } = useT()
  const { orgId, suppliers, go } = useApp()
  const toast = useToast()
  const [todayN, setTodayN] = useState<number | null>(null)
  const [soon, setSoon] = useState<Receipt[] | null>(null)
  const [latest, setLatest] = useState<Receipt[] | null>(null)

  const load = useCallback(async () => {
    try {
      const [n, e, l] = await Promise.all([
        countToday(orgId, today()),
        receiptsExpiring(orgId, shiftDay(today(), 2), shiftDay(today(), -30)),
        receiptsLatest(orgId, 8),
      ])
      setTodayN(n); setSoon(e); setLatest(l)
    } catch (err) { toast(t('err.load', { x: (err as Error).message })) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])
  useEffect(() => { load() }, [load])
  useEffect(() => subscribeReceipts(orgId, load), [orgId, load])

  const open = (r: Receipt) => go('intake', { date: r.received_on, selected: r.id })
  const upcoming = soon?.filter((r) => r.expiry_date! >= today()).length ?? 0

  return (
    <div className="stack">
      <PageHead k="overview.title" />
      <section className="kpis">
        <Kpi tone="ok" icon="box" label={t('kpi.today')} value={todayN ?? '…'} />
        <Kpi tone="warn" icon="clock" label={t('kpi.expiring')} value={soon ? upcoming : '…'} />
        <Kpi tone="info" icon="truck" label={t('kpi.suppliers')} value={suppliers.filter((s) => s.is_active).length} />
      </section>
      <div className="grid2">
        <section className="panel">
          <div className="panel-h"><h3>{t('ov.expiring')}</h3></div>
          <div className="list">
            {soon === null ? <div className="empty">{t('loading')}</div> : !soon.length ? <Empty title={t('ov.noneExpiring')} /> : soon.map((r) => (
              <div className="li" key={r.id}>
                <div><b>{r.product}</b> · {fmtQty(r.qty)} {t(`unit.${r.unit}`)}<br />
                  <small>{r.supplier_name} · {t('ov.acceptedOn', { d: fmtShort(r.received_on) })}</small></div>
                <button className={`linkbtn exp-${expiryState(r.expiry_date, r.status)}`} onClick={() => open(r)}>
                  {r.expiry_date! < today() ? t('ov.expired', { d: fmtD(r.expiry_date) }) : t('ov.until', { d: fmtD(r.expiry_date) })}
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-h"><h3>{t('ov.latest')}</h3><button className="linkbtn" onClick={() => go('intake')}>{t('btn.allJournal')}</button></div>
          <div className="list">
            {latest === null ? <div className="empty">{t('loading')}</div> : !latest.length ? <Empty title={t('ov.noneLatest')} /> : latest.map((r) => (
              <button className="li li-btn" key={r.id} onClick={() => open(r)}>
                <div><b>{r.product}</b> · {fmtQty(r.qty)} {t(`unit.${r.unit}`)}<br />
                  <small>{fmtShort(r.received_on)} · {fmtTime(r.received_time)} · {r.supplier_name}</small></div>
                <StatusPill status={r.status} />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
