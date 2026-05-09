'use client'
import { useMemo } from 'react'
import type { Feature, Layer } from '@/lib/types'

interface Props {
  layer: Layer
  features: Feature[]
  onClose: () => void
}

export default function AttributeTableModal({ layer, features, onClose }: Props) {
  const columns = useMemo(() => {
    const keys: string[] = []
    const seen = new Set<string>()
    features.forEach(f => Object.keys(f.properties ?? {}).forEach(k => { if (!seen.has(k)) { seen.add(k); keys.push(k) } }))
    return keys
  }, [features])

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl bg-s1 border border-b1 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-b1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: layer.color }} />
          <h2 className="text-sm font-semibold text-txt flex-1 font-mono">
            {layer.name} — Tabela Atributeve
          </h2>
          <span className="text-[10px] font-mono text-txt3 bg-s2 border border-b1 px-2 py-0.5 rounded">
            {features.length} objekte
          </span>
          <button onClick={onClose} className="p-1 text-txt3 hover:text-txt ml-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {features.length === 0 ? (
            <p className="text-xs text-txt3 font-mono text-center py-12">Nuk ka objekte në këtë shtresë.</p>
          ) : (
            <table className="w-full text-xs font-mono border-collapse">
              <thead className="sticky top-0 bg-s2 z-10">
                <tr>
                  <th className="text-left px-3 py-2 text-txt3 font-medium border-b border-r border-b1 w-8">#</th>
                  {layer.geom_type === 'Point' && (
                    <>
                      <th className="text-left px-3 py-2 text-txt3 font-medium border-b border-r border-b1 whitespace-nowrap">Lat</th>
                      <th className="text-left px-3 py-2 text-txt3 font-medium border-b border-r border-b1 whitespace-nowrap">Lng</th>
                    </>
                  )}
                  {columns.map(col => (
                    <th key={col} className="text-left px-3 py-2 text-acc font-medium border-b border-r border-b1 whitespace-nowrap uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => {
                  const [lng, lat] = layer.geom_type === 'Point'
                    ? f.geometry.coordinates as [number, number]
                    : [null, null]
                  return (
                    <tr key={f.id} className={`border-b border-b1 ${i % 2 === 0 ? 'bg-s1' : 'bg-s2'} hover:bg-s3 transition-colors`}>
                      <td className="px-3 py-1.5 text-txt3 border-r border-b1">{i + 1}</td>
                      {layer.geom_type === 'Point' && (
                        <>
                          <td className="px-3 py-1.5 text-txt2 border-r border-b1 tabular-nums">{typeof lat === 'number' ? lat.toFixed(6) : '—'}</td>
                          <td className="px-3 py-1.5 text-txt2 border-r border-b1 tabular-nums">{typeof lng === 'number' ? lng.toFixed(6) : '—'}</td>
                        </>
                      )}
                      {columns.map(col => (
                        <td key={col} className="px-3 py-1.5 text-txt border-r border-b1 max-w-[200px] truncate">
                          {String(f.properties?.[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
