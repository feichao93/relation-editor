export function randomId(len = 7) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + len)
}

export class DefaultMap<K, V> extends Map<K, V> {
  constructor(readonly defaulter: () => V) {
    super()
  }

  get(k: K) {
    if (!this.has(k)) {
      this.set(k, this.defaulter())
    }
    return super.get(k)
  }
}

export class IncrementalMap<K> extends DefaultMap<K, number> {
  constructor() {
    super(() => 0)
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
