let authenticatedUserId: string | null = null

export function setAuthenticatedUserId(userId: string | null) {
  authenticatedUserId = userId
}

export function getAuthenticatedUserId(): string | null {
  return authenticatedUserId
}

export function assertAuthenticated(): string {
  if (!authenticatedUserId) {
    throw new Error('Sign in to save data')
  }
  return authenticatedUserId
}

export function isAuthenticated(): boolean {
  return authenticatedUserId !== null
}
