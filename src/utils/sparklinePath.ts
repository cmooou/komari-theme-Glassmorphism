export interface SparklineGeometry {
  linePaths: string[]
  fillPaths: string[]
  width: number
  height: number
}

interface SparklinePoint {
  x: number
  y: number
}

function percentileSorted(sorted: number[], percentile: number): number {
  if (!sorted.length)
    return 0

  const position = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * percentile))
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lowerValue = sorted[lowerIndex] ?? sorted[0] ?? 0
  const upperValue = sorted[upperIndex] ?? lowerValue
  if (lowerIndex === upperIndex)
    return lowerValue

  return lowerValue + (upperValue - lowerValue) * (position - lowerIndex)
}

export function robustDomain(values: number[]): { min: number, max: number } {
  if (!values.length)
    return { min: 0, max: 1 }

  const sorted = [...values].sort((left, right) => left - right)
  const min = sorted[0] ?? 0
  const max = sorted.at(-1) ?? min
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.08)
    return { min: min - pad, max: max + pad }
  }

  const p95 = percentileSorted(sorted, 0.95)
  const span = Math.max(p95 - min, max - min)
  const cappedMax = max > p95 * 1.8 && p95 > min
    ? p95 + span * 0.12
    : max
  const pad = Math.max((cappedMax - min) * 0.08, 0.5)
  return {
    min: min - pad,
    max: cappedMax + pad,
  }
}

function catmullRomPath(points: SparklinePoint[]): string {
  if (!points.length)
    return ''
  if (points.length === 1)
    return `M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`

  let path = `M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[index - 1] ?? points[index]!
    const p1 = points[index]!
    const p2 = points[index + 1]!
    const p3 = points[index + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return path
}

function toSegments(values: Array<number | null | undefined>): Array<Array<{ index: number, value: number }>> {
  const segments: Array<Array<{ index: number, value: number }>> = []
  let current: Array<{ index: number, value: number }> = []

  values.forEach((value, index) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      current.push({ index, value })
      return
    }
    if (current.length) {
      segments.push(current)
      current = []
    }
  })

  if (current.length)
    segments.push(current)

  return segments
}

export function buildSparklineGeometry(
  values: Array<number | null | undefined>,
  options: { width?: number, height?: number, padding?: number } = {},
): SparklineGeometry {
  const width = options.width ?? 120
  const height = options.height ?? 28
  const padding = options.padding ?? 2
  const finiteValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const empty = {
    linePaths: [] as string[],
    fillPaths: [] as string[],
    width,
    height,
  }

  if (!finiteValues.length)
    return empty

  const domain = robustDomain(finiteValues)
  const range = domain.max - domain.min || 1
  const innerHeight = Math.max(1, height - padding * 2)
  const lastIndex = Math.max(values.length - 1, 1)

  const yFor = (value: number) => {
    const ratio = (value - domain.min) / range
    const y = padding + (1 - ratio) * innerHeight
    return Math.min(height - padding, Math.max(padding, y))
  }

  const xFor = (index: number) => {
    if (values.length <= 1)
      return width / 2
    return (index / lastIndex) * width
  }

  const linePaths: string[] = []
  const fillPaths: string[] = []
  const baseline = height - padding

  for (const segment of toSegments(values)) {
    const points = segment.map(item => ({
      x: xFor(item.index),
      y: yFor(item.value),
    }))
    if (points.length === 1) {
      const point = points[0]!
      const left = Math.max(0, point.x - 4)
      const right = Math.min(width, point.x + 4)
      points.unshift({ x: left, y: point.y })
      points.push({ x: right, y: point.y })
    }

    const linePath = catmullRomPath(points)
    if (!linePath)
      continue

    linePaths.push(linePath)
    const first = points[0]!
    const last = points.at(-1)!
    fillPaths.push(`${linePath} L ${last.x.toFixed(2)} ${baseline.toFixed(2)} L ${first.x.toFixed(2)} ${baseline.toFixed(2)} Z`)
  }

  return { linePaths, fillPaths, width, height }
}
