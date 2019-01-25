import { Entity } from './types'

// TODO 不直接使用 .width 应该有更好的效果
export function makeMeasurer(font: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = font
  return (s: string) => ctx.measureText(s).width
}

/** 创建一个分行器。
 * 分行器根据预设的目标宽度，将一个长文本分为若干行，使得每一行都的渲染宽度恰好匹配（等于或略小于）目标宽度。
 */
export function makeRower(targetWidth: number, measurer: (s: string) => number) {
  return (text: string) => {
    const result: number[] = []
    let i = 0
    while (i < text.length - 1) {
      // 注意 low/high 都是 inclusive 的
      let low = i
      let high = text.length - 1
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        const width = measurer(text.substring(i, middle + 1))
        if (width > targetWidth) {
          high = middle - 1
        } else {
          low = middle
        }
      }
      result.push(low + 1)
      i = low
    }
    return result
  }
}

function pairwise(arr: number[]) {
  const result = []
  for (let i = 0; i < arr.length - 1; i++) {
    result.push([arr[i], arr[i + 1]] as [number, number])
  }
  return result
}

export function layout(breaks: number[], entities: Entity[]) {
  const result = []
  entities.sort((e1, e2) => e1.s - e2.s)
  let i = 0
  for (const [lineStart, lineEnd] of pairwise([0, ...breaks])) {
    const line = []
    let t = lineStart
    while (t < lineEnd) {
      if (i < entities.length && t === entities[i].s) {
        line.push({ id: entities[i].id, s: t, e: entities[i].e, color: entities[i].color })
        t = entities[i].e
        i++
      } else {
        const e = i < entities.length ? Math.min(lineEnd, entities[i].s) : lineEnd
        line.push({ s: t, e })
        t = e
      }
    }
    result.push(line)
  }

  return result
}
