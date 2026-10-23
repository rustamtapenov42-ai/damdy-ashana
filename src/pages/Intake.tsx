import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHead, useApp } from '../App'
import { receiptsBetween, receiptsExpiring, subscribeReceipts } from '../lib/api'
import { exportReceipts } from '../lib/excel'
import { expiryState, fmtD, fmtLong, fmtQty, fmtShort, fmtTime, shiftDay, today } from '../lib/format'
import { useT } from '../lib/i18n'
import { STATUSES, type Receipt, type Status } from '../lib/types'
import { Empty, Icon, Kpi, StatusPill, useToast } from '../components/ui'
import ReceiptCard from '../components/ReceiptCard'
import NewReceiptSheet from '../components/NewReceiptSheet'

export default function Intake() {
  const { t, lang } = useT()
  const { orgId, orgName, canManage, params } = useApp()
  const toast = useToast()
  const [date, setDate] = useState(params.date ?? today())
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | Status>('all')
  const [rows, setRows] = useState<Receipt[] | null>(null)
  const [expiring, setExpiring] = useState(0)
  const [selected, setSelected] = useState<string | null>(params.selected ?? null)
  const [sheet, setSheet] = useState(false)

  const load = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([
        receiptsBetween(orgId, date, date),
        receiptsExpiring(orgId, shiftDay(today(), 2), shiftDay(today(), -60)),
      ])
      setRows(r)
      setExpiring(e.filter((x) => x.expiry_date! >= today()).length)
    } catch (err) {
      toast(t('err.load', { x: (err as Error).message }))
      setRows([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, date])
  useEffect(() => { setRows(null); load() }, [load])
  useEffect(() => subscribeReceipts(orgId, load), [orgId, load])

  useEffect(() => {
    if (selected && params.selected === selected) setTimeout(() => document.getElementById('card')?.scrollIntoView({ block: 'start' }), 80)
  }, [selected, params.selected])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows ?? [])
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => !s || `${r.product} ${r.supplier_name ?? ''} ${r.invoice_no ?? ''}`.toLowerCase().includes(s))
  }, [rows, q, status])
  const current = rows?.find((r) => r.id === selected) ?? null

  const changeDate = (d: string) => { if (d) { setDate(d); setSelected(null) } }
  const select = (id: string) => {
    setSelected((s) => (s === id ? null : id))
    if (innerWidth < 860) setTimeout(() => document.getElementById('card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const excel = async () => {
    if (!shown.length) return toast(t('toast.noRows'))
    await exportReceipts(shown, `${t('intake.title')} ${fmtD(date)}.xlsx`, lang)
    toast(t('toast.excel'))
  }

  return (
    <>
      <div className="screen-only stack">
        <PageHead k="intake.title">
          {canManage && <button className="btn primary" onClick={() => setSheet(true)}><Icon name="plus" />{t('btn.accept')}</button>}
          <button className="btn" onClick={() => window.print()}><Icon name="print" />{t('btn.print')}</button>
          <button className="btn" onClick={excel}><span className="xl"><Icon name="xl" /></span>{t('btn.excel')}</button>
        </PageHead>

        <section className="kpis">
          <Kpi tone="ok" icon="box" label={date === today() ? t('kpi.today') : t('kpi.day', { d: fmtShort(date) })} value={rows?.length ?? '…'} />
          <Kpi tone="warn" icon="clock" label={t('kpi.expiring')} value={expiring} />
          <Kpi tone="info" icon="doc" label={t('kpi.docs')} value={rows ? rows.filter((r) => r.invoice_photo_path || r.declaration_path).length : '…'} />
        </section>

        <div className="toolbar">
          <div className="field-box date-ctl">
            <button onClick={() => changeDate(shiftDay(date, -1))} aria-label={t('btn.prevDay')}><Icon name="left" /></button>
            <span className="muted"><Icon name="cal" /></span>
            <input type="date" id="f-date" value={date} onChange={(e) => changeDate(e.target.value)} aria-label={t('dateLabel')} />
            <button onClick={() => changeDate(shiftDay(date, 1))} aria-label={t('btn.nextDay')}><Icon name="right" /></button>
          </div>
          <label className="field-box search"><Icon name="search" />
            <input id="f-q" type="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label className="field-box">
            <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as never)} aria-label={t('col.status')}>
              <option value="all">{t('status.all')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </select>
          </label>
        </div>

        <section className="log" aria-label={t('intake.title')}>
          <div className="row head">
            <div>{t('col.time')}</div><div>{t('col.product')}</div><div>{t('col.supplier')}</div><div>{t('col.expiry')}</div><div>{t('col.status')}</div><div />
          </div>
          {rows === null ? <div className="empty">{t('loading')}</div>
            : !shown.length ? (rows.length
              ? <Empty title={t('empty.search')} hint={t('empty.searchHint')} />
              : <Empty title={t('empty.day', { d: fmtLong(date, lang) })} hint={canManage ? t('empty.dayHint') : t('empty.dayReadonly')} />)
            : shown.map((r) => (
              <div key={r.id} className={`row item ${selected === r.id ? 'sel' : ''}`} role="button" tabIndex={0}
                onClick={() => select(r.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select(r.id))}>
                <div className="c-time">{fmtShort(r.received_on)} · {fmtTime(r.received_time)}</div>
                <div className="prod"><b>{r.product}</b> <span>· {fmtQty(r.qty)} {t(`unit.${r.unit}`)}</span></div>
                <div className="c-sup">{r.supplier_name || '—'}</div>
                <div className="c-exp"><span className="mlabel">{t('col.expiry')} </span><span className={`exp-${expiryState(r.expiry_date, r.status)}`}>{fmtD(r.expiry_date)}</span></div>
                <div className="c-st"><StatusPill status={r.status} /></div>
                <span className="more" aria-hidden="true"><Icon name="dots" /></span>
              </div>
            ))}
        </section>

        <div id="card">
          {current && <ReceiptCard key={current.id} r={current} onClose={() => setSelected(null)} onChanged={load} onDeleted={() => { setSelected(null); load() }} />}
        </div>
        <p className="foot-note">{t('footer')}</p>
      </div>

      <PrintJournal rows={shown} date={date} orgName={orgName} />
      {sheet && <NewReceiptSheet defaultDate={date} onClose={() => setSheet(false)}
        onCreated={(r) => { setSheet(false); setDate(r.received_on); setSelected(r.id); load() }} />}
    </>
  )
}

