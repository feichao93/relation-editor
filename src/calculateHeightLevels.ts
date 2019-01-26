import * as d3 from 'd3'

enum Connection {
  na = 'na',
  include = 'include',
  intersect = 'intersect',
  disjoint = 'disjoint',
}

export interface LinkRange {
  id: string
  left: number
  right: number
}

export default function calculateHeightLevels(ranges: LinkRange[]) {
  const size = ranges.length
  const maxHeightLevel = getMaxHeightLevel()
  const matrix = getConnectionMatrix()
  const heightLevels = new Array<number>(ranges.length).fill(0)

  if (backtrack(0)) {
    return heightLevels
  } else {
    throw new Error('Fatal error: cannot assign height levels for these ranges')
  }

  // 给第 i 个 range 赋予高度 h
  function backtrack(i: number) {
    if (i === size) {
      return true
    }

    // 根据 heightLevels[0..i-1] 来决定 i 的高度
    const containerHeightLevel = d3.range(0, i).reduce((HL, j) => {
      if (matrix[i][j] === Connection.include) {
        return Math.min(HL, heightLevels[j])
      } else {
        return HL
      }
    }, maxHeightLevel + 1)

    if (containerHeightLevel === 0) {
      return false
    }
    for (let hl = 1; hl < containerHeightLevel; hl++) {
      const conflict = d3
        .range(0, i)
        .some(j => matrix[i][j] === Connection.intersect && heightLevels[j] === hl)
      if (conflict) {
        continue
      }
      heightLevels[i] = hl
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

  function getMaxHeightLevel() {
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
