import * as d3 from 'd3'
import { ARROW_MARGIN, LABEL_FONT, LINE_HEIGHT } from './constants'
import DisposableEventEmitter from './DisposableEventEmitter'
import { makeMeasurer } from './layout-utils'
import { DefaultMap, IncrementalMap, randomId } from './utils'

enum Connection {
  na = 'na',
  include = 'include',
  intersect = 'intersect',
  disjoint = 'disjoint',
}

interface ArrowRange {
  id: string
  left: number
  right: number
}
function calculateHeightLevels(ranges: ArrowRange[]) {
  const size = ranges.length
  const maxHeight = getMaxHeight()
  const matrix = getConnectionMatrix()
  const hs = new Array<number>(ranges.length).fill(0)

  if (backtrack(0)) {
    return hs
  } else {
    throw new Error('Fatal error: cannot assign height levels for these ranges')
  }

  // 给第 i 个 range 赋予高度 h
  function backtrack(i: number) {
    if (i === size) {
      return true
    }

    // 根据 hs[0..i-1] 来决定 i 的高度
    const containerHeight = d3.range(0, i).reduce((H, j) => {
      if (matrix[i][j] === Connection.include) {
        return Math.min(H, hs[j])
      } else {
        return H
      }
    }, maxHeight + 1)

    if (containerHeight === 0) {
      return false
    }
    for (let h = 1; h < containerHeight; h++) {
      const conflict = d3
        .range(0, i)
        .some(j => matrix[i][j] === Connection.intersect && hs[j] === h)
      if (conflict) {
        continue
      }
      hs[i] = h
      if (backtrack(i + 1)) {
        return true
      }
    }
    return false
  }

  function getConnectionMatrix() {
    const matrix: Connection[][] = []
    for (let i = 0; i < size; i++) {
      const row = new Array(size).fill(Connection.na)
      const r1 = ranges[i]
      for (let j = i + 1; j < size; j++) {
        const r2 = ranges[j]
        if (r2.left > r1.right) {
          row[j] = Connection.disjoint
        } else if (r2.right > r1.right) {
          row[j] = Connection.intersect
        } else {
          row[j] = Connection.include
        }
      }
      matrix.push(row)
    }
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < i; j++) {
        matrix[i][j] = matrix[j][i]
      }
    }
    return matrix
  }

  function getMaxHeight() {
    const ticks = []
    for (const { left, right } of ranges) {
      ticks.push({ type: 'enter', x: left })
      ticks.push({ type: 'exit', x: right })
    }
    ticks.sort((a, b) => a.x - b.x)
    const { max } = ticks.reduce(
      ({ cnt, max }, t) => {
        if (t.type === 'enter') {
          return { cnt: cnt + 1, max: Math.max(max, cnt + 1) }
        } else {
          return { cnt: cnt - 1, max }
        }
      },
      { cnt: 0, max: 0 },
    )
    return max
  }
}

export const marginChange = 'margin-change'

export interface RectInfo {
  id: string
  line: number
  left: number
  width: number
  fill: string
}

export interface ArrowInfo {
  id: string
  startId: string
  endId: string
  label: string
}

function getRectPos(rect: RectInfo) {
  return { line: rect.line, x: rect.left + rect.width / 2 }
}

