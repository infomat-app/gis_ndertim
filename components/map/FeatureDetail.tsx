'use client'
import { useState } from 'react'
import type { Feature, Layer } from '@/lib/types'

interface Props {
  feature: Feature
  layer: Layer
  canEdit: boolean
  onClose: () => void
  onDelete: () => void
  onSave: (props: Record<string, unknown>) => void
}

function vertexCount(f: Feature): number {
  const flatten = (c: unknown): number => {
    if (Array.isArray(c) && typeof c[0] === 'number') return 1
    if (Array.isArray(c)) return c.reduce((s, x) => s + flatten(x), 0)
    return 0
  }
  return flatten(f.geometry.coordinates)
}

export default function FeatureDetail({ feature, layer, canEdit, onClose, onDelete, onSave }: Props) {
  const fields = layer.fields ?? []
  const [tab, setTab] = useState<'info' | 'edit' | 'geom'>('info')
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(f => [f.field_name, String(feature.properties?.[f.field_name] ?? '')]))
  )

  const set = (name: string, val: string) => setValues(p => ({ ...p, [name]: val }))

  const handleSave = () => {
    const props: Record<string, unknown> = {}
    for (const f of fields) {
      const v = values[f.field_name]
      if (f.field_type === 'number') props[f.field_name] = v ? Number(v) : null
      else if (f.field_type === 'boolean') props[f.field_name] = v === 'true'
      else props[f.field_name] = v || null
    }
    onSave(props)
    setTab('info')
  }

  const tabs = [
    { id: 'info', label: 'Info' },
    ...(canEdit ? [{ id: 'edit', label: 'Edito' }] : []),
    { id: 'geom', label: 'Gjeometria' },
  ] as const

  const geomCoords = feature.geometry.coordinates
  const isPoint = layer.geom_type === 'Point'
  const [lng, lat] = isPoint ? geomCoords as [number, number] : [null, null]

  const createdAt = feature.created_at ? new Date(feature.created_at).toLocaleString('sq-AL') : '—'
  const firstVal = Object.values(feature.properties ?? {})[0]
  const title = firstVal ? String(firstVal) : layer.name

  return (
    <div className="absolute top-2 right-2 z-[1000] w-80 bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col text-gray-800" style={{ maxHeight: '80vh' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-900 truncate">{title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: layer.color + '22', color: layer.color }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: layer.color }} />
                {layer.name}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors shrink-0 p-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">{layer.geom_type} · {vertexCount(feature)} pika</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-2 pt-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
        {canEdit && (
          <button
            onClick={() => { if (confirm('Fshi objektin?')) onDelete() }}
            className="ml-auto px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 border-b-2 border-transparent -mb-px flex items-center gap-1 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Fshi
          </button>
        )}
      </div>

      {/* Tab content — scrollable body + fixed footer for edit */}
      <div className="flex-1 overflow-y-auto">

        {/* INFO tab */}
        {tab === 'info' && (
          <div className="p-3 space-y-2">
            {fields.length === 0 && Object.keys(feature.properties ?? {}).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Nuk ka atribute.</p>
            )}
            {fields.length === 0
              ? Object.entries(feature.properties ?? {}).map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-2">
                    <span className="text-[11px] text-gray-400 uppercase tracking-wide shrink-0 font-medium">{k}</span>
                    <span className="text-[11px] text-gray-800 text-right break-all">{String(v ?? '—')}</span>
                  </div>
                ))
              : fields.sort((a, b) => a.sort_order - b.sort_order).map(f => (
                  <div key={f.id} className="flex items-start justify-between gap-2">
                    <span className="text-[11px] text-gray-400 uppercase tracking-wide shrink-0 font-medium">{f.field_label}</span>
                    <span className="text-[11px] text-gray-800 text-right break-all">
                      {String(feature.properties?.[f.field_name] ?? '—')}
                    </span>
                  </div>
                ))
            }
          </div>
        )}

        {/* EDIT tab */}
        {tab === 'edit' && canEdit && (
          <div className="p-3 space-y-3">
            {fields.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Nuk ka fusha për editim. Shto fusha tek Layer Editor.</p>
            )}
            {fields.sort((a, b) => a.sort_order - b.sort_order).map(f => (
              <div key={f.id}>
                <label className="block text-[11px] text-gray-500 font-medium mb-1">{f.field_label}{f.required && <span className="text-red-400 ml-0.5">*</span>}</label>
                {f.field_type === 'select' ? (
                  <select value={values[f.field_name]} onChange={e => set(f.field_name, e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-blue-400">
                    <option value="">—</option>
                    {(f.field_options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.field_type === 'boolean' ? (
                  <select value={values[f.field_name]} onChange={e => set(f.field_name, e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-blue-400">
                    <option value="">—</option>
                    <option value="true">Po</option>
                    <option value="false">Jo</option>
                  </select>
                ) : f.field_type === 'textarea' ? (
                  <textarea value={values[f.field_name]} onChange={e => set(f.field_name, e.target.value)} rows={3}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-blue-400 resize-none" />
                ) : (
                  <input type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                    value={values[f.field_name]} onChange={e => set(f.field_name, e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-blue-400" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* GEOMETRY tab */}
        {tab === 'geom' && (
          <div className="p-3 space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400 font-medium uppercase tracking-wide">Tipi</span>
              <span className="text-gray-800">{layer.geom_type}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400 font-medium uppercase tracking-wide">Kulmet</span>
              <span className="text-gray-800">{vertexCount(feature)}</span>
            </div>
            {isPoint && typeof lat === 'number' && (
              <>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400 font-medium uppercase tracking-wide">Lat</span>
                  <span className="text-gray-800 font-mono">{lat.toFixed(7)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400 font-medium uppercase tracking-wide">Lng</span>
                  <span className="text-gray-800 font-mono">{(lng as number).toFixed(7)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400 font-medium uppercase tracking-wide">ID</span>
              <span className="text-gray-800 font-mono text-[10px] truncate max-w-[60%]">{feature.id}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400 font-medium uppercase tracking-wide">Krijuar</span>
              <span className="text-gray-800">{createdAt}</span>
            </div>
            {feature.profile && (
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-400 font-medium uppercase tracking-wide">Nga</span>
                <span className="text-gray-800">{feature.profile.full_name ?? feature.profile.email}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed footer — only in edit tab with fields */}
      {tab === 'edit' && canEdit && fields.length > 0 && (
        <div className="shrink-0 flex gap-2 px-3 py-2.5 border-t border-gray-100">
          <button
            onClick={() => setTab('info')}
            className="flex-1 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition-colors"
          >
            Anulo
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-1.5 rounded-lg bg-blue-500 text-white font-semibold text-xs hover:bg-blue-600 transition-colors"
          >
            Ruaj
          </button>
        </div>
      )}
    </div>
  )
}
