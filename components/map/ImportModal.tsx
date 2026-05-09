'use client'
import { useState, useRef } from 'react'
import type { Layer } from '@/lib/types'

interface Props {
  layers: Layer[]
  onImport: (layerId: string, features: GeoJSONFeature[]) => Promise<{ ok: number; err: number }>
  onClose: () => void
}

export interface GeoJSONFeature {
  type: 'Feature'
  geometry: { type: string; coordinates: unknown }
  properties: Record<string, unknown>
}

const GEOM_MAP: Record<string, string> = {
  point: 'Point', multipoint: 'Point',
  linestring: 'LineString', multilinestring: 'LineString',
  polygon: 'Polygon', multipolygon: 'Polygon',
}

// ---- Parsers ----

async function parseGeoJSON(text: string): Promise<GeoJSONFeature[]> {
  const json = JSON.parse(text)
  if (json.type === 'FeatureCollection') return json.features ?? []
  if (json.type === 'Feature') return [json]
  throw new Error('Format GeoJSON i panjohur')
}

async function parseCSV(text: string): Promise<GeoJSONFeature[]> {
  const Papa = (await import('papaparse')).default
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })

  if (!result.data.length) throw new Error('CSV është bosh')

  // Auto-detect lat/lng columns (case-insensitive)
  const cols = Object.keys(result.data[0]).map(c => c.toLowerCase())
  const latCol = Object.keys(result.data[0]).find(c =>
    ['lat','latitude','y','geo_lat','xlat','gps_lat'].includes(c.toLowerCase())
  )
  const lngCol = Object.keys(result.data[0]).find(c =>
    ['lng','lon','long','longitude','x','geo_lon','xlong','gps_lon'].includes(c.toLowerCase())
  )

  if (!latCol || !lngCol) {
    throw new Error(
      `Nuk u gjet kolona lat/lng. Kolonat e gjetura: ${Object.keys(result.data[0]).join(', ')}`
    )
  }

  return result.data
    .filter(row => row[latCol] && row[lngCol])
    .map(row => {
      const lat = parseFloat(row[latCol])
      const lng = parseFloat(row[lngCol])
      const props: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(row)) {
        if (k !== latCol && k !== lngCol) props[k] = v
      }
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: props,
      }
    })
}

async function parseKML(xmlText: string): Promise<GeoJSONFeature[]> {
  const { kml } = await import('@tmcw/togeojson')
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const geojson = kml(doc)
  return (geojson.features ?? []) as GeoJSONFeature[]
}

async function parseKMZ(buffer: ArrayBuffer): Promise<GeoJSONFeature[]> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)
  const kmlEntry = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.kml'))
  if (!kmlEntry) throw new Error('Nuk u gjet skedari .kml brenda KMZ')
  const kmlText = await kmlEntry.async('text')
  return parseKML(kmlText)
}

async function parseShapefile(buffer: ArrayBuffer): Promise<GeoJSONFeature[]> {
  const [{ default: JSZip }, shp] = await Promise.all([
    import('jszip'),
    import('shapefile'),
  ])
  const zip = await JSZip.loadAsync(buffer)
  const shpEntry = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.shp'))
  const dbfEntry = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.dbf'))
  if (!shpEntry) throw new Error('Nuk u gjet .shp brenda ZIP')
  const shpBuf = await shpEntry.async('arraybuffer')
  const dbfBuf = dbfEntry ? await dbfEntry.async('arraybuffer') : undefined
  const features: GeoJSONFeature[] = []
  const source = await shp.open(shpBuf, dbfBuf)
  let r = await source.read()
  while (!r.done) { if (r.value) features.push(r.value as GeoJSONFeature); r = await source.read() }
  return features
}

async function parseFile(f: File): Promise<GeoJSONFeature[]> {
  const name = f.name.toLowerCase()
  if (name.endsWith('.geojson') || name.endsWith('.json')) return parseGeoJSON(await f.text())
  if (name.endsWith('.csv'))  return parseCSV(await f.text())
  if (name.endsWith('.kml'))  return parseKML(await f.text())
  if (name.endsWith('.kmz'))  return parseKMZ(await f.arrayBuffer())
  if (name.endsWith('.zip'))  return parseShapefile(await f.arrayBuffer())
  throw new Error('Format i panjohur. Pranohen: .geojson .json .csv .kml .kmz .zip')
}

// ---- Component ----

