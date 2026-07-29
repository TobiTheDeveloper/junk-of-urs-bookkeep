import { clearLocalUserData, db, seedDatabase } from '../db/database'
import { backfillImportKeys, removeDuplicateCategories, removeDuplicateTransactions } from './dedupe'
import {
  cancelScheduledSync,
  pullFromCloud,
  purgeCloudDuplicates,
  reconcileRemoteDuplicates,
  syncToCloud,
} from './sync'

const LAST_USER_KEY = 'bookkeep_last_user_id'

let activeInit: { userId: string; promise: Promise<void> } | null = null
let initSerial = 0

export function resetSessionInit() {
  activeInit = null
  initSerial++
}

async function finishCleanupInBackground(userId: string, serial: number) {
  try {
    if (serial !== initSerial) return
    await backfillImportKeys()
    await removeDuplicateCategories()
    await removeDuplicateTransactions()
    if (serial !== initSerial) return

    await reconcileRemoteDuplicates(userId)
    if (serial !== initSerial) return

    await purgeCloudDuplicates(userId)
    if (serial !== initSerial) return

    await syncToCloud()
  } catch (err) {
    console.error('Background sync failed:', err)
  }
}

export async function initUserSession(userId: string): Promise<void> {
  if (activeInit?.userId === userId) {
    return activeInit.promise
  }

  const serial = ++initSerial
  const promise = (async () => {
    cancelScheduledSync()

    const lastUser = localStorage.getItem(LAST_USER_KEY)
    if (lastUser && lastUser !== userId) {
      await clearLocalUserData()
    }
    if (serial !== initSerial) return

    localStorage.setItem(LAST_USER_KEY, userId)
    await seedDatabase()
    if (serial !== initSerial) return

    const localCount = await db.transactions.count()

    if (localCount === 0) {
      await pullFromCloud(userId)
      if (serial !== initSerial) return

      await backfillImportKeys()
      await removeDuplicateCategories()
      await removeDuplicateTransactions()
      if (serial !== initSerial) return
    }

    void finishCleanupInBackground(userId, serial)
  })()

  activeInit = { userId, promise }
  return promise
}

export async function clearSessionData(): Promise<void> {
  resetSessionInit()
  cancelScheduledSync()
  localStorage.removeItem(LAST_USER_KEY)
  await clearLocalUserData()
}
