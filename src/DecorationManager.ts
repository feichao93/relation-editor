import * as d3 from 'd3'
import calculateHeightLevels from './calculateHeightLevels'
import { LABEL_FONT, LINE_HEIGHT, LINK_MARGIN } from './constants'
import DisposableEventEmitter from './DisposableEventEmitter'
import { makeMeasurer } from './layout-utils'
import { DefaultMap, IncrementalMap, sortBy } from './utils'

export const marginsChange = 'margins-change'

export interface RectInfo {
  id: string
  line: number
  left: number
  width: number
  fill: string
}

export interface LinkInfo {
  id: string
  startId: string
  endId: string
  label: string
}

function getRectPos(rect: RectInfo) {
  return { line: rect.line, x: rect.left + rect.width / 2 }
}

interface ComputeResult {
  heightLevelMap: Map<string, number>
  linkLineById: Map<string, number>
  xMap: Map<string, { start: number; end: number }>
  rectById: Map<string, RectInfo>
  lineHeightLevels: number[]
}

export default class DecorationManager extends DisposableEventEmitter {
  private readonly rects: Array<RectInfo> = []
  private readonly links: Array<LinkInfo> = []
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
    this.wrapper.append('g').classed('link-layer', true)
    this.wrapper
      .append('g')
      .classed('text-layer', true)
      .style('user-select', 'none')
  }

  private getY(line: number) {
    return this.margins.slice(0, line + 1).reduce((x, y) => x + y, line * LINE_HEIGHT)
  }

  addRect(newRect: RectInfo) {
    if (!this.rects.some(rect => rect.id === newRect.id)) {
      this.rects.push(newRect)
      this.updateRects()
    }
  }

  private compute(): ComputeResult {
    const rectById = new Map(this.rects.map(rect => [rect.id, rect] as [string, RectInfo]))
    const linkLineById = new Map(
      this.links.map(link => {
        const startLine = rectById.get(link.startId).line
        const endLine = rectById.get(link.endId).line
        const linkLine = Math.min(startLine, endLine)
        return [link.id, linkLine] as [string, number]
      }),
    )

    const sortedRects = sortBy(this.rects, rect => {
      const pos = getRectPos(rect)
      return [pos.line, pos.x]
    })

    const relatedRectsMap = new DefaultMap<string, string[]>(() => [])
    for (const { startId, endId } of this.links) {
      relatedRectsMap.get(startId).push(endId)
      relatedRectsMap.get(endId).push(startId)
    }

    /** 按照相对于 baseRectId 的位置，将 relatedRectIds 分为左右两个部分 */
    function split(baseRectId: string, relatedRectIds: string[]) {
      const x = (id: string) => getRectPos(rectById.get(id)).x
      const relatedSorted = sortBy(relatedRectIds, id => [x(id)])
      const baseX = x(baseRectId)
      return {
        leftPart: relatedSorted.filter(id => x(id) <= baseX),
        rightPart: relatedSorted.filter(id => x(id) > baseX),
      }
    }

    const findLink = (id1: string, id2: string) =>
      this.links.find(
        ({ startId, endId }) =>
          (startId === id1 && endId === id2) || (startId === id2 && endId === id1),
      )

    /** 记录每个 link 的 startTick 与 endTick */
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
        const link = findLink(baseRect.id, leftRectId)
        const tickInfo = tickMap.get(link.id)
        // link 在 baseRect 上的 tick
        const tick = leftPart.length - 1 - i
        if (leftRectId === link.startId) {
          tickInfo.end = tick
        } else {
          tickInfo.start = tick
        }
        tickMap.set(link.id, tickInfo)
      }

      for (let i = 0; i < rightPart.length; i++) {
        const rightRectId = rightPart[i]
        const link = findLink(baseRect.id, rightRectId)
        const tickInfo = tickMap.get(link.id)
        // link 在 baseRect 上的 tick
        const tick = rightPart.length - 1 - i + leftPart.length
        if (rightRectId === link.startId) {
          tickInfo.end = tick
        } else {
          tickInfo.start = tick
        }
        tickMap.set(link.id, tickInfo)
      }
    }

    /** 记录每个 link 的 startX 与 endX */
    const xMap = new Map<string, { start: number; end: number }>()
    for (const link of this.links) {
      const startTick = tickMap.get(link.id).start
      const startRect = rectById.get(link.startId)
      const endRect = rectById.get(link.endId)
      const startX =
        startRect.left +
        (startRect.width * (startTick + 1)) / (this.tickCountMap.get(startRect.id) + 1)
      const endTick = tickMap.get(link.id).end
      const endX =
        endRect.left + (endRect.width * (endTick + 1)) / (this.tickCountMap.get(endRect.id) + 1)
      xMap.set(link.id, { start: startX, end: endX })
    }

    const heightLevelMap = new Map<string, number>()
    const lineHeightLevels = []
    const maxLine = Math.max(...linkLineById.values())
    for (let line = 0; line <= maxLine; line++) {
      const linksOnThisLine = this.links.filter(({ id }) => linkLineById.get(id) === line)
      let ranges = linksOnThisLine.map(({ id }) => {
        const { start, end } = xMap.get(id)
        return { id, left: Math.min(start, end), right: Math.max(start, end) }
      })
      ranges = sortBy(ranges, x => [x.left, x.right])
      const heightLevels = calculateHeightLevels(ranges)
      lineHeightLevels.push(Math.max(...heightLevels, 0))
      for (let i = 0; i < ranges.length; i++) {
        heightLevelMap.set(ranges[i].id, heightLevels[i])
      }
    }

    return { rectById, linkLineById, xMap, heightLevelMap, lineHeightLevels }
  }

  private updateLinks({ heightLevelMap, linkLineById, rectById, xMap }: ComputeResult) {
    const linkJoin = this.wrapper
      .select('.link-layer')
      .selectAll<SVGPathElement, null>('.link')
      .data(this.links, d => d.id)
    linkJoin.exit().remove()

    const link = linkJoin
      .enter()
      .append('path')
      .classed('link', true)
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('stroke', 'red')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .merge(linkJoin)

    link.attr('d', d => {
      const startRect = rectById.get(d.startId)
      const endRect = rectById.get(d.endId)

      const startX = xMap.get(d.id).start
      const endX = xMap.get(d.id).end

      const startY = this.getY(startRect.line)
      const labelLine = linkLineById.get(d.id)
      const labelY = this.getY(labelLine) - LINK_MARGIN - 25 * (heightLevelMap.get(d.id) - 1)
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
      .data(this.links, d => d.id)
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
        const labelLine = linkLineById.get(d.id)
        return this.getY(labelLine) - 25 * heightLevelMap.get(d.id) + 10
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

  private assignMarginAtLine(line: number, margin: number) {
    while (this.margins.length < line + 1) {
      this.margins.push(0)
    }
    this.margins[line] = margin
  }

  addLink(link: LinkInfo) {
    this.links.push(link)
    this.tickCountMap.inc(link.startId)
    this.tickCountMap.inc(link.endId)

    this.update()
  }

  private updateMargins({ lineHeightLevels }: ComputeResult) {
    for (let line = 0; line < lineHeightLevels.length; line++) {
      const heightLevel = lineHeightLevels[line]
      this.assignMarginAtLine(line, 15 + 25 * heightLevel)
    }
    this.emit(marginsChange, this.margins)
  }

  private update() {
    this.updateRects()
    const computeResult = this.compute()
    this.updateMargins(computeResult)
    this.updateRects()
    this.updateLinks(computeResult)
  }
}