function PrintJournal({ rows, date, orgName }: { rows: Receipt[]; date: string; orgName: string }) {
  const { t, lang } = useT()
  return (
    <section className="print-only print-journal">
      <h1>{t('intake.title')}</h1>
      <p>{t('print.org')}: <b>{orgName}</b> &nbsp;·&nbsp; {t('print.date')}: <b>{fmtLong(date, lang)}</b></p>
      <table>
        <thead><tr>
          <th>{t('col.no')}</th><th>{t('col.time')}</th><th>{t('rep.product')}</th><th>{t('f.qty')}</th><th>{t('col.supplier')}</th>
          <th>{t('f.invoice')}</th><th>{t('col.expiry')}</th><th>{t('f.appearance')}</th><th>{t('f.storage')}</th>
          <th>{t('col.status')}</th><th>{t('f.responsible')}</th><th>{t('col.signature')}</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td>{i + 1}</td><td>{fmtTime(r.received_time)}</td><td>{r.product}</td><td>{fmtQty(r.qty)} {t(`unit.${r.unit}`)}</td>
              <td>{r.supplier_name}</td><td>{r.invoice_no}</td><td>{r.expiry_date ? fmtD(r.expiry_date) : ''}</td><td>{r.appearance}</td>
              <td>{r.storage_cond}</td><td>{t(`status.${r.status}`)}</td><td>{r.responsible}</td><td />
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={12}>—</td></tr>}
        </tbody>
      </table>
    </section>
  )
}
