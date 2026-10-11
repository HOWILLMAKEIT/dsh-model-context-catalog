/** Edit only changed catalog keys; unrelated concurrent entries survive. */
export function entryMutations(previous, next) {
  const ops = []
  for (const key of Object.keys(previous)) {
    if (!Object.hasOwn(next, key)) ops.push({ op: 'unset', path: ['entries', key] })
  }
  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(value)) ops.push({ op: 'set', path: ['entries', key], value })
  }
  return ops
}
