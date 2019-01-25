import * as d3 from 'd3'
import { EventEmitter } from 'events'
import { IncrementalMap, randomId } from './common-utils'
import { ARROW_MARGIN, LABEL_FONT, LINE_HEIGHT } from './constants'
import { makeMeasurer } from './layout-utils'

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

export default class DecorationManager extends EventEmitter {
  private readonly rects: Array<RectInfo> = []
  private readonly texts: Array<TextInfo> = []
  private readonly arrows: Array<ArrowInfo> = []
  private readonly wrapper: d3.Selection<SVGSVGElement, any, any, any>
  private readonly margins: number[] = []
  private readonly labelMeasure = makeMeasurer(LABEL_FONT)

  /** 统计一个 rect 对应了多少个箭头的端点 */
  private readonly endpointCountMap = new IncrementalMap<string>()

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
    // 记录每个 rect 上已经放置了多少个箭头起点/终点
    const endpointPlacementCount = new IncrementalMap<string>()
    const labelPlacementCount = new IncrementalMap<number>()

    const arrowJoin = this.wrapper
      .select('.arrow-layer')
      .selectAll<SVGPathElement, null>('.arrow')
      .data(this.arrows, (d: ArrowInfo) => `${d.startId}:${d.endId}`)
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

      const startPlacementRatio =
        endpointPlacementCount.incAndGet(startRect.id) /
        (this.endpointCountMap.get(startRect.id) + 1)
      const startX = startRect.left + startRect.width * startPlacementRatio

      const endPlacementRatio =
        endpointPlacementCount.incAndGet(endRect.id) / (this.endpointCountMap.get(endRect.id) + 1)
      const endX = endRect.left + endRect.width * endPlacementRatio

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

  addArrow(arrowInfo: Partial<ArrowInfo>) {
    arrowInfo.id = arrowInfo.id || randomId()
    this.arrows.push(arrowInfo as ArrowInfo)
    this.endpointCountMap.incAndGet(arrowInfo.startId)
    this.endpointCountMap.incAndGet(arrowInfo.endId)

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
