/** Round to cents the way money is actually stored and reported. */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function sumCents(values: number[]): number {
  return roundCents(values.reduce((sum, value) => sum + value, 0))
}
