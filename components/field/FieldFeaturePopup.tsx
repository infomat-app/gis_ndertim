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

  const allTabs = [
    { id: 'info',  label: 'Info' },
    ...(isOwn && fields.length > 0 ? [{ id: 'edit', label: 'Edito' }] : []),
    { id: 'geom', label: 'GPS' },
  ] as const

  return (
    <>
      <div className="fixed inset-0 z-[1999]" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-[2000] flex flex-col bg-s1 border-t border-b1 rounded-t-2xl shadow-2xl"
        style={{ maxHeight: '60vh' }}>

        {/* Handle */}
        <div className="flex justify-center pt-2 pb-0.5 shrink-0">
          <div className="w-8 h-1 rounded-full bg-b2" />
        </div>

        {/* Header */}
        <div className="px-4 pt-2 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Color accent */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: layer.color + '22', border: `1.5px solid ${layer.color}55` }}>
              <div className="w-3 h-3 rounded-full" style={{ background: layer.color }} />
            </div>

            {/* Title + layer */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-txt leading-tight truncate">{title}</p>
              <p className="text-[11px] text-txt3 font-mono">{layer.name}</p>
            </div>

            {/* Owner badge or "Tjetër" */}
            {!isOwn && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-s3 text-txt3 border border-b2 shrink-0">
                {feature.profile?.full_name?.split(' ')[0] ?? 'Tjetër'}
              </span>
            )}

            {/* Close */}
            <button onClick={onClose}
              className="w-7 h-7 rounded-lg bg-s3 border border-b2 flex items-center justify-center text-txt3 hover:text-txt transition-colors shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mt-2.5">
            <div className="flex gap-1 bg-s2 border border-b1 rounded-lg p-0.5 flex-1">
              {allTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`flex-1 py-1 rounded-md text-[11px] font-mono font-semibold transition-all ${
                    tab === t.id
                      ? 'bg-acc text-white shadow-sm'
                      : 'text-txt3 hover:text-txt'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {isOwn && (
              <button
                onClick={() => { if (confirm('Fshi këtë objekt?')) onDelete() }}
                className="w-8 h-8 rounded-lg bg-err/10 border border-err/30 flex items-center justify-center text-err hover:bg-err/20 transition-colors shrink-0"
                title="Fshi"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto border-t border-b1">

          {/* INFO */}
          {tab === 'info' && (
            <div className="px-4 py-3 space-y-0">
              {fields.length === 0 && Object.keys(feature.properties ?? {}).length === 0 && (
                <p className="text-xs text-txt3 font-mono text-center py-4">Nuk ka atribute.</p>
              )}
              {(fields.length > 0
                ? fields.sort((a, b) => a.sort_order - b.sort_order).map(f => ({
                    label: f.field_label,
                    value: f.field_type === 'boolean'
                      ? (feature.properties?.[f.field_name] ? 'Po ✓' : 'Jo ✗')
                      : String(feature.properties?.[f.field_name] ?? '—'),
                  }))
                : Object.entries(feature.properties ?? {}).map(([k, v]) => ({ label: k, value: String(v ?? '—') }))
              ).map(({ label, value }, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-b1 last:border-0">
                  <span className="text-[11px] text-txt3 font-mono uppercase tracking-wide shrink-0">{label}</span>
                  <span className="text-[12px] text-txt font-medium text-right break-all">{value}</span>
                </div>
              ))}

              {/* Meta row */}
              <div className="flex items-center justify-between gap-3 py-2 border-b border-b1">
                <span className="text-[11px] text-txt3 font-mono uppercase tracking-wide">Lat / Lng</span>
                <span className="text-[11px] text-txt2 font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
              </div>
              {feature.profile && (
                <div className="flex items-center justify-between gap-3 py-2">
                  <span className="text-[11px] text-txt3 font-mono uppercase tracking-wide">Nga</span>
                  <span className="text-[12px] text-txt">{feature.profile.full_name ?? feature.profile.email}</span>
                </div>
              )}
            </div>
          )}

          {/* EDIT */}
          {tab === 'edit' && isOwn && (
            <div className="px-4 py-3 space-y-3">
              {fields.sort((a, b) => a.sort_order - b.sort_order).map(f => (
                <div key={f.id}>
                  <label className="block text-[11px] font-mono text-txt3 uppercase tracking-wide mb-1.5">
                    {f.field_label}{f.required && <span className="text-err ml-1">*</span>}
                  </label>
                  {f.field_type === 'select' ? (
                    <select value={values[f.field_name]}
                      onChange={e => setValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      className="w-full bg-s2 border border-b1 rounded-xl px-3 py-2.5 text-sm text-txt outline-none focus:border-acc transition-colors">
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
                              active
                                ? (val === 'true' ? 'bg-green-600 text-white border-green-600' : 'bg-err text-white border-err')
                                : 'bg-s2 border-b1 text-txt3'
                            }`}>
                            {val === 'true' ? 'Po' : 'Jo'}
                          </button>
                        )
                      })}
                    </div>
                  ) : f.field_type === 'textarea' ? (
                    <textarea value={values[f.field_name]}
                      onChange={e => setValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      rows={3}
                      className="w-full bg-s2 border border-b1 rounded-xl px-3 py-2.5 text-sm text-txt outline-none focus:border-acc transition-colors resize-none" />
                  ) : (
                    <input
                      type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                      value={values[f.field_name]}
                      onChange={e => setValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      className="w-full bg-s2 border border-b1 rounded-xl px-3 py-2.5 text-sm text-txt outline-none focus:border-acc transition-colors" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* GEOM */}
          {tab === 'geom' && (
            <div className="px-4 py-3 space-y-0">
              {[
                { label: 'Lat', value: lat.toFixed(7) },
                { label: 'Lng', value: lng.toFixed(7) },
                { label: 'ID',  value: feature.id.slice(0, 16) + '…' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-3 py-2 border-b border-b1 last:border-0">
                  <span className="text-[11px] text-txt3 font-mono uppercase tracking-wide">{label}</span>
                  <span className="text-[11px] text-txt2 font-mono">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save footer */}
        {tab === 'edit' && isOwn && fields.length > 0 && (
          <div className="shrink-0 px-4 py-3 border-t border-b1 flex gap-2">
            <button onClick={() => setTab('info')}
              className="px-4 py-2.5 rounded-xl border border-b2 text-txt2 text-sm font-mono hover:bg-s3 transition-colors">
              Anulo
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-acc text-white font-semibold text-sm disabled:opacity-50 active:scale-[.98] transition-all hover:bg-[#1d4ed8]">
              {saving
                ? <span className="flex items-center justify-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                    Duke ruajtur...
                  </span>
                : 'Ruaj Ndryshimet'
              }
            </button>
          </div>
        )}
      </div>
    </>
  )
}
