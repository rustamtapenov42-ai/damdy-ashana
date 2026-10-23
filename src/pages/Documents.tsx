import { useEffect, useMemo, useState } from 'react'
import { PageHead, useApp } from '../App'
import { receiptsBetween } from '../lib/api'
import { fmtD, fmtMonth, monthBounds, today } from '../lib/format'
import { useT } from '../lib/i18n'
import type { Receipt } from '../lib/types'
import { Empty, FileLink, Icon, Thumb, useToast } from '../components/ui'

export default function Documents() {
  const { t, lang } = useT()
  const { orgId, go } = useApp()
  const toast = useToast()
  const [month, setMonth] = useState(today().slice(0, 7))
  const [rows, setRows] = useState<Receipt[] | null>(null)

  useEffect(() => {
    const { from, to } = monthBounds(month)
    setRows(null)
    receiptsBetween(orgId, from, to).then(setRows).catch((e) => { toast(t('err.load', { x: e.message })); setRows([]) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, month])

  const items = useMemo(() => {
    const out: { r: Receipt; path: string; label: string }[] = []
    for (const r of [...(rows ?? [])].reverse()) {
      if (r.invoice_photo_path) out.push({ r, path: r.invoice_photo_path, label: t('f.invoicePhoto') + (r.invoice_no ? ` № ${r.invoice_no}` : '') })
      if (r.declaration_path) out.push({ r, path: r.declaration_path, label: r.declaration_name || t('f.declaration') })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, lang])

  return (
    <div className="stack">
      <PageHead k="docs.title" />
      <div className="toolbar">
        <label className="field-box"><Icon name="cal" />
          <input type="month" id="f-month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label={t('monthLabel')} /></label>
      </div>
      <section className="panel">
        <div className="panel-h"><h3>{t('docs.count', { m: fmtMonth(month, lang), n: items.length })}</h3></div>
        {rows === null ? <div className="empty">{t('loading')}</div> : !items.length ? <Empty title={t('docs.empty')} hint={t('docs.emptyHint')} /> : (
          <div className="list">
            {items.map(({ r, path, label }) => (
              <div className="li" key={path}>
                <div className="li-main">
                  <Thumb path={path} />
                  <div className="min0"><FileLink className="linkbtn" path={path} label={label} /><br />
                    <small>{r.product} · {r.supplier_name} · {fmtD(r.received_on)}</small></div>
                </div>
                <button className="btn sm" onClick={() => go('intake', { date: r.received_on, selected: r.id })}>{t('btn.batch')}</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
