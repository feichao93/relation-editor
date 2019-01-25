import * as d3 from 'd3'
import invariant from 'invariant'
import { LABEL_MARGIN } from './constants'
import DecorationManager, { marginChange } from './DecorationManager'
import { layout, makeMeasurer, makeRower } from './layout-utils'
import { Entity, Link } from './types'

export default class RelationEditor {
  private readonly contentWrapper: HTMLDivElement
  private readonly decorations: DecorationManager

  /** editor 使用的分行器 */
  private readonly rower: (text: string) => number[]

  private text: string = ''
  private entities: Entity[] = []

  constructor(private div: HTMLDivElement, font: string) {
    this.contentWrapper = this.initContentWrapper()
    this.rower = makeRower(this.contentWrapper.clientWidth, makeMeasurer(font))
    this.decorations = new DecorationManager(div)

    this.decorations.on(marginChange, (line: number, margin: number) => {
      // 更新 line-div 的位置
      const lineDiv = this.contentWrapper.children.item(line) as HTMLDivElement
      lineDiv.style.marginTop = `${margin}px`
    })
  }

  setText(text: string) {
    this.text = text
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
    const lineInfoList = layout(this.rower(this.text), this.entities)
    const lineJoin = d3
      .select(this.contentWrapper)
      .selectAll('.line')
      .data(lineInfoList)
    lineJoin.exit().remove()
    const line = lineJoin
      .enter()
      .append('div')
      .classed('line', true)
      .attr('data-line', (d, i) => i)
      .merge(lineJoin as any)

    const spanJoin = line.selectAll('span').data(d => d, (d: Partial<Entity>) => `${d.s}-${d.e}`)
    spanJoin.exit().remove()
    spanJoin
      .enter()
      .append('span')
      .text(d => this.text.substring(d.s, d.e))
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

    // 关系的标签需要放置在 labelLine 的 margin 中
    const labelLine = Math.min(A.line, B.line)
    // TODO center 的坐标需要详细计算
    const center = (A.left + A.width / 2 + B.left + B.width / 2) / 2
    this.decorations.addText({
      line: labelLine,
      textContent: link.label,
      center,
      margin: LABEL_MARGIN,
    })

    this.decorations.addArrow({
      startId: link.a,
      endId: link.b,
    })
  }

  // TODO dispose() {}
}
