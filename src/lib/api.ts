import { useEffect, useState } from 'react'
import { BUCKET, supabase } from './supabase'
import type { Access, Org, Receipt, ReceiptInput, Supplier } from './types'

const RECEIPTS = 'canteen_receipts'
const SUPPLIERS = 'canteen_suppliers'

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/* ---------- access ---------- */
export async function fetchAccess(): Promise<Access | null> {
  const data = check(await supabase.rpc('my_access'))
  return (data as Access) ?? null
}
export async function fetchOrgs(): Promise<Org[]> {
  return check(await supabase.from('organizations').select('id,name,activity_ru').eq('is_active', true).order('name')) as Org[]
}
/** Guess which org runs the canteen: the one that already has canteen suppliers or receipts. */
export async function guessCanteenOrg(): Promise<string | null> {
  const s = await supabase.from(SUPPLIERS).select('org_id').limit(1)
  if (s.data?.[0]) return s.data[0].org_id as string
  const r = await supabase.from(RECEIPTS).select('org_id').limit(1)
  return (r.data?.[0]?.org_id as string) ?? null
}

/* ---------- receipts ---------- */
const sortRows = (rows: Receipt[]) =>
  rows.sort((a, b) => (a.received_on + a.received_time).localeCompare(b.received_on + b.received_time))

export async function receiptsBetween(orgId: string, from: string, to: string): Promise<Receipt[]> {
  const rows = check(
    await supabase.from(RECEIPTS).select('*').eq('org_id', orgId).gte('received_on', from).lte('received_on', to)
      .order('received_on').order('received_time').limit(5000),
  ) as Receipt[]
  return sortRows(rows)
}
export async function receiptsExpiring(orgId: string, until: string, since: string): Promise<Receipt[]> {
  return check(
    await supabase.from(RECEIPTS).select('*').eq('org_id', orgId).neq('status', 'rejected')
      .not('expiry_date', 'is', null).lte('expiry_date', until).gte('received_on', since)
      .order('expiry_date').limit(200),
  ) as Receipt[]
}
export async function receiptsLatest(orgId: string, n = 8): Promise<Receipt[]> {
  return check(
    await supabase.from(RECEIPTS).select('*').eq('org_id', orgId)
      .order('received_on', { ascending: false }).order('received_time', { ascending: false }).limit(n),
  ) as Receipt[]
}
export async function receiptById(id: string): Promise<Receipt | null> {
  return check(await supabase.from(RECEIPTS).select('*').eq('id', id).maybeSingle()) as Receipt | null
}
export async function countToday(orgId: string, day: string): Promise<number> {
  const r = await supabase.from(RECEIPTS).select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('received_on', day)
  if (r.error) throw new Error(r.error.message)
  return r.count ?? 0
}
export async function createReceipt(input: ReceiptInput): Promise<Receipt> {
  return check(await supabase.from(RECEIPTS).insert(input).select().single()) as Receipt
}
export async function updateReceipt(id: string, patch: Partial<Receipt>): Promise<Receipt> {
  return check(await supabase.from(RECEIPTS).update(patch).eq('id', id).select().single()) as Receipt
}
export async function deleteReceipt(r: Receipt) {
  const paths = [r.photo_path, r.invoice_photo_path, r.declaration_path].filter(Boolean) as string[]
  check(await supabase.from(RECEIPTS).delete().eq('id', r.id))
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

/** Live updates for one org's journal. Calls `onChange` (debounced) after any insert/update/delete. */
export function subscribeReceipts(orgId: string, onChange: () => void) {
  let t: ReturnType<typeof setTimeout> | undefined
  const ch = supabase
    .channel('receipts-' + orgId)
    .on('postgres_changes', { event: '*', schema: 'public', table: RECEIPTS, filter: `org_id=eq.${orgId}` }, () => {
      clearTimeout(t)
      t = setTimeout(onChange, 300)
    })
    .subscribe()
  return () => {
    clearTimeout(t)
    supabase.removeChannel(ch)
  }
}

/* ---------- suppliers ---------- */
export async function fetchSuppliers(orgId: string): Promise<Supplier[]> {
  return check(await supabase.from(SUPPLIERS).select('*').eq('org_id', orgId).order('name')) as Supplier[]
}
export async function createSupplier(s: Pick<Supplier, 'org_id' | 'name'> & Partial<Supplier>): Promise<Supplier> {
  return check(await supabase.from(SUPPLIERS).insert(s).select().single()) as Supplier
}
export async function updateSupplier(id: string, patch: Partial<Supplier>) {
  check(await supabase.from(SUPPLIERS).update(patch).eq('id', id))
}

/* ---------- files ---------- */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 700_000) return file
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k)
    c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85))
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}

/** Uploads into canteen/<org>/<receipt>/<kind>-<random>.<ext> and returns the storage path. */
export async function uploadFile(orgId: string, receiptId: string, kind: string, raw: File): Promise<string> {
  const file = await shrinkImage(raw)
  const ext = (file.name.match(/\.(\w{1,5})$/)?.[1] || (file.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase()
  const path = `${orgId}/${receiptId}/${kind}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const contentType = file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg')
  check(await supabase.storage.from(BUCKET).upload(path, file, { contentType, upsert: false }))
  return path
}
export async function removeFile(path: string) {
  await supabase.storage.from(BUCKET).remove([path])
}

const urlCache = new Map<string, { url: string; exp: number }>()
export async function signedUrl(path: string): Promise<string | null> {
  const hit = urlCache.get(path)
  if (hit && hit.exp > Date.now()) return hit.url
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (!data?.signedUrl) return null
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60_000 })
  return data.signedUrl
}
export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    if (path) signedUrl(path).then((u) => live && setUrl(u))
    return () => {
      live = false
    }
  }, [path])
  return url
}
export const isImagePath = (p?: string | null) => !!p && /\.(jpe?g|png|webp|heic|heif)$/i.test(p)
