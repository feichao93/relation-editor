export function randomId(len = 5) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + len)
}

export class IncrementalMap<K> extends Map<K, number> {
  get(k: K) {
    if (this.has(k)) {
      return super.get(k)
    } else {
      return 0
    }
  }

  incAndGet(k: K) {
    const v = this.get(k)
    const nextV = v + 1
    this.set(k, nextV)
    return nextV
  }

  getAndInc(k: K) {
    const v = this.get(k)
    this.set(k, v + 1)
    return v
  }
}
