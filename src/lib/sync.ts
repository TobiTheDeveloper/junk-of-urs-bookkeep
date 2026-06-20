import { db, nowIso } from '../db/database'
import type { Category, Receipt, Settings, Transaction } from '../types'
import { isAuthenticated } from './authGuard'
import {
  backfillImportKeys,
  buildImportKey,
  findExistingTransaction,
  normalizeCategoryName,
  removeDuplicateCategories,
  removeDuplicateTransactions,
} from './dedupe'
import { getSupabase, isSupabaseConfigured } from './supabase'

export type SyncResult = {
  ok: boolean
  message: string
  pushed: number
  pulled: number
}

let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncInFlight = false

export function cancelScheduledSync() {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
}

export function scheduleSync(delayMs = 2000) {
  if (!isSupabaseConfigured || !isAuthenticated()) return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncToCloud().catch(console.error)
  }, delayMs)
}

function dataUrlToBlob(dataUrl: string, mimeType: string): Blob {
  const base64 = dataUrl.split(',')[1]
  const bytes = atob(base64)
  const buffer = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i)
  return new Blob([buffer], { type: mimeType })
}

async function uploadReceiptImage(userId: string, receipt: Receipt): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase || !receipt.imageData) return receipt.storagePath

  const path = `${userId}/${receipt.id}/${receipt.fileName || 'receipt.jpg'}`
  const blob = dataUrlToBlob(receipt.imageData, receipt.mimeType)
  const { error } = await supabase.storage.from('receipts').upload(path, blob, {
    upsert: true,
    contentType: receipt.mimeType,
  })
  if (error) throw error
  return path
}

async function downloadReceiptImage(storagePath: string): Promise<string> {
  const supabase = getSupabase()
  if (!supabase) return ''
  const { data, error } = await supabase.storage.from('receipts').download(storagePath)
  if (error || !data) return ''
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(data)
  })
}

function toRemoteCategory(cat: Category, userId: string) {
  return {
    id: cat.id,
    user_id: userId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    is_default: cat.isDefault,
    updated_at: cat.updatedAt,
  }
}

function toRemoteTransaction(tx: Transaction, userId: string) {
  return {
    id: tx.id,
    user_id: userId,
    type: tx.type,
    amount: tx.amount,
    date: tx.date,
    description: tx.description,
    category_id: tx.categoryId,
    income_source: tx.incomeSource,
    vendor: tx.vendor,
    client: tx.client,
    receipt_id: tx.receiptId,
    is_tax_deductible: tx.isTaxDeductible,
    notes: tx.notes,
    import_key: tx.importKey,
    created_at: tx.createdAt,
    updated_at: tx.updatedAt,
  }
}

function toRemoteReceipt(receipt: Receipt, userId: string, storagePath: string | null) {
  return {
    id: receipt.id,
    user_id: userId,
    transaction_id: receipt.transactionId,
    storage_path: storagePath,
    mime_type: receipt.mimeType,
    file_name: receipt.fileName,
    created_at: receipt.createdAt,
    updated_at: receipt.updatedAt,
  }
}

function toRemoteSettings(settings: Settings, userId: string) {
  return {
    user_id: userId,
    business_name: settings.businessName,
    income_tax_rate: settings.incomeTaxRate,
    self_employment_rate: settings.selfEmploymentRate,
    fiscal_year_start: settings.fiscalYearStart,
    currency: settings.currency,
    quarterly_reminders_enabled: settings.quarterlyRemindersEnabled,
    dismissed_reminder_key: settings.dismissedReminderKey,
    last_synced_at: nowIso(),
    updated_at: settings.updatedAt,
  }
}

function fromRemoteCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: row.icon as string,
    color: row.color as string,
    isDefault: row.is_default as boolean,
    updatedAt: row.updated_at as string,
  }
}

