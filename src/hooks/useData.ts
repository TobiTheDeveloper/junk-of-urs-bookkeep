import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso } from '../db/database'
import { assertAuthenticated } from '../lib/authGuard'
import { buildImportKey, findExistingTransaction, normalizeCategoryName } from '../lib/dedupe'
import { scheduleSync, deleteRemoteTransaction } from '../lib/sync'
import type { Category, Receipt, Settings, Transaction } from '../types'

export function useTransactions(): Transaction[] {
  return useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray()) ?? []
}

export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.orderBy('name').toArray()) ?? []
}

export function useReceipts(): Receipt[] {
  return useLiveQuery(() => db.receipts.orderBy('createdAt').reverse().toArray()) ?? []
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('main'))
}

export async function addTransaction(
  data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Transaction> {
  assertAuthenticated()
  const importKey = buildImportKey(data, data.importKey)
  const existing = await findExistingTransaction({ ...data, importKey })
  if (existing) return existing

  const now = nowIso()
  const transaction: Transaction = {
    ...data,
    importKey,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
  await db.transactions.add(transaction)
  scheduleSync()
  return transaction
}

export async function updateTransaction(id: string, updates: Partial<Transaction>) {
  assertAuthenticated()
  await db.transactions.update(id, { ...updates, updatedAt: nowIso() })
  scheduleSync()
}

export async function deleteTransaction(id: string) {
  assertAuthenticated()
  const tx = await db.transactions.get(id)
  if (tx?.receiptId) {
    await db.receipts.delete(tx.receiptId)
  }
  await db.transactions.delete(id)
  try {
    await deleteRemoteTransaction(id)
  } catch (err) {
    console.error('Failed to delete transaction from cloud:', err)
  }
  scheduleSync()
}

export async function addReceipt(
  transactionId: string,
  imageData: string,
  mimeType: string,
  fileName: string,
): Promise<Receipt> {
  assertAuthenticated()
  const now = nowIso()
  const receipt: Receipt = {
    id: crypto.randomUUID(),
    transactionId,
    imageData,
    mimeType,
    fileName,
    storagePath: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.receipts.add(receipt)
  await db.transactions.update(transactionId, { receiptId: receipt.id, updatedAt: now })
  scheduleSync()
  return receipt
}

export async function addCategory(name: string, icon = 'tag', color = '#64748b') {
  assertAuthenticated()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Category name is required')

  const existing = (await db.categories.toArray()).find(
    (c) => normalizeCategoryName(c.name) === normalizeCategoryName(trimmed),
  )
  if (existing) return existing

  const category: Category = {
    id: crypto.randomUUID(),
    name: trimmed,
    icon,
    color,
    isDefault: false,
    updatedAt: nowIso(),
  }
  await db.categories.add(category)
  scheduleSync()
  return category
}

export async function deleteCategory(id: string) {
  assertAuthenticated()
  const cat = await db.categories.get(id)
  if (cat?.isDefault) return false
  await db.categories.delete(id)
  scheduleSync()
  return true
}

export async function updateSettings(updates: Partial<Settings>) {
  assertAuthenticated()
  await db.settings.update('main', { ...updates, updatedAt: nowIso() })
  scheduleSync()
}

export async function dismissQuarterlyReminder(key: string) {
  await updateSettings({ dismissedReminderKey: key })
}

export async function attachReceiptToExisting(
  transactionId: string,
  imageData: string,
  mimeType: string,
  fileName: string,
) {
  assertAuthenticated()
  const tx = await db.transactions.get(transactionId)
  if (!tx) return

  if (tx.receiptId) {
    await db.receipts.update(tx.receiptId, {
      imageData,
      mimeType,
      fileName,
      updatedAt: nowIso(),
    })
  } else {
    await addReceipt(transactionId, imageData, mimeType, fileName)
  }
}
