import type { Feature, Layer } from './types'

function download(content: string | Blob, filename: string, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportGeoJSON(layer: Layer, features: Feature[]) {
  const fc = {
    type: 'FeatureCollection',
    features: features.map(f => ({ type: 'Feature', geometry: f.geometry, properties: f.properties ?? {} })),
  }
  download(JSON.stringify(fc, null, 2), `${layer.name}.geojson`, 'application/json')
}

function formatCsvValue(value: unknown, type?: string): string {
  if (value == null) return ''
  if (type === 'boolean') return value ? 'Po' : 'Jo'
  if (type === 'multiselect') {
    if (Array.isArray(value)) return value.join(', ')
    try { const a = JSON.parse(String(value)); return Array.isArray(a) ? a.join(', ') : String(value) }
    catch { return String(value) }
  }
  const s = String(value)
  if (s.startsWith('data:')) return '[Media]'
  return s
}

export function exportCSV(layer: Layer, features: Feature[]) {
  if (!features.length) return
  const isPoint = layer.geom_type === 'Point'

  // Use layer.fields for column order + labels if available
  const cols = (layer.fields ?? []).length > 0
    ? [...(layer.fields ?? [])].sort((a, b) => a.sort_order - b.sort_order).filter(f => f.field_type !== 'hidden')
    : (() => {
        const seen = new Set<string>(); const keys: string[] = []
        features.flatMap(f => Object.keys(f.properties ?? {})).forEach(k => { if (!seen.has(k)) { seen.add(k); keys.push(k) } })
        return keys.map(k => ({ field_name: k, field_label: k, field_type: undefined as unknown as never }))
      })()

  const headers = isPoint ? ['Lat', 'Lng', ...cols.map(c => c.field_label)] : cols.map(c => c.field_label)

  const rows = features.map(f => {
    const row: string[] = []
    if (isPoint) {
      const [lng, lat] = f.geometry.coordinates as [number, number]
      row.push(String(lat), String(lng))
    }
    for (const c of cols) row.push(formatCsvValue(f.properties?.[c.field_name], c.field_type))
    return row
  })

  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  download(csv, `${layer.name}.csv`, 'text/csv;charset=utf-8')
}

export async function exportXLS(layer: Layer, features: Feature[]) {
  const { utils, write } = await import('xlsx')
  const seen1 = new Set<string>(); const propKeys: string[] = []; features.flatMap(f => Object.keys(f.properties ?? {})).forEach(k => { if (!seen1.has(k)) { seen1.add(k); propKeys.push(k) } })
  const isPoint = layer.geom_type === 'Point'

  const rows = features.map(f => {
    const row: Record<string, unknown> = {}
    if (isPoint) {
      const [lng, lat] = f.geometry.coordinates as [number, number]
      row['lat'] = lat; row['lng'] = lng
    }
    for (const k of propKeys) row[k] = f.properties?.[k] ?? ''
    return row
  })

  const ws = utils.json_to_sheet(rows)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, layer.name.slice(0, 31))
  const buf = write(wb, { type: 'array', bookType: 'xlsx' })
  download(new Blob([buf], { type: 'application/octet-stream' }), `${layer.name}.xlsx`)
}

export function exportKML(layer: Layer, features: Feature[]) {
  const placemarks = features.map(f => {
    const name = Object.values(f.properties ?? {})[0] ?? f.id.slice(0, 8)
    const desc = Object.entries(f.properties ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n')

    let geomXml = ''
    if (layer.geom_type === 'Point') {
      const [lng, lat] = f.geometry.coordinates as [number, number]
      geomXml = `<Point><coordinates>${lng},${lat},0</coordinates></Point>`
    } else if (layer.geom_type === 'LineString') {
      const coords = (f.geometry.coordinates as [number, number][]).map(([lo, la]) => `${lo},${la},0`).join(' ')
      geomXml = `<LineString><coordinates>${coords}</coordinates></LineString>`
    } else if (layer.geom_type === 'Polygon') {
      const ring = (f.geometry.coordinates as [number, number][][])[0]
      const coords = ring.map(([lo, la]) => `${lo},${la},0`).join(' ')
      geomXml = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>`
    }

    return `  <Placemark>
    <name>${name}</name>
    <description>${desc}</description>
    ${geomXml}
  </Placemark>`
  }).join('\n')

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${layer.name}</name>
${placemarks}
</Document>
</kml>`
  download(kml, `${layer.name}.kml`, 'application/vnd.google-earth.kml+xml')
}

export async function exportShapefile(layer: Layer, features: Feature[]) {
  const shpwrite = await import('@mapbox/shp-write')
  const fc = {
    type: 'FeatureCollection' as const,
    features: features.map(f => ({
      type: 'Feature' as const,
      geometry: f.geometry as GeoJSON.Geometry,
      properties: f.properties ?? {},
    })),
  }
  const zip: ArrayBuffer = await shpwrite.default.zip(fc, { outputType: 'arraybuffer', compression: 'DEFLATE' })
  download(new Blob([zip], { type: 'application/zip' }), `${layer.name}.zip`)
}