function fromRemoteTransaction(row: Record<string, unknown>): Transaction {
  const importKey = (row.import_key as string | null) ?? null
  const base = {
    id: row.id as string,
    type: row.type as Transaction['type'],
    amount: Number(row.amount),
    date: row.date as string,
    description: (row.description as string) ?? '',
    categoryId: (row.category_id as string) ?? null,
    incomeSource: (row.income_source as Transaction['incomeSource']) ?? null,
    vendor: (row.vendor as string) ?? '',
    client: (row.client as string) ?? '',
    receiptId: (row.receipt_id as string) ?? null,
    isTaxDeductible: row.is_tax_deductible as boolean,
    notes: (row.notes as string) ?? '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
  return {
    ...base,
    importKey: importKey ?? buildImportKey(base),
  }
}

function fromRemoteReceipt(row: Record<string, unknown>, imageData = ''): Receipt {
  return {
    id: row.id as string,
    transactionId: row.transaction_id as string,
    imageData,
    mimeType: row.mime_type as string,
    fileName: row.file_name as string,
    storagePath: (row.storage_path as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function fromRemoteSettings(row: Record<string, unknown>): Partial<Settings> {
  return {
    businessName: row.business_name as string,
    incomeTaxRate: Number(row.income_tax_rate),
    selfEmploymentRate: Number(row.self_employment_rate),
    fiscalYearStart: Number(row.fiscal_year_start),
    currency: row.currency as string,
    quarterlyRemindersEnabled: row.quarterly_reminders_enabled as boolean,
    dismissedReminderKey: (row.dismissed_reminder_key as string) ?? null,
    lastSyncedAt: (row.last_synced_at as string) ?? null,
    businessStartDate: '2026-06-01',
    updatedAt: row.updated_at as string,
  }
}

async function mergeCategory(incoming: Category): Promise<boolean> {
  const existingById = await db.categories.get(incoming.id)
  if (existingById) {
    if (new Date(incoming.updatedAt) >= new Date(existingById.updatedAt)) {
      await db.categories.put(incoming)
      return true
    }
    return false
  }

  const all = await db.categories.toArray()
  const existingByName = all.find(
    (c) => normalizeCategoryName(c.name) === normalizeCategoryName(incoming.name),
  )
  if (existingByName) {
    if (new Date(incoming.updatedAt) >= new Date(existingByName.updatedAt)) {
      await db.categories.update(existingByName.id, {
        icon: incoming.icon,
        color: incoming.color,
        isDefault: existingByName.isDefault || incoming.isDefault,
        updatedAt: incoming.updatedAt,
      })
    }
    return false
  }

  await db.categories.put(incoming)
  return true
}

async function mergeTransaction(incoming: Transaction): Promise<boolean> {
  const importKey = incoming.importKey ?? buildImportKey(incoming)
  const normalized: Transaction = { ...incoming, importKey }

  const existingByFingerprint = await findExistingTransaction(normalized)
  if (existingByFingerprint && existingByFingerprint.id !== normalized.id) {
    const duplicateById = await db.transactions.get(normalized.id)
    if (duplicateById) {
      if (duplicateById.receiptId) {
        await db.receipts.delete(duplicateById.receiptId)
      }
      await db.transactions.delete(duplicateById.id)
    }

    if (new Date(normalized.updatedAt) >= new Date(existingByFingerprint.updatedAt)) {
      await db.transactions.update(existingByFingerprint.id, {
        type: normalized.type,
        amount: normalized.amount,
        date: normalized.date,
        description: normalized.description,
        categoryId: normalized.categoryId,
        incomeSource: normalized.incomeSource,
        vendor: normalized.vendor,
        client: normalized.client,
        receiptId: normalized.receiptId,
        isTaxDeductible: normalized.isTaxDeductible,
        notes: normalized.notes,
        importKey: existingByFingerprint.importKey ?? importKey,
        updatedAt: normalized.updatedAt,
      })
      return true
    }
    return false
  }

  const existing = await db.transactions.get(normalized.id)
  if (!existing || new Date(normalized.updatedAt) >= new Date(existing.updatedAt)) {
    await db.transactions.put({
      ...normalized,
      importKey: existing?.importKey ?? importKey,
    })
    return true
  }
  return false
}

export async function syncToCloud(): Promise<SyncResult> {
  if (!isSupabaseConfigured || syncInFlight) {
    return { ok: false, message: 'Sync unavailable', pushed: 0, pulled: 0 }
  }

  const supabase = getSupabase()
  if (!supabase) return { ok: false, message: 'Supabase not configured', pushed: 0, pulled: 0 }

  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id
  if (!userId) return { ok: false, message: 'Sign in to sync', pushed: 0, pulled: 0 }

  syncInFlight = true
  let pushed = 0
  let pulled = 0

  try {
    const [localCategories, localTransactions, localReceipts, localSettings] = await Promise.all([
      db.categories.toArray(),
      db.transactions.toArray(),
      db.receipts.toArray(),
      db.settings.get('main'),
    ])

    for (const cat of localCategories) {
      const { error } = await supabase.from('categories').upsert(toRemoteCategory(cat, userId))
      if (error) throw error
      pushed++
    }

    for (const tx of localTransactions) {
      const { error } = await supabase
        .from('transactions')
        .upsert({ ...toRemoteTransaction(tx, userId), receipt_id: null })
      if (error) throw error
      pushed++
    }

    for (const receipt of localReceipts) {
      let storagePath = receipt.storagePath
      if (receipt.imageData && !storagePath) {
        storagePath = await uploadReceiptImage(userId, receipt)
        await db.receipts.update(receipt.id, { storagePath, updatedAt: nowIso() })
        receipt.storagePath = storagePath
      }
      const { error } = await supabase
        .from('receipts')
        .upsert(toRemoteReceipt(receipt, userId, storagePath))
      if (error) throw error
      pushed++
    }

    for (const tx of localTransactions) {
      if (!tx.receiptId) continue
      const { error } = await supabase
        .from('transactions')
        .update({ receipt_id: tx.receiptId, updated_at: tx.updatedAt })
        .eq('id', tx.id)
      if (error) throw error
    }

    if (localSettings) {
      const { error } = await supabase
        .from('user_settings')
        .upsert(toRemoteSettings(localSettings, userId))
      if (error) throw error
      pushed++
    }

    const [
      { data: remoteCategories, error: catErr },
      { data: remoteTransactions, error: txErr },
      { data: remoteReceipts, error: rcptErr },
      { data: remoteSettings, error: setErr },
    ] = await Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('transactions').select('*'),
      supabase.from('receipts').select('*'),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ])

    if (catErr) throw catErr
    if (txErr) throw txErr
    if (rcptErr) throw rcptErr
    if (setErr) throw setErr

    for (const row of remoteCategories ?? []) {
      if (await mergeCategory(fromRemoteCategory(row))) pulled++
    }

    for (const row of remoteTransactions ?? []) {
      if (await mergeTransaction(fromRemoteTransaction(row))) pulled++
    }

    for (const row of remoteReceipts ?? []) {
      const existing = await db.receipts.get(row.id as string)
      const remoteUpdated = new Date(row.updated_at as string)
      const localUpdated = existing ? new Date(existing.updatedAt) : new Date(0)

      let imageData = existing?.imageData ?? ''
      const storagePath = row.storage_path as string | null
      if (storagePath && (!existing || remoteUpdated >= localUpdated)) {
        imageData = await downloadReceiptImage(storagePath)
      }

      const incoming = fromRemoteReceipt(row, imageData)
      if (!existing || remoteUpdated >= localUpdated) {
        await db.receipts.put(incoming)
        pulled++
      }
    }

    if (remoteSettings) {
      const existing = await db.settings.get('main')
      const remoteUpdated = new Date(remoteSettings.updated_at as string)
      const localUpdated = existing ? new Date(existing.updatedAt) : new Date(0)
      if (!existing || remoteUpdated >= localUpdated) {
        await db.settings.update('main', fromRemoteSettings(remoteSettings))
        pulled++
      }
    }

    await db.settings.update('main', { lastSyncedAt: nowIso() })

    await backfillImportKeys()
    await removeDuplicateCategories()
    await removeDuplicateTransactions()

    return { ok: true, message: 'Sync complete', pushed, pulled }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return { ok: false, message, pushed, pulled }
  } finally {
    syncInFlight = false
  }
}

export async function pullFromCloud(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Supabase not configured', pushed: 0, pulled: 0 }
  }
  const supabase = getSupabase()
  if (!supabase) return { ok: false, message: 'Supabase not configured', pushed: 0, pulled: 0 }

  let pulled = 0
  try {
    const [{ data: categories }, { data: transactions }, { data: receipts }, { data: settings }] =
      await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('receipts').select('*'),
        supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      ])

    await db.transaction('rw', db.categories, db.transactions, db.receipts, db.settings, async () => {
      if (categories?.length) {
        await db.categories.clear()
        await db.categories.bulkAdd(categories.map((r) => fromRemoteCategory(r)))
        pulled += categories.length
      }
      if (transactions?.length) {
        await db.transactions.clear()
        await db.transactions.bulkAdd(transactions.map((r) => fromRemoteTransaction(r)))
        pulled += transactions.length
      }
      if (receipts?.length) {
        await db.receipts.clear()
        for (const row of receipts) {
          const storagePath = row.storage_path as string | null
          const imageData = storagePath ? await downloadReceiptImage(storagePath) : ''
          await db.receipts.add(fromRemoteReceipt(row, imageData))
          pulled++
        }
      }
      if (settings) {
        await db.settings.update('main', fromRemoteSettings(settings))
        pulled++
      }
      await db.settings.update('main', { lastSyncedAt: nowIso() })
    })

    await backfillImportKeys()
    await removeDuplicateCategories()
    await removeDuplicateTransactions()

    return { ok: true, message: 'Cloud data downloaded', pushed: 0, pulled }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Download failed'
    return { ok: false, message, pushed: 0, pulled }
  }
}
