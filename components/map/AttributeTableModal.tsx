'use client'
import { useMemo, useState, useCallback } from 'react'
import type { Feature, Layer } from '@/lib/types'
import { exportCSV } from '@/lib/exports'

interface Props {
  layer: Layer
  features: Feature[]
  canEditFeature: (f: Feature) => boolean
  onClose: () => void
  onSelectFeature: (f: Feature) => void
  onZoomToFeature: (f: Feature) => void
  onDeleteFeature: (f: Feature) => void
}

export default function AttributeTableModal({
  layer, features, canEditFeature, onClose,
  onSelectFeature, onZoomToFeature, onDeleteFeature,
}: Props) {
  const [search,    setSearch]    = useState('')
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [lastClick, setLastClick] = useState<string | null>(null)

  const columns = useMemo(() => {
    const keys: string[] = []
    const seen = new Set<string>()
    features.forEach(f => Object.keys(f.properties ?? {}).forEach(k => {
      if (!seen.has(k)) { seen.add(k); keys.push(k) }
    }))
    return keys
  }, [features])

  const filtered = useMemo(() => {
    if (!search.trim()) return features
    const q = search.toLowerCase()
    return features.filter(f =>
      Object.values(f.properties ?? {}).some(v => String(v).toLowerCase().includes(q))
    )
  }, [features, search])

  const handleRowClick = useCallback((f: Feature) => {
    setSelected(new Set([f.id]))
    setLastClick(f.id)
    onSelectFeature(f)
  }, [onSelectFeature])

  const handleRowRightClick = useCallback((e: React.MouseEvent, f: Feature) => {
    e.preventDefault()
    setSelected(new Set([f.id]))
    setLastClick(f.id)
    onSelectFeature(f)
    onZoomToFeature(f)
  }, [onSelectFeature, onZoomToFeature])

  const handleDeleteSelected = () => {
    if (!selected.size) return
    const toDelete = features.filter(f => selected.has(f.id) && canEditFeature(f))
    if (!toDelete.length) return
    if (!confirm(`Fshi ${toDelete.length} objekt(e)?`)) return
    toDelete.forEach(f => onDeleteFeature(f))
    setSelected(new Set())
  }

  const deletableSelected = useMemo(
    () => features.filter(f => selected.has(f.id) && canEditFeature(f)).length,
    [features, selected, canEditFeature]
  )

  const handleZoomSelected = () => {
    const f = features.find(f => selected.has(f.id))
    if (f) { onSelectFeature(f); onZoomToFeature(f) }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1500] flex flex-col bg-white border-t border-gray-300 shadow-2xl" style={{ height: '42vh' }}>

      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 shrink-0 bg-gray-50">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: layer.color }} />
        <span className="text-xs font-semibold text-gray-700 font-mono">{layer.name}</span>
        <span className="text-[10px] text-gray-400 font-mono">{filtered.length} / {features.length} objekte</span>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Kërko..."
            className="pl-7 pr-3 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400 w-44"
          />
        </div>

        {/* Action buttons */}
        <button
          onClick={handleZoomSelected}
          disabled={!selected.size}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Zoom
        </button>
        <button
          onClick={handleDeleteSelected}
          disabled={!deletableSelected}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
          Fshi {deletableSelected > 0 && `(${deletableSelected})`}
        </button>
        <button
          onClick={() => exportCSV(layer, features)}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          CSV
        </button>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="text-left px-3 py-1.5 text-gray-500 font-medium border-b border-r border-gray-200 w-10 select-none">#</th>
              {layer.geom_type === 'Point' && (
                <>
                  <th className="text-left px-3 py-1.5 text-gray-500 font-medium border-b border-r border-gray-200 whitespace-nowrap">Lat</th>
                  <th className="text-left px-3 py-1.5 text-gray-500 font-medium border-b border-r border-gray-200 whitespace-nowrap">Lng</th>
                </>
              )}
              {columns.map(col => (
                <th key={col} className="text-left px-3 py-1.5 text-blue-600 font-semibold border-b border-r border-gray-200 whitespace-nowrap uppercase tracking-wide">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length + 3} className="text-center py-8 text-gray-400 text-xs">
                  Nuk ka rezultate.
                </td>
              </tr>
            )}
            {filtered.map((f, i) => {
              const isSelected = selected.has(f.id)
              const [lng, lat] = layer.geom_type === 'Point'
                ? f.geometry.coordinates as [number, number]
                : [null, null]
              return (
                <tr
                  key={f.id}
                  onClick={() => handleRowClick(f)}
                  onContextMenu={e => handleRowRightClick(e, f)}
                  className={`border-b border-gray-100 cursor-pointer select-none transition-colors ${
                    isSelected
                      ? 'bg-yellow-50 border-yellow-200'
                      : i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'
                  }`}
                >
                  <td className="px-3 py-1 text-gray-400 border-r border-gray-100 font-mono">
                    {canEditFeature(f)
                      ? i + 1
                      : <span title="Rekord i të tjerëve"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline text-gray-300"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
                    }
                  </td>
                  {layer.geom_type === 'Point' && (
                    <>
                      <td className="px-3 py-1 text-gray-600 border-r border-gray-100 font-mono tabular-nums">
                        {typeof lat === 'number' ? lat.toFixed(5) : '—'}
                      </td>
                      <td className="px-3 py-1 text-gray-600 border-r border-gray-100 font-mono tabular-nums">
                        {typeof lng === 'number' ? lng.toFixed(5) : '—'}
                      </td>
                    </>
                  )}
                  {columns.map(col => (
                    <td key={col} className={`px-3 py-1 border-r border-gray-100 max-w-[180px] truncate ${isSelected ? 'text-yellow-900 font-medium' : 'text-gray-700'}`}>
                      {String(f.properties?.[col] ?? '—')}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer hint */}
      <div className="px-4 py-1 border-t border-gray-200 bg-gray-50 shrink-0">
        <p className="text-[10px] text-gray-400">Klik → zgjidh objekt  •  Klik i djathtë → pozicionohu në hartë  •  Esc mbyll</p>
      </div>
    </div>
  )
}
