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

export function exportCSV(layer: Layer, features: Feature[]) {
  if (!features.length) return
  const seen1 = new Set<string>(); const propKeys: string[] = []; features.flatMap(f => Object.keys(f.properties ?? {})).forEach(k => { if (!seen1.has(k)) { seen1.add(k); propKeys.push(k) } })
  const isPoint = layer.geom_type === 'Point'
  const headers = isPoint ? ['lat', 'lng', ...propKeys] : propKeys

  const rows = features.map(f => {
    const row: string[] = []
    if (isPoint) {
      const [lng, lat] = f.geometry.coordinates as [number, number]
      row.push(String(lat), String(lng))
    }
    for (const k of propKeys) row.push(String(f.properties?.[k] ?? ''))
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
