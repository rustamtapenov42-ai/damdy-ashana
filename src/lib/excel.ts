import { translate, type Lang } from './i18n'
import { fmtD, fmtTime } from './format'
import type { Receipt } from './types'

export async function exportReceipts(rows: Receipt[], fileName: string, lang: Lang) {
  const { default: writeXlsxFile } = await import('write-excel-file')
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k)
  const head = [
    t('col.no'), t('dateLabel'), t('col.time'), t('rep.product'), t('f.qty'), t('f.unit'), t('col.supplier'),
    t('f.invoice'), t('col.expiry'), t('f.appearance'), t('f.storage'), t('col.status'), t('f.usage'),
    t('f.responsible'), t('f.note'), t('kpi.docs'),
  ]
  const data = [
    head.map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E2F4E8', wrap: true })),
    ...rows.map((r, i) => [
      { type: Number, value: i + 1 },
      { type: String, value: fmtD(r.received_on) },
      { type: String, value: fmtTime(r.received_time) },
      { type: String, value: r.product },
      { type: Number, value: Number(r.qty) },
      { type: String, value: translate(lang, `unit.${r.unit}` as never) },
      { type: String, value: r.supplier_name ?? '' },
      { type: String, value: r.invoice_no ?? '' },
      { type: String, value: r.expiry_date ? fmtD(r.expiry_date) : '' },
      { type: String, value: r.appearance ?? '' },
      { type: String, value: r.storage_cond ?? '' },
      { type: String, value: translate(lang, `status.${r.status}` as never) },
      { type: String, value: r.actual_usage ?? '' },
      { type: String, value: r.responsible ?? '' },
      { type: String, value: r.note ?? '' },
      { type: String, value: [r.invoice_photo_path && t('f.invoicePhoto'), r.declaration_path && t('f.declaration')].filter(Boolean).join(', ') },
    ]),
  ]
  const widths = [5, 12, 8, 22, 10, 7, 24, 12, 12, 24, 12, 13, 16, 20, 24, 22]
  await writeXlsxFile(data as never, {
    columns: widths.map((width) => ({ width })),
    fileName,
    sheet: lang === 'kk' ? 'Журнал' : 'Журнал приёма',
  })
}
