import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useApp } from '../App'
import { createReceipt, createSupplier, updateReceipt, uploadFile } from '../lib/api'
import { nowTime, parseNum, today } from '../lib/format'
import { useT } from '../lib/i18n'
import { STATUSES, UNITS, type Receipt, type Status, type Unit } from '../lib/types'
import { Icon, useToast } from './ui'

export default function NewReceiptSheet({ defaultDate, onClose, onCreated }: {
  defaultDate: string; onClose: () => void; onCreated: (r: Receipt) => void
}) {
  const { t } = useT()
  const { orgId, suppliers, reloadSuppliers } = useApp()
  const toast = useToast()
  const [dt, setDt] = useState(`${defaultDate || today()}T${nowTime()}`)
  const [product, setProduct] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState<Unit>('кг')
  const [supplier, setSupplier] = useState('')
  const [newSupplier, setNewSupplier] = useState('')
  const [expiry, setExpiry] = useState('')
  const [invoice, setInvoice] = useState('')
  const [status, setStatus] = useState<Status>('accepted')
  const [invoicePhoto, setInvoicePhoto] = useState<File | null>(null)
  const [declaration, setDeclaration] = useState<File | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const active = useMemo(() => suppliers.filter((s) => s.is_active), [suppliers])
  const preview = useMemo(() => (invoicePhoto && invoicePhoto.type.startsWith('image/') ? URL.createObjectURL(invoicePhoto) : null), [invoicePhoto])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    const q = parseNum(qty)
    const isNew = supplier === '__new'
    const supName = isNew ? newSupplier.trim() : active.find((s) => s.id === supplier)?.name ?? ''
    const miss: string[] = []
    if (!dt) miss.push(t('f.datetime').toLowerCase())
    if (!product.trim()) miss.push(t('f.product').toLowerCase())
    if (q == null || q <= 0) miss.push(t('err.qty'))
    if (!supName) miss.push(t('f.supplier').toLowerCase())
    if (miss.length) return setErr(t('err.required', { x: miss.join(', ') }))

    setBusy(true)
    try {
      let supplierId: string | null = isNew ? null : supplier
      if (isNew) {
        const existing = suppliers.find((s) => s.name.toLowerCase() === supName.toLowerCase())
        supplierId = existing ? existing.id : (await createSupplier({ org_id: orgId, name: supName })).id
        reloadSuppliers()
      }
      let r = await createReceipt({
        org_id: orgId, received_on: dt.slice(0, 10), received_time: dt.slice(11, 16),
        product: product.trim(), qty: q!, unit, supplier_id: supplierId, supplier_name: supName,
        expiry_date: expiry || null, status, invoice_no: invoice.trim() || null,
        appearance: null, storage_cond: null, actual_usage: null, responsible: null, note: null,
        photo_path: null, invoice_photo_path: null, declaration_path: null, declaration_name: null,
      })
      const patch: Partial<Receipt> = {}
      try {
        if (invoicePhoto) patch.invoice_photo_path = await uploadFile(orgId, r.id, 'invoice_photo', invoicePhoto)
        if (declaration) {
          patch.declaration_path = await uploadFile(orgId, r.id, 'declaration', declaration)
          patch.declaration_name = declaration.name
        }
      } catch (e2) { toast(t('err.upload', { x: (e2 as Error).message })) }
      if (Object.keys(patch).length) r = await updateReceipt(r.id, patch)
      toast(t('toast.recorded', { x: `${r.product}, ${qty} ${t(`unit.${unit}`)}` }))
      onCreated(r)
    } catch (e3) {
      const m = (e3 as Error).message
      setErr(/row-level security|permission|policy/i.test(m) ? t('err.rights') : t('err.save', { x: m }))
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t" onSubmit={submit} noValidate>
        <div className="sheet-head">
          <button type="button" onClick={onClose} aria-label={t('btn.close')}><Icon name="back" /></button>
          <h2 id="sheet-t">{t('nav.intake')}</h2>
        </div>
        <div className="sheet-body">
          <label className="fl"><span>{t('f.datetime')}</span>
            <input className="inp" type="datetime-local" id="n-dt" value={dt} onChange={(e) => setDt(e.target.value)} /></label>
          <label className="fl"><span>{t('f.product')}</span>
            <input ref={first} className="inp" id="n-product" placeholder={t('f.productPh')} value={product} onChange={(e) => setProduct(e.target.value)} autoComplete="off" /></label>
          <div className="fl"><span>{t('f.qty')}</span>
            <div className="two">
              <input className="inp" id="n-qty" inputMode="decimal" placeholder="0" aria-label={t('f.qty')} value={qty} onChange={(e) => setQty(e.target.value)} />
              <select className="inp" id="n-unit" aria-label={t('f.unit')} value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                {UNITS.map((u) => <option key={u} value={u}>{t(`unit.${u}`)}</option>)}
              </select>
            </div></div>
          <label className="fl"><span>{t('f.supplier')}</span>
            <select className="inp" id="n-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
              <option value="">{t('f.supplierPick')}</option>
              {active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__new">{t('f.supplierNew')}</option>
            </select></label>
          {supplier === '__new' && <input className="inp" id="n-sup-new" autoFocus placeholder={t('f.supplierNewPh')} aria-label={t('f.supplierNewPh')} value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} />}
          <label className="fl"><span>{t('f.expiry')}</span>
            <input className="inp" type="date" id="n-exp" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></label>
          <label className="fl"><span>{t('f.invoice')}</span>
            <input className="inp" id="n-inv" placeholder={t('f.invoicePh')} value={invoice} onChange={(e) => setInvoice(e.target.value)} /></label>
          <div className="fl"><span>{t('f.statusOnAccept')}</span>
            <div className="seg">
              {STATUSES.map((s) => (
                <label key={s} className={`st-${s}`}>
                  <input type="radio" name="n-st" value={s} checked={status === s} onChange={() => setStatus(s)} />
                  <span>{t(`status.${s}`)}</span>
                </label>
              ))}
            </div></div>
          <label className="photo-btn"><Icon name="cam" /><span>{invoicePhoto ? '✓ ' + invoicePhoto.name : t('f.invoicePhoto')}</span>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setInvoicePhoto(e.target.files?.[0] ?? null)} /></label>
          <label className="photo-btn alt"><Icon name="clip" /><span>{declaration ? '✓ ' + declaration.name : t('f.declarationLong')}</span>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setDeclaration(e.target.files?.[0] ?? null)} /></label>
          {preview && <img className="sheet-preview" src={preview} alt="" />}
          {err && <div className="err" role="alert">{err}</div>}
        </div>
        <div className="sheet-foot">
          <button className="btn primary big" type="submit" disabled={busy}>{busy ? t('btn.saving') : t('btn.save')}</button>
        </div>
      </form>
    </div>
  )
}
