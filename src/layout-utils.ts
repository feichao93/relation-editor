import { Entity } from './types'
import { pairwise } from './utils'

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

export type LayoutSpan = EntitySpan | TextSpan
export interface EntitySpan {
  type: 'entity-span'
  id: string
  part: number
  startPos: number
  endPos: number
  color: string
}
export interface TextSpan {
  type: 'text-span'
  startPos: number
  endPos: number
}

export function layout(breaks: number[], entities: Entity[]) {
  const result = []
  entities.sort((e1, e2) => e1.startPos - e2.startPos)
  // index: index of current entity
  // part: part-count of current entity
  let [index, part] = [0, 0]
  for (const [lineStart, lineEnd] of pairwise([0, ...breaks])) {
    const line: LayoutSpan[] = []
    let t = lineStart
    while (t < lineEnd) {
      if (index < entities.length && t >= entities[index].startPos) {
        if (entities[index].endPos <= lineEnd) {
          // 实体不跨行
          line.push({
            type: 'entity-span',
            id: entities[index].id,
            part,
            startPos: t,
            endPos: entities[index].endPos,
            color: entities[index].color,
          })
          t = entities[index].endPos
          index++
          part = 0
        } else {
          // 跨行实体
          line.push({
            type: 'entity-span',
            id: entities[index].id,
            part,
            startPos: t,
            endPos: lineEnd,
            color: entities[index].color,
          })
          t = lineEnd
          // index 保持不变
          part++
        }
      } else {
        const endPos =
          index < entities.length ? Math.min(lineEnd, entities[index].startPos) : lineEnd
        line.push({ type: 'text-span', startPos: t, endPos })
        t = endPos
      }
    }
    result.push(line)
  }

  return result
}
