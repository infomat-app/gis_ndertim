'use client'
import { useState } from 'react'
import type { Feature, Layer } from '@/lib/types'

interface Props {
  feature: Feature
  layer: Layer
  isOwn: boolean
  onClose: () => void
  onSave: (props: Record<string, unknown>) => void
  onDelete: () => void
}

export default function FieldFeaturePopup({ feature, layer, isOwn, onClose, onSave, onDelete }: Props) {
  const fields = layer.fields ?? []
  const [tab, setTab] = useState<'info' | 'edit' | 'geom'>('info')
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.field_name, String(feature.properties?.[f.field_name] ?? '')]))
  )
  const [saving, setSaving] = useState(false)

  const firstVal = Object.values(feature.properties ?? {})[0]
  const title = firstVal ? String(firstVal) : `#${feature.id.slice(0, 6)}`
  const [lng, lat] = feature.geometry.coordinates as [number, number]
  const createdAt = feature.created_at ? new Date(feature.created_at).toLocaleString('sq-AL') : '—'

  const handleSave = async () => {
    setSaving(true)
    const props: Record<string, unknown> = {}
    for (const f of fields) {
      const v = values[f.field_name]
      if (f.field_type === 'number') props[f.field_name] = v ? Number(v) : null
      else if (f.field_type === 'boolean') props[f.field_name] = v === 'true'
      else props[f.field_name] = v || null
    }
    await onSave(props)
    setSaving(false)
    setTab('info')
  }

  const tabs = isOwn
    ? (['info', ...(fields.length > 0 ? ['edit'] : []), 'geom'] as const)
    : (['info'] as const)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[1999]" onClick={onClose} />

      <div
        className="fixed bottom-0 left-0 right-0 z-[2000] flex flex-col bg-white rounded-t-2xl shadow-2xl border-t border-gray-200"
        style={{ maxHeight: '65vh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3 shrink-0">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: layer.color }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
            <p className="text-[11px] text-gray-400 font-mono">{layer.name}</p>
          </div>
          {!isOwn && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 shrink-0">
              {feature.profile?.full_name ?? 'Tjetër'}
            </span>
          )}
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-3 shrink-0">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t as typeof tab)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              {t === 'info' ? 'Info' : t === 'edit' ? 'Edito' : 'Koordinata'}
            </button>
          ))}
          {isOwn && (
            <button
              onClick={() => { if (confirm('Fshi këtë objekt?')) onDelete() }}
              className="ml-auto px-3 py-2 text-xs text-red-500 flex items-center gap-1 border-b-2 border-transparent -mb-px"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Fshi
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* INFO */}
          {tab === 'info' && (
            <div className="p-4 space-y-2">
              {fields.length === 0 && Object.keys(feature.properties ?? {}).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nuk ka atribute.</p>
              )}
              {(fields.length > 0
                ? fields.sort((a, b) => a.sort_order - b.sort_order).map(f => (
                    <div key={f.id} className="flex justify-between items-start gap-3">
                      <span className="text-[11px] text-gray-400 uppercase tracking-wide font-medium shrink-0">{f.field_label}</span>
                      <span className="text-[11px] text-gray-800 text-right break-all">
                        {f.field_type === 'boolean'
                          ? (feature.properties?.[f.field_name] ? 'Po' : 'Jo')
                          : String(feature.properties?.[f.field_name] ?? '—')}
                      </span>
                    </div>
                  ))
                : Object.entries(feature.properties ?? {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-start gap-3">
                      <span className="text-[11px] text-gray-400 uppercase tracking-wide font-medium shrink-0">{k}</span>
                      <span className="text-[11px] text-gray-800 text-right break-all">{String(v ?? '—')}</span>
                    </div>
                  ))
              )}
              <div className="pt-2 border-t border-gray-100 mt-2 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">Krijuar</span>
                  <span className="text-gray-600" suppressHydrationWarning>{createdAt}</span>
                </div>
                {feature.profile && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-400">Nga</span>
                    <span className="text-gray-600">{feature.profile.full_name ?? feature.profile.email}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">Lat / Lng</span>
                  <span className="text-gray-600 font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                </div>
              </div>
            </div>
          )}

          {/* EDIT */}
          {tab === 'edit' && isOwn && (
            <div className="p-4 space-y-3">
              {fields.sort((a, b) => a.sort_order - b.sort_order).map(f => (
                <div key={f.id}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    {f.field_label}{f.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {f.field_type === 'select' ? (
                    <select value={values[f.field_name]} onChange={e => setValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400">
                      <option value="">— Zgjidh —</option>
                      {(f.field_options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.field_type === 'boolean' ? (
                    <div className="flex gap-2">
                      {['true', 'false'].map(val => {
                        const active = values[f.field_name] === val
                        return (
                          <button key={val} type="button"
                            onClick={() => setValues(p => ({ ...p, [f.field_name]: val }))}
                            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-95 ${
                              active ? (val === 'true' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500')
                                : 'bg-gray-50 border-gray-200 text-gray-500'
                            }`}>
                            {val === 'true' ? 'Po' : 'Jo'}
                          </button>
                        )
                      })}
                    </div>
                  ) : f.field_type === 'textarea' ? (
                    <textarea value={values[f.field_name]}
                      onChange={e => setValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" />
                  ) : (
                    <input
                      type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                      value={values[f.field_name]}
                      onChange={e => setValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* GEOM */}
          {tab === 'geom' && isOwn && (
            <div className="p-4 space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-400 uppercase tracking-wide font-medium">Lat</span>
                <span className="text-gray-800 font-mono">{lat.toFixed(7)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-400 uppercase tracking-wide font-medium">Lng</span>
                <span className="text-gray-800 font-mono">{lng.toFixed(7)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-400 uppercase tracking-wide font-medium">ID</span>
                <span className="text-gray-800 font-mono text-[10px] truncate max-w-[60%]">{feature.id}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer save */}
        {tab === 'edit' && isOwn && fields.length > 0 && (
          <div className="shrink-0 px-4 py-3 border-t border-gray-100 flex gap-2">
            <button onClick={() => setTab('info')}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors">
              Anulo
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-50 active:scale-[.98] transition-all">
              {saving ? 'Duke ruajtur...' : 'Ruaj Ndryshimet'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
