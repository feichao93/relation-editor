import * as d3 from 'd3'
import invariant from 'invariant'
import DecorationManager, { marginsChange } from './DecorationManager'
import { layout, makeMeasurer, makeRower } from './layout-utils'
import { Entity, Link } from './types'

export default class RelationEditor {
  private readonly contentWrapper: HTMLDivElement
  private readonly decorations: DecorationManager
  private lineBreaks: number[]

  /** editor 使用的分行器 */
  private readonly rower: (text: string) => number[]

  private text: string = ''
  private entities: Entity[] = []

  constructor(private div: HTMLDivElement, font: string) {
    this.contentWrapper = this.initContentWrapper()
    this.rower = makeRower(this.contentWrapper.clientWidth, makeMeasurer(font))
    this.decorations = new DecorationManager(div)

    this.decorations.on(marginsChange, (margins: number[]) => {
      for (let i = 0; i < this.lineBreaks.length; i++) {
        // 更新 line-div 的位置
        const lineDiv = this.contentWrapper.children.item(i) as HTMLDivElement
        lineDiv.style.marginTop = `${margins[i] || 15}px` // TODO 15 is magic number
      }
    })
  }

  getText() {
    return this.text
  }

  setText(text: string) {
    this.text = text
    this.lineBreaks = this.rower(text)
    this.update()
  }

  setEntities(entities: Entity[]) {
    this.entities = entities
    this.update()
  }

  private initContentWrapper() {
    const wrapper = document.createElement('div')
    wrapper.classList.add('content-wrapper')
    this.div.appendChild(wrapper)
    return wrapper
  }

  private update() {
    const lineInfoList = layout(this.lineBreaks, this.entities)
    const lineJoin = d3
      .select(this.contentWrapper)
      .selectAll<HTMLDivElement, null>('.line')
      .data(lineInfoList)
    lineJoin.exit().remove()
    const line = lineJoin
      .enter()
      .append('div')
      .classed('line', true)
      .attr('data-line', (d, i) => i)
      .merge(lineJoin)

    const spanJoin = line
      .selectAll<HTMLSpanElement, null>('span')
      .data(d => d, (d: Partial<Entity>) => `${d.startPos}-${d.endPos}`)
    spanJoin.exit().remove()
    spanJoin
      .enter()
      .append('span')
      .text(d => this.text.substring(d.startPos, d.endPos))
      .style('color', d => d.color)
      .attr('data-id', d => d.id)
  }

  private getEntityInfo(id: string) {
    const span = d3
      .select(this.div)
      .select(`[data-id="${id}"]`)
      .node() as HTMLSpanElement
    invariant(
      span != null,
      `Cannot find entity with id \`${id}\` in DOM. Make sure \`${id}\` is a valid entity id.`,
    )
    const line = Number(span.parentElement.dataset.line)
    const box = span.getBoundingClientRect()
    const left = box.left - this.div.getBoundingClientRect().left
    return { id, line, left, width: box.width, fill: 'steelblue' }
  }

  addLink(link: Link) {
    const A = this.getEntityInfo(link.a)
    const B = this.getEntityInfo(link.b)
    this.decorations.addRect(A)
    this.decorations.addRect(B)
    this.decorations.addLink({
      id: link.id,
      startId: link.a,
      endId: link.b,
      label: link.label,
    })

    return link.id
  }

  dispose() {
    this.decorations.dispose()
    // TODO 移除 editor 往 DOM 中添加的那些元素
  }
}
