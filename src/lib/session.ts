import { clearLocalUserData, seedDatabase } from '../db/database'
import { backfillImportKeys, removeDuplicateCategories, removeDuplicateTransactions } from './dedupe'
import {
  cancelScheduledSync,
  pullFromCloud,
  purgeCloudDuplicates,
  reconcileRemoteDuplicates,
  syncToCloud,
} from './sync'

let activeInit: { userId: string; promise: Promise<void> } | null = null
let initSerial = 0

export function resetSessionInit() {
  activeInit = null
  initSerial++
}

export async function initUserSession(userId: string): Promise<void> {
  if (activeInit?.userId === userId) {
    return activeInit.promise
  }

  const serial = ++initSerial
  const promise = (async () => {
    cancelScheduledSync()
    await clearLocalUserData()
    if (serial !== initSerial) return

    await seedDatabase()
    if (serial !== initSerial) return

    await reconcileRemoteDuplicates(userId)
    if (serial !== initSerial) return

    await pullFromCloud(userId)
    if (serial !== initSerial) return

    await backfillImportKeys()
    await removeDuplicateCategories()
    await removeDuplicateTransactions()
    if (serial !== initSerial) return

    await purgeCloudDuplicates(userId)
    if (serial !== initSerial) return

    await syncToCloud()
  })()

  activeInit = { userId, promise }
  return promise
}

export async function clearSessionData(): Promise<void> {
  resetSessionInit()
  cancelScheduledSync()
  await clearLocalUserData()
}
