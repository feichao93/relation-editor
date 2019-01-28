import { COLORS } from '../constants'
import { EntitySpan, layout, LayoutSpan } from '../layout-utils'

test('test-1', () => {
  const text =
    '啤酒上演了“股价连续9个跌停”的惨案，股价跌破20元。此后，重庆啤酒宣布停止研发企业的生产业务。如今，这个项目将彻底与公司告别。重庆啤酒12月15日晚间公告，鉴于重庆佳辰生物工程有限公司（以下简称佳辰生物）已终止了治疗用（合成肽）乙型肝炎疫苗项目的所有研究，为支持科。'
  const entities = [
    { id: 'e1', startPos: 30, endPos: 34, color: COLORS[0] }, // 重庆啤酒
    { id: 'e2', startPos: 98, endPos: 102, color: COLORS[1] }, // 佳辰生物
  ]
  const breaks = [52, 102, text.length]

  const parsedLines: LayoutSpan[][] = [
    [
      { type: 'text-span', startPos: 0, endPos: 30 },
      {
        type: 'entity-span',
        id: 'e1',
        part: 0,
        startPos: 30,
        endPos: 34,
        color: COLORS[0],
      },
      { type: 'text-span', startPos: 34, endPos: 52 },
    ],
    [
      { type: 'text-span', startPos: 52, endPos: 98 },
      {
        type: 'entity-span',
        id: 'e2',
        part: 0,
        startPos: 98,
        endPos: 102,
        color: COLORS[1],
      },
    ],
    [{ type: 'text-span', startPos: 102, endPos: 134 }],
  ]

  expect(layout(breaks, entities)).toEqual(parsedLines)
})
