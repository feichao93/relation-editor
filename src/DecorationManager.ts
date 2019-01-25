import * as d3 from 'd3'
import { EventEmitter } from 'events'
import { ARROW_MARGIN, LABEL_FONT, LINE_HEIGHT } from './constants'
import { makeMeasurer } from './layout-utils'
import { IncrementalMap, randomId } from './utils'

export const marginChange = 'margin-change'

export interface ArrowInfo {
  id: string
  startId: string
  endId: string
}

export interface RectInfo {
  id: string
  line: number
  left: number
  width: number
  fill: string
}

export interface TextInfo {
  line: number
  margin: number
  center: number
  textContent: string
}

function getRectPos(rect: RectInfo): [number, number] {
  return [rect.line, rect.left + rect.width / 2]
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

export default class DecorationManager extends EventEmitter {
  private readonly rects: Array<RectInfo> = []
  private readonly texts: Array<TextInfo> = []
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

  addText(textInfo: TextInfo) {
    this.texts.push(textInfo)
    this.updateTexts()
  }

  private updateTexts() {
    const labelPlacementCount = new IncrementalMap<number>()

    const rectJoin = this.wrapper
      .select('.text-layer')
      .selectAll('text')
      .data(this.texts)

    const textEnter = rectJoin.enter().append('text')
    rectJoin.exit().remove()
    const text = rectJoin.merge(textEnter as any)

    text
      // TODO 创建一个 measurer 用来调整 x 的值
      .attr('x', d => d.center - this.labelMeasure(d.textContent) / 2)
      .attr('y', d => this.getY(d.line) - d.margin - 25 * labelPlacementCount.getAndInc(d.line))
      .attr('font-size', 15)
      .attr('fill', 'red')
      .text(d => d.textContent)
  }

  private updateArrows() {
    const labelPlacementCount = new IncrementalMap<number>()

    const rectById = new Map(this.rects.map(rect => [rect.id, rect] as [string, RectInfo]))
    const sortedRects = sortBy(this.rects, getRectPos)

    const getRelatedRects = ({ id }: RectInfo) => {
      return this.arrows
        .filter(({ startId, endId }) => startId === id || endId === id)
        .map(arrow => {
          if (arrow.startId === id) {
            return arrow.endId
          } else if (arrow.endId === id) {
            return arrow.startId
          }
        })
    }

    function split(baseRectId: string, relatedRectIds: string[]) {
      const x = getRectPos(rectById.get(baseRectId))[1]

      const leftPart = relatedRectIds
        .filter(id => getRectPos(rectById.get(id))[1] <= x)
        .sort((a, b) => getRectPos(rectById.get(a))[1] - getRectPos(rectById.get(b))[1])

      const rightPart = relatedRectIds
        .filter(id => getRectPos(rectById.get(id))[1] > x)
        .sort((a, b) => getRectPos(rectById.get(a))[1] - getRectPos(rectById.get(b))[1])

      return { leftPart, rightPart }
    }

    const findArrow = (id1: string, id2: string) => {
      return this.arrows.find(
        ({ startId, endId }) =>
          (startId === id1 && endId === id2) || (startId === id2 && endId === id1),
      )
    }

    const tickInfoMap = new Map<string, { start: number; end: number }>()

    for (const baseRect of sortedRects) {
      // 确定 baseRect 上每个 tick 的分配情况
      const { leftPart, rightPart } = split(baseRect.id, getRelatedRects(baseRect))

      for (let i = 0; i < leftPart.length; i++) {
        const leftRectId = leftPart[i]
        const arrow = findArrow(baseRect.id, leftRectId)
        const tickInfo = tickInfoMap.get(arrow.id) || { start: -1, end: -1 }
        // arrow 在 baseRect 上的 tick
        const tick = leftPart.length - 1 - i
        if (leftRectId === arrow.startId) {
          tickInfo.end = tick
        } else {
          tickInfo.start = tick
        }
        tickInfoMap.set(arrow.id, tickInfo)
      }

      for (let i = 0; i < rightPart.length; i++) {
        const rightRectId = rightPart[i]
        const arrow = findArrow(baseRect.id, rightRectId)
        const tickInfo = tickInfoMap.get(arrow.id) || { start: -1, end: -1 }
        // arrow 在 baseRect 上的 tick
        const tick = rightPart.length - 1 - i + leftPart.length
        if (rightRectId === arrow.startId) {
          tickInfo.end = tick
        } else {
          tickInfo.start = tick
        }
        tickInfoMap.set(arrow.id, tickInfo)
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

    arrow.attr('d', d => {
      const margin = ARROW_MARGIN
      const startRect = this.rects.find(rect => rect.id === d.startId)
      const endRect = this.rects.find(rect => rect.id === d.endId)
      const labelLine = Math.min(startRect.line, endRect.line)

      const startTick = tickInfoMap.get(d.id).start
      const startX =
        startRect.left +
        (startRect.width * (startTick + 1)) / (this.tickCountMap.get(startRect.id) + 1)

      const endTick = tickInfoMap.get(d.id).end
      const endX =
        endRect.left + (endRect.width * (endTick + 1)) / (this.tickCountMap.get(endRect.id) + 1)

      const startY = this.getY(startRect.line)
      const labelY = this.getY(labelLine) - margin - 25 * labelPlacementCount.getAndInc(labelLine)
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
  }

  private updateRects() {
    const rectJoin = this.wrapper
      .select('.rect-layer')
      .selectAll('rect')
      .data(this.rects)
    const rect = rectJoin
      .enter()
      .append('rect')
      .attr('data-id', d => d.id)
      .merge(rectJoin as any)

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
    const oldMargin = this.margins[line]
    this.margins[line] = margin
    this.emit(marginChange, line, margin, oldMargin)
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
    // TODO texts 和 arrows 应该一起绘制
    //  不然保持 text/arrow 的高度依赖于 this.arrows/this.texts 中元素的顺序
    this.updateTexts()
    this.updateArrows()
  }
}