export default function ImportModal({ layers, onImport, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file,        setFile]        = useState<File | null>(null)
  const [preview,     setPreview]     = useState<GeoJSONFeature[]>([])
  const [targetLayer, setTargetLayer] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState<{ ok: number; err: number } | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [matchedType, setMatchedType] = useState<string | null>(null)

  const handleFile = async (f: File) => {
    setFile(f); setError(null); setPreview([]); setResult(null); setMatchedType(null)
    setLoading(true)
    try {
      const features = await parseFile(f)
      if (!features.length) throw new Error('Skedari është bosh ose pa objekte')
      const rawType = String(features[0]?.geometry?.type ?? '').toLowerCase()
      const mapped  = GEOM_MAP[rawType] ?? null
      setMatchedType(mapped)
      const match = layers.find(l => l.geom_type === mapped)
      if (match) setTargetLayer(match.id)
      setPreview(features)
    } catch (e) { setError(String(e)) }
    setLoading(false)
  }

  const handleImport = async () => {
    if (!targetLayer || !preview.length) return
    setLoading(true)
    const res = await onImport(targetLayer, preview)
    setResult(res)
    setLoading(false)
  }

  const selectedLayer = layers.find(l => l.id === targetLayer)
  const compatible    = !matchedType || !selectedLayer || selectedLayer.geom_type === matchedType
  const filteredLayers = layers.filter(l => !matchedType || l.geom_type === matchedType)

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-s1 border border-b1 rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-b1 shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#05d9a0" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <h2 className="text-sm font-semibold text-txt flex-1">Import të Dhënash</h2>
          <button onClick={onClose} className="text-txt3 hover:text-txt">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Supported formats */}
          <div className="flex flex-wrap gap-1.5">
            {['.geojson','.json','.csv','.kml','.kmz','.zip (shp)'].map(f => (
              <span key={f} className="text-[10px] font-mono text-txt3 bg-s2 border border-b1 px-2 py-0.5 rounded">
                {f}
              </span>
            ))}
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              file ? 'border-acc/60 bg-acc/5' : 'border-b2 hover:border-b3'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".geojson,.json,.csv,.kml,.kmz,.zip"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {file ? (
              <div>
                <p className="text-sm font-mono text-acc">{file.name}</p>
                <p className="text-xs text-txt3 mt-1">
                  {loading ? 'Duke lexuar skedarin...' : `${preview.length} objekte të gjetura`}
                </p>
              </div>
            ) : (
              <div>
                <svg className="mx-auto mb-3 text-txt3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p className="text-sm text-txt2">Zvarrit këtu ose kliko për të zgjedhur</p>
                <p className="text-xs text-txt3 mt-1 font-mono">GeoJSON · CSV · KML · KMZ · Shapefile ZIP</p>
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-err bg-err/10 border border-err/30 rounded-lg px-3 py-2 font-mono">
              ⚠ {error}
            </div>
          )}

          {/* Preview summary */}
          {preview.length > 0 && !loading && (
            <div className="bg-s2 border border-b1 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-mono text-txt3 uppercase tracking-wider">Parashikim</p>
                <div className="flex gap-2">
                  <span className="text-[10px] font-mono text-acc bg-acc/10 border border-acc/30 px-2 py-0.5 rounded">
                    {preview.length} objekte
                  </span>
                  {matchedType && (
                    <span className="text-[10px] font-mono text-acc2 bg-acc2/10 border border-acc2/30 px-2 py-0.5 rounded">
                      {matchedType}
                    </span>
                  )}
                </div>
              </div>
              {preview[0]?.properties && Object.keys(preview[0].properties).length > 0 && (
                <div>
                  <p className="text-[10px] text-txt3 font-mono mb-2">Atributet e gjetura:</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(preview[0].properties).slice(0, 14).map(k => (
                      <span key={k} className="text-[10px] font-mono text-txt2 bg-s3 border border-b1 px-2 py-0.5 rounded">
                        {k}
                      </span>
                    ))}
                    {Object.keys(preview[0].properties).length > 14 && (
                      <span className="text-[10px] text-txt3 font-mono">
                        +{Object.keys(preview[0].properties).length - 14}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Target layer */}
          {preview.length > 0 && !loading && (
            <div>
              <label className="block text-xs text-txt2 font-mono mb-2">Importo tek shtresa:</label>
              <select
                value={targetLayer}
                onChange={e => setTargetLayer(e.target.value)}
                className="w-full bg-bg border border-b1 rounded-lg px-3 py-2.5 text-sm text-txt outline-none focus:border-acc transition-colors"
              >
                <option value="">— Zgjidh shtresën —</option>
                {filteredLayers.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.geom_type})</option>
                ))}
                {/* show incompatible too, with warning */}
                {layers.filter(l => matchedType && l.geom_type !== matchedType).map(l => (
                  <option key={l.id} value={l.id}>⚠ {l.name} ({l.geom_type})</option>
                ))}
              </select>

              {filteredLayers.length === 0 && (
                <p className="text-xs text-warn font-mono mt-1">
                  Nuk ka shtresa të tipit {matchedType}. Krijo shtresë të re fillimisht.
                </p>
              )}
              {!compatible && selectedLayer && (
                <p className="text-xs text-warn font-mono mt-1">
                  ⚠ Tipi nuk përputhet: skedari ka {matchedType}, shtresa pret {selectedLayer.geom_type}
                </p>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-4 border font-mono text-sm ${
              result.err === 0
                ? 'bg-acc/10 border-acc/30 text-acc'
                : 'bg-warn/10 border-warn/30 text-warn'
            }`}>
              ✓ {result.ok} objekte u importuan
              {result.err > 0 && <span className="text-err"> · {result.err} dështuan</span>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-b1 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-b2 text-txt2 text-sm font-mono hover:bg-s3 transition-colors"
          >
            {result ? 'Mbyll' : 'Anulo'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!targetLayer || !preview.length || loading}
              className="flex-1 py-2.5 rounded-xl bg-acc text-[#021a10] font-semibold text-sm hover:bg-[#04c490] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Duke importuar...' : `Importo ${preview.length ? preview.length + ' objekte' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
