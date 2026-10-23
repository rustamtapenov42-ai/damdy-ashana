export type Status = 'accepted' | 'checking' | 'rejected'
export type Unit = 'кг' | 'г' | 'л' | 'шт' | 'уп' | 'ящ'
export const UNITS: Unit[] = ['кг', 'г', 'л', 'шт', 'уп', 'ящ']
export const STATUSES: Status[] = ['accepted', 'checking', 'rejected']

export interface Receipt {
  id: string
  org_id: string
  received_on: string // YYYY-MM-DD
  received_time: string // HH:MM[:SS]
  product: string
  qty: number
  unit: Unit
  supplier_id: string | null
  supplier_name: string | null
  expiry_date: string | null
  status: Status
  invoice_no: string | null
  appearance: string | null
  storage_cond: string | null
  actual_usage: string | null
  responsible: string | null
  note: string | null
  photo_path: string | null
  invoice_photo_path: string | null
  declaration_path: string | null
  declaration_name: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ReceiptInput = Omit<Receipt, 'id' | 'created_by' | 'created_at' | 'updated_at'>

export interface Supplier {
  id: string
  org_id: string
  name: string
  bin_iin: string | null
  phone: string | null
  products: string | null
  is_active: boolean
  created_at: string
}

export interface Access {
  user_id: string
  email: string
  full_name: string | null
  role: string
  org_id: string | null
  org_name: string | null
  lang: 'ru' | 'kk'
  org_scoped: boolean
  perms: string[]
}

export interface Org {
  id: string
  name: string
  activity_ru: string | null
}
