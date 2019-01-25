export interface SpanInfo {
  id?: string
  s: number
  e: number
  color?: string
}

export interface Link {
  a: string
  b: string
  label: string
}

export interface Entity {
  id: string
  s: number
  color: string
  e: number
}
