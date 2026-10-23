import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHead, useApp } from '../App'
import { createSupplier, receiptsBetween, updateSupplier } from '../lib/api'
import { fmtD, shiftDay, today } from '../lib/format'
import { useT } from '../lib/i18n'
import type { Receipt } from '../lib/types'
import { Empty, Icon, useToast } from '../components/ui'

export default function Suppliers() {
  const { t } = useT()
  const { orgId, suppliers, reloadSuppliers, canManage } = useApp()
  const toast = useToast()
  const [rows, setRows] = useState<Receipt[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bin, setBin] = useState('')
  const [products, setProducts] = useState('')

  useEffect(() => {
    receiptsBetween(orgId, shiftDay(today(), -365), today()).then(setRows).catch(() => setRows([]))
  }, [orgId])

  const stats = useMemo(() => {
    const m = new Map<string, { n: number; rej: number; last: string }>()
    for (const r of rows) {
      const key = r.supplier_id ?? 'name:' + (r.supplier_name ?? '')
      const v = m.get(key) ?? { n: 0, rej: 0, last: '' }
      v.n++
      if (r.status === 'rejected') v.rej++
      if (r.received_on > v.last) v.last = r.received_on
      m.set(key, v)
    }
    return m
  }, [rows])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    if (suppliers.some((s) => s.name.toLowerCase() === n.toLowerCase())) return toast(t('err.supplierExists'))
    try {
      await createSupplier({ org_id: orgId, name: n, phone: phone.trim() || null, bin_iin: bin.trim() || null, products: products.trim() || null })
      setName(''); setPhone(''); setBin(''); setProducts('')
      await reloadSuppliers()
      toast(t('toast.supplierAdded'))
    } catch (err) { toast(t('err.save', { x: (err as Error).message })) }
  }
  const toggle = async (id: string, is_active: boolean) => {
    try { await updateSupplier(id, { is_active }); await reloadSuppliers() } catch (err) { toast(t('err.save', { x: (err as Error).message })) }
  }

  return (
    <div className="stack">
      <PageHead k="suppliers.title" />
      <section className="panel">
        {canManage && (
          <form className="addform" onSubmit={add}>
            <input className="inp" id="sup-name" placeholder={t('sup.name')} required value={name} onChange={(e) => setName(e.target.value)} />
            <input className="inp" id="sup-phone" placeholder={t('sup.phone')} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="inp" id="sup-bin" placeholder={t('sup.bin')} inputMode="numeric" value={bin} onChange={(e) => setBin(e.target.value)} />
            <input className="inp" id="sup-products" placeholder={t('sup.products')} value={products} onChange={(e) => setProducts(e.target.value)} />
            <button className="btn primary"><Icon name="plus" />{t('btn.add')}</button>
          </form>
        )}
        <div className="tbl-wrap">
          {!suppliers.length ? <Empty title={t('sup.empty')} hint={canManage ? t('sup.emptyHint') : undefined} /> : (
            <table>
              <thead><tr>
                <th>{t('col.supplier')}</th><th>{t('sup.phone')}</th><th>{t('sup.bin')}</th><th>{t('sup.products')}</th>
                <th className="num" title={t('sup.period')}>{t('sup.deliveries')}</th><th className="num">{t('sup.rejects')}</th><th>{t('sup.last')}</th><th />
              </tr></thead>
              <tbody>
                {suppliers.map((s) => {
                  const st = stats.get(s.id)
                  return (
                    <tr key={s.id} className={s.is_active ? '' : 'inactive'}>
                      <td><b>{s.name}</b></td><td>{s.phone || '—'}</td><td>{s.bin_iin || '—'}</td><td>{s.products || '—'}</td>
                      <td className="num">{st?.n ?? 0}</td>
                      <td className="num">{st?.rej ? <span className="pill st-rejected">{st.rej}</span> : 0}</td>
                      <td>{st?.last ? fmtD(st.last) : '—'}</td>
                      <td>{canManage
                        ? <button className="btn sm" onClick={() => toggle(s.id, !s.is_active)}>{s.is_active ? t('sup.active') : t('sup.inactive')}</button>
                        : <span className="muted">{s.is_active ? t('sup.active') : t('sup.inactive')}</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
      <p className="foot-note">{t('sup.deliveries')}, {t('sup.rejects').toLowerCase()} — {t('sup.period')}</p>
    </div>
  )
}