function sortBy<T>(arr: T[], fn: (item: T) => number[]) {
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

export default class DecorationManager extends DisposableEventEmitter {
  private readonly rects: Array<RectInfo> = []
  private readonly arrows: Array<ArrowInfo> = []
  private readonly wrapper: d3.Selection<SVGSVGElement, any, any, any>
  private readonly margins: number[] = []
  private readonly labelMeasure = makeMeasurer(LABEL_FONT)

  /** 记录一个 rect 上面需要放置多少个箭头端点 */
  private readonly tickCountMap = new IncrementalMap<string>()

  constructor(readonly container: HTMLDivElement) {
    super()
    this.wrapper = d3
      .select(container)
      .append('svg')
      .classed('decoration-wrapper', true)
    this.wrapper.append('g').classed('rect-layer', true)
    this.wrapper.append('g').classed('arrow-layer', true)
    this.wrapper.append('g').classed('text-layer', true)
  }

  getY(line: number) {
    return this.margins.slice(0, line + 1).reduce((x, y) => x + y, line * LINE_HEIGHT)
  }

  addRect(rectInfo: RectInfo) {
    this.rects.push(rectInfo)
    this.updateRects()
  }

  private updateArrows() {
    const rectById = new Map(this.rects.map(rect => [rect.id, rect] as [string, RectInfo]))
    const sortedRects = sortBy(this.rects, rect => {
      const pos = getRectPos(rect)
      return [pos.line, pos.x]
    })

    const relatedRectsMap = new DefaultMap<string, string[]>(() => [])
    for (const { startId, endId } of this.arrows) {
      relatedRectsMap.get(startId).push(endId)
      relatedRectsMap.get(endId).push(startId)
    }

    function split(baseRectId: string, relatedRectIds: string[]) {
      const x = (id: string) => getRectPos(rectById.get(id)).x
      const relatedSorted = sortBy(relatedRectIds, id => [x(id)])
      const baseX = x(baseRectId)
      return {
        leftPart: relatedSorted.filter(id => x(id) <= baseX),
        rightPart: relatedSorted.filter(id => x(id) > baseX),
      }
    }

    const findArrow = (id1: string, id2: string) =>
      this.arrows.find(
        ({ startId, endId }) =>
          (startId === id1 && endId === id2) || (startId === id2 && endId === id1),
      )

    /** 记录每个 arrow 的 startTick 与 endTick */
    const tickMap = new DefaultMap<string, { start: number; end: number }>(() => ({
      start: -1,
      end: -1,
    }))

    for (const baseRect of sortedRects) {
      // 确定 baseRect 上每个 tick 的分配情况
      const relatedRectIds = relatedRectsMap.get(baseRect.id)
      const { leftPart, rightPart } = split(baseRect.id, relatedRectIds)

      for (let i = 0; i < leftPart.length; i++) {
        const leftRectId = leftPart[i]
        const arrow = findArrow(baseRect.id, leftRectId)
        const tickInfo = tickMap.get(arrow.id)
        // arrow 在 baseRect 上的 tick
        const tick = leftPart.length - 1 - i
        if (leftRectId === arrow.startId) {
          tickInfo.end = tick
        } else {
          tickInfo.start = tick
        }
        tickMap.set(arrow.id, tickInfo)
      }

      for (let i = 0; i < rightPart.length; i++) {
        const rightRectId = rightPart[i]
        const arrow = findArrow(baseRect.id, rightRectId)
        const tickInfo = tickMap.get(arrow.id)
        // arrow 在 baseRect 上的 tick
        const tick = rightPart.length - 1 - i + leftPart.length
        if (rightRectId === arrow.startId) {
          tickInfo.end = tick
        } else {
          tickInfo.start = tick
        }
        tickMap.set(arrow.id, tickInfo)
      }
    }

    /** 记录每个 arrow 的 startX 与 endX */
    const xMap = new Map<string, { start: number; end: number }>()
    for (const arrow of this.arrows) {
      const startTick = tickMap.get(arrow.id).start
      const startRect = rectById.get(arrow.startId)
      const endRect = rectById.get(arrow.endId)
      const startX =
        startRect.left +
        (startRect.width * (startTick + 1)) / (this.tickCountMap.get(startRect.id) + 1)
      const endTick = tickMap.get(arrow.id).end
      const endX =
        endRect.left + (endRect.width * (endTick + 1)) / (this.tickCountMap.get(endRect.id) + 1)
      xMap.set(arrow.id, { start: startX, end: endX })
    }

    const arrowLineById = new Map(
      this.arrows.map(
        arrow =>
          [
            arrow.id,
            Math.min(rectById.get(arrow.startId).line, rectById.get(arrow.endId).line),
          ] as [string, number],
      ),
    )

    const heightMap = new Map<string, number>()
    const maxLine = Math.max(...arrowLineById.values())
    for (let line = 0; line <= maxLine; line++) {
      const arrowsOnThisLine = this.arrows.filter(({ id }) => arrowLineById.get(id) === line)
      let ranges = arrowsOnThisLine.map(({ id }) => {
        const { start, end } = xMap.get(id)
        return { id, left: Math.min(start, end), right: Math.max(start, end) }
      })
      ranges = sortBy(ranges, x => [x.left, x.right])
      const heightLevels = calculateHeightLevels(ranges)
      for (let i = 0; i < ranges.length; i++) {
        heightMap.set(ranges[i].id, heightLevels[i])
      }
    }

    const arrowJoin = this.wrapper
      .select('.arrow-layer')
      .selectAll<SVGPathElement, null>('.arrow')
      .data(this.arrows, d => d.id)
    arrowJoin.exit().remove()

    const arrow = arrowJoin
      .enter()
      .append('path')
      .classed('arrow', true)
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('stroke', 'red')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .merge(arrowJoin)

    arrow.attr('d', arrow => {
      const margin = ARROW_MARGIN
      const startRect = rectById.get(arrow.startId)
      const endRect = rectById.get(arrow.endId)

      const startX = xMap.get(arrow.id).start
      const endX = xMap.get(arrow.id).end

      const startY = this.getY(startRect.line)
      const labelLine = arrowLineById.get(arrow.id)
      const labelY = this.getY(labelLine) - margin - 25 * (heightMap.get(arrow.id) - 1)
      const endY = this.getY(endRect.line)

      const path = d3.path()
      path.moveTo(startX, startY)
      path.lineTo(startX, labelY)
      path.lineTo(endX, labelY)
      path.lineTo(endX, endY)
      path.lineTo(endX - 4, endY - 6)
      path.moveTo(endX, endY)
      path.lineTo(endX + 4, endY - 6)
      return path.toString()
    })

    const textJoin = this.wrapper
      .select('.text-layer')
      .selectAll<SVGTextElement, null>('text')
      .data(this.arrows, d => d.id)
    textJoin.exit().remove()

    const text = textJoin
      .enter()
      .append('text')
      .merge(textJoin)

    text
      .attr('x', d => {
        const { start, end } = xMap.get(d.id)
        return (start + end) / 2 - this.labelMeasure(d.label) / 2
      })
      .attr('y', d => {
        const labelLine = arrowLineById.get(d.id)
        return this.getY(labelLine) - 25 * heightMap.get(d.id) + 10
      })
      .attr('font-size', 15)
      .attr('fill', 'red')
      .text(d => d.label)
  }

  private updateRects() {
    const rectJoin = this.wrapper
      .select('.rect-layer')
      .selectAll<SVGRectElement, null>('rect')
      .data(this.rects)
    const rect = rectJoin
      .enter()
      .append('rect')
      .attr('data-id', d => d.id)
      .merge(rectJoin)

    rect
      .attr('x', d => d.left)
      .attr('y', d => this.getY(d.line))
      .attr('width', d => d.width)
      .attr('height', LINE_HEIGHT)
      .attr('fill', d => d.fill)
  }

  countLabelAtLine(line: number) {
    const getLabelLine = (info: ArrowInfo) => {
      const startRect = this.rects.find(rect => rect.id === info.startId)
      const endRect = this.rects.find(rect => rect.id === info.endId)
      return Math.min(startRect.line, endRect.line)
    }
    return this.arrows.map(getLabelLine).filter(l => l === line).length
  }

  private updateMargin(line: number, margin: number) {
    while (this.margins.length < line + 1) {
      this.margins.push(0)
    }
    this.margins[line] = margin
    this.emit(marginChange, this.margins)
  }

  addArrow(arrowInfo: ArrowInfo) {
    arrowInfo.id = arrowInfo.id || randomId()
    this.arrows.push(arrowInfo as ArrowInfo)
    this.tickCountMap.incAndGet(arrowInfo.startId)
    this.tickCountMap.incAndGet(arrowInfo.endId)

    const startRect = this.rects.find(rect => rect.id === arrowInfo.startId)
    const endRect = this.rects.find(rect => rect.id === arrowInfo.endId)
    const labelLine = Math.min(startRect.line, endRect.line)
    const x = this.countLabelAtLine(labelLine) // TODO 木有那么简单
    this.updateMargin(labelLine, 15 + 25 * x)

    this.update()
  }

  update() {
    this.updateRects()
    this.updateArrows()
  }
}
