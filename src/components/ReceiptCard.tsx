import { useEffect, useState } from 'react'
import { useApp } from '../App'
import { deleteReceipt, removeFile, updateReceipt, uploadFile, useSignedUrl } from '../lib/api'
import { fmtLong, fmtQty, fmtTime } from '../lib/format'
import { useT, type Key } from '../lib/i18n'
import { STATUSES, type Receipt, type Status } from '../lib/types'
import { FileLink, Icon, useToast } from './ui'

type FileKey = 'photo_path' | 'invoice_photo_path' | 'declaration_path'
const fields = ['invoice_no', 'storage_cond', 'appearance', 'actual_usage', 'responsible', 'expiry_date', 'note', 'status'] as const
type Form = Record<(typeof fields)[number], string>
const toForm = (r: Receipt): Form => Object.fromEntries(fields.map((f) => [f, (r[f] as string | null) ?? ''])) as Form

export default function ReceiptCard({ r, onClose, onChanged, onDeleted }: {
  r: Receipt; onClose: () => void; onChanged: () => void; onDeleted: () => void
}) {
  const { t, lang } = useT()
  const { canManage } = useApp()
  const toast = useToast()
  const [form, setForm] = useState<Form>(() => toForm(r))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [askDel, setAskDel] = useState(false)
  const photo = useSignedUrl(r.photo_path)

  // pick up changes made elsewhere (another phone) unless the user is editing
  useEffect(() => { if (!dirty) setForm(toForm(r)) }, [r, dirty])

  const set = (k: keyof Form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true) }
  const errText = (e: unknown) => {
    const m = (e as Error).message || ''
    return /row-level security|permission|policy/i.test(m) ? t('err.rights') : t('err.save', { x: m })
  }

  const save = async () => {
    setBusy(true)
    try {
      const patch: Partial<Receipt> = {}
      for (const f of fields) (patch as Record<string, unknown>)[f] = form[f].trim() || null
      patch.status = (form.status || 'accepted') as Status
      await updateReceipt(r.id, patch)
      setDirty(false)
      toast(t('toast.saved'))
      onChanged()
    } catch (e) { toast(errText(e)) }
    setBusy(false)
  }

  const attach = async (key: FileKey, file: File | undefined) => {
    if (!file) return
    toast(t('toast.uploading'))
    try {
      const path = await uploadFile(r.org_id, r.id, key.replace('_path', ''), file)
      const old = r[key]
      await updateReceipt(r.id, { [key]: path, ...(key === 'declaration_path' ? { declaration_name: file.name } : {}) })
      if (old) removeFile(old)
      toast(t('toast.uploaded'))
      onChanged()
    } catch (e) { toast(t('err.upload', { x: (e as Error).message })) }
  }
  const detach = async (key: FileKey) => {
    const old = r[key]
    try {
      await updateReceipt(r.id, { [key]: null, ...(key === 'declaration_path' ? { declaration_name: null } : {}) })
      if (old) removeFile(old)
      onChanged()
    } catch (e) { toast(errText(e)) }
  }
  const remove = async () => {
    setBusy(true)
    try { await deleteReceipt(r); toast(t('toast.deleted')); onDeleted() } catch (e) { toast(errText(e)); setBusy(false) }
  }

  const ro = !canManage
  const text = (k: keyof Form, label: Key, ph?: Key, area?: boolean) => (
    <label className="cf" key={k}><span>{t(label)}</span>
      {area
        ? <textarea className="inp" id={`c-${k}`} rows={1} value={form[k]} readOnly={ro} placeholder={ph && t(ph)} onChange={(e) => set(k, e.target.value)} />
        : <input className="inp" id={`c-${k}`} value={form[k]} readOnly={ro} placeholder={ph && t(ph)} onChange={(e) => set(k, e.target.value)} />}
    </label>
  )
  const fileField = (k: FileKey, label: Key, btn: Key, accept: string) => (
    <div className="cf" key={k}><span>{t(label)}</span>
      {r[k] ? (
        <div className="attach"><Icon name="clip" />
          <FileLink path={r[k]!} label={k === 'declaration_path' ? r.declaration_name || t('f.declaration') : t(label)} />
          {!ro && <button className="x" onClick={() => detach(k)} aria-label={t('btn.detach')}><Icon name="x" size={16} /></button>}
        </div>
      ) : ro ? <div className="attach muted">—</div> : (
        <label className="attach filebtn"><Icon name="clip" />{t(btn)}
          <input type="file" accept={accept} onChange={(e) => attach(k, e.target.files?.[0])} /></label>
      )}
    </div>
  )

  return (
    <section className="card" aria-label={t('card.title', { p: r.product })}>
      <button className="btn ghost close" onClick={onClose} aria-label={t('btn.close')}><Icon name="x" /></button>
      <div className="photo">
        {photo ? <img src={photo} alt={r.product} /> : <div><Icon name="cam" /><br />{t('card.noPhoto')}</div>}
        {!ro && <label><span className="btn sm"><Icon name="cam" />{r.photo_path ? t('btn.replacePhoto') : t('btn.addPhoto')}</span>
          <input type="file" accept="image/*" onChange={(e) => attach('photo_path', e.target.files?.[0])} /></label>}
      </div>
      <div>
        <h2>{t('card.title', { p: r.product.toLocaleLowerCase(lang === 'kk' ? 'kk' : 'ru') })}</h2>
        <div className="cgrid">
          {text('invoice_no', 'f.invoice')}
          {text('storage_cond', 'f.storage', 'f.storagePh')}
          {fileField('declaration_path', 'f.declaration', 'btn.attach', 'image/*,application/pdf')}
          {fileField('invoice_photo_path', 'f.invoicePhoto', 'btn.attachPhoto', 'image/*,application/pdf')}
          {text('appearance', 'f.appearance', 'f.appearancePh')}
          {text('actual_usage', 'f.usage', 'f.usagePh')}
          <label className="cf"><span>{t('f.status')}</span>
            <select className="inp" id="c-status" value={form.status} disabled={ro} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </select></label>
          {text('responsible', 'f.responsible', 'f.responsiblePh')}
          <label className="cf"><span>{t('f.expiry')}</span>
            <input className="inp" type="date" id="c-expiry" value={form.expiry_date} readOnly={ro} onChange={(e) => set('expiry_date', e.target.value)} /></label>
          {text('note', 'f.note', undefined, true)}
        </div>
      </div>
      <div className="card-foot">
        <span className="meta">{fmtLong(r.received_on, lang)}, {fmtTime(r.received_time)} · {r.supplier_name || t('card.noSupplier')} · {fmtQty(r.qty)} {t(`unit.${r.unit}`)}</span>
        {ro ? <span className="meta">{t('card.readonly')}</span> : (
          <div className="row-actions">
            {askDel ? <>
              <span>{t('card.confirmDelete')}</span>
              <button className="btn danger solid" disabled={busy} onClick={remove}>{t('btn.delete')}</button>
              <button className="btn" onClick={() => setAskDel(false)}>{t('btn.cancel')}</button>
            </> : <>
              <button className="btn danger" onClick={() => setAskDel(true)}><Icon name="trash" />{t('btn.delete')}</button>
              <button className="btn primary" disabled={busy || !dirty} onClick={save}>{busy ? t('btn.saving') : t('btn.saveChanges')}</button>
            </>}
          </div>
        )}
      </div>
    </section>
  )
}
