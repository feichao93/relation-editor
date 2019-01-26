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

  inc(k: K) {
    const v = this.get(k)
    const nextV = v + 1
    this.set(k, nextV)
    return nextV
  }
}

export function sortBy<T>(arr: T[], fn: (item: T) => number[]) {
  return arr.slice().sort((a, b) => {
    const aa = fn(a)
    const bb = fn(b)
    for (let i = 0; i < aa.length; i++) {
      if (aa[i] !== bb[i]) {
        return aa[i] - bb[i]
      }
    }
    return 0
  })
}
