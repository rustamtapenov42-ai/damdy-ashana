import { useEffect, useMemo, useState } from 'react'
import { PageHead, useApp } from '../App'
import { receiptsBetween } from '../lib/api'
import { exportReceipts } from '../lib/excel'
import { fmtMonth, fmtQty, monthBounds, today } from '../lib/format'
import { useT } from '../lib/i18n'
import type { Receipt } from '../lib/types'
import { Empty, Icon, Kpi, useToast } from '../components/ui'

export default function Reports() {
  const { t, lang } = useT()
  const { orgId } = useApp()
  const toast = useToast()
  const [month, setMonth] = useState(today().slice(0, 7))
  const [rows, setRows] = useState<Receipt[] | null>(null)

  useEffect(() => {
    const { from, to } = monthBounds(month)
    setRows(null)
    receiptsBetween(orgId, from, to).then(setRows).catch((e) => { toast(t('err.load', { x: e.message })); setRows([]) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, month])

  const r = useMemo(() => rows ?? [], [rows])
  const rejected = r.filter((x) => x.status === 'rejected').length
  const accepted = r.filter((x) => x.status === 'accepted').length

  const byProduct = useMemo(() => {
    const m = new Map<string, { p: string; u: string; q: number; n: number }>()
    for (const x of r) {
      if (x.status === 'rejected') continue
      const k = x.product.toLowerCase() + '|' + x.unit
      const v = m.get(k) ?? { p: x.product, u: x.unit, q: 0, n: 0 }
      v.q += Number(x.qty); v.n++
      m.set(k, v)
    }
    return [...m.values()].sort((a, b) => a.p.localeCompare(b.p, 'ru'))
  }, [r])

  const bySupplier = useMemo(() => {
    const m = new Map<string, { n: number; rej: number }>()
    for (const x of r) {
      const k = x.supplier_name || '—'
      const v = m.get(k) ?? { n: 0, rej: 0 }
      v.n++; if (x.status === 'rejected') v.rej++
      m.set(k, v)
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [r])

  const byDay = useMemo(() => {
    const { days } = monthBounds(month)
    const arr = Array.from({ length: days }, () => 0)
    for (const x of r) arr[+x.received_on.slice(8, 10) - 1]++
    return arr
  }, [r, month])
  const maxDay = Math.max(1, ...byDay)

  const excel = async () => {
    if (!r.length) return toast(t('toast.noRows'))
    await exportReceipts(r, `${t('intake.title')} ${fmtMonth(month, lang)}.xlsx`, lang)
    toast(t('toast.excel'))
  }

  return (
    <div className="stack">
      <PageHead k="reports.title">
        <button className="btn" onClick={excel}><span className="xl"><Icon name="xl" /></span>{t('btn.excelMonth')}</button>
      </PageHead>
      <div className="toolbar">
        <label className="field-box"><Icon name="cal" />
          <input type="month" id="f-month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label={t('monthLabel')} /></label>
      </div>
      <section className="kpis">
        <Kpi tone="ok" icon="box" label={t('kpi.monthBatches')} value={rows ? r.length : '…'} />
        <Kpi tone="warn" icon="x" label={t('kpi.rejected')} value={rows ? rejected : '…'} />
        <Kpi tone="info" icon="doc" label={t('kpi.withDocs')} value={rows ? r.filter((x) => x.invoice_photo_path || x.declaration_path).length : '…'} />
      </section>

      <section className="panel">
        <div className="panel-h"><h3>{t('rep.byDay')}</h3><span className="muted small">{fmtMonth(month, lang)}</span></div>
        <div className="bars" role="img" aria-label={t('rep.byDay')}>
          {byDay.map((n, i) => (
            <div className="bar" key={i} title={`${i + 1}: ${n}`}>
              <div className="bar-fill" style={{ height: `${(n / maxDay) * 100}%` }}>{n > 0 && <span>{n}</span>}</div>
              <small>{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ''}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="grid2">
        <section className="panel">
          <div className="panel-h"><h3>{t('rep.byProduct')}</h3></div>
          <div className="tbl-wrap">
            {!byProduct.length ? <Empty title={t('rep.none')} /> : (
              <table>
                <thead><tr><th>{t('rep.product')}</th><th className="num">{t('rep.batches')}</th><th className="num">{t('rep.total')}</th></tr></thead>
                <tbody>{byProduct.map((v) => (
                  <tr key={v.p + v.u}><td>{v.p}</td><td className="num">{v.n}</td><td className="num">{fmtQty(v.q)} {t(`unit.${v.u}` as never)}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-h"><h3>{t('rep.bySupplier')}</h3><span className="muted small">{t('rep.acceptedOf', { a: accepted, n: r.length })}</span></div>
          <div className="tbl-wrap">
            {!bySupplier.length ? <Empty title={t('rep.none')} /> : (
              <table>
                <thead><tr><th>{t('col.supplier')}</th><th className="num">{t('sup.deliveries')}</th><th className="num">{t('sup.rejects')}</th><th className="num">{t('rep.rejectShare')}</th></tr></thead>
                <tbody>{bySupplier.map(([s, v]) => (
                  <tr key={s}><td>{s}</td><td className="num">{v.n}</td><td className="num">{v.rej}</td>
                    <td className="num">{v.rej ? <span className="pill st-rejected">{Math.round((v.rej / v.n) * 100)}%</span> : '0%'}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
