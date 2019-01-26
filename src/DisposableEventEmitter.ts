import { EventEmitter } from 'events'

export default class DisposableEventEmitter extends EventEmitter {
  private disposables: { dispose(): void }[] = []
  on(event: string | symbol, listener: (...args: any[]) => void) {
    super.on(event, listener)
    this.disposables.push({
      dispose: () => this.off(event, listener),
    })
    return this
  }

  dispose() {
    this.disposables.forEach(d => {
      d.dispose()
    })
  }
}
