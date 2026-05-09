'use client'
import { useState } from 'react'
import type { Layer, GeomType } from '@/lib/types'

interface Props {
  layer: Layer
  geomType: GeomType
  onSubmit: (properties: Record<string, unknown>) => void
  onCancel: () => void
}

export default function FeatureForm({ layer, geomType, onSubmit, onCancel }: Props) {
  const fields  = layer.fields ?? []
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(f => [f.field_name, '']))
  )
  const [loading, setLoading] = useState(false)

  const set = (name: string, val: string) => setValues(p => ({ ...p, [name]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const props: Record<string, unknown> = {}
    for (const f of fields) {
      const v = values[f.field_name]
      if (!v && f.required) { setLoading(false); return }
      if (f.field_type === 'number') props[f.field_name] = v ? Number(v) : null
      else if (f.field_type === 'boolean') props[f.field_name] = v === 'true'
      else props[f.field_name] = v || null
    }
    await onSubmit(props)
    setLoading(false)
  }

  const geomLabel = geomType === 'Point' ? '● Pikë' : geomType === 'LineString' ? '— Vijë' : '▬ Poligon'

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-end p-3 pt-14 pointer-events-none">
      <div className="pointer-events-auto w-72 flex flex-col bg-s1 border border-b1 rounded-xl shadow-2xl"
        style={{ maxHeight: 'calc(100vh - 80px)' }}>

        {/* Header — fixed */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-b1 shrink-0">
          <span className="text-xs shrink-0" style={{ color: layer.color }}>{geomLabel}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-txt truncate font-mono">{layer.name}</p>
          </div>
          <button onClick={onCancel} className="text-txt3 hover:text-txt shrink-0 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Fields — scrollable */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {fields.length === 0 && (
            <p className="text-xs text-txt3 font-mono text-center py-3">
              Nuk ka fusha. Ruaj objektin direkt.
            </p>
          )}
          {fields.sort((a, b) => a.sort_order - b.sort_order).map(f => (
            <div key={f.id}>
              <label className="block text-[10px] text-txt3 font-mono mb-0.5 uppercase tracking-wide">
                {f.field_label}{f.required && <span className="text-err ml-0.5">*</span>}
              </label>

              {f.field_type === 'textarea' ? (
                <textarea
                  value={values[f.field_name]}
                  onChange={e => set(f.field_name, e.target.value)}
                  required={f.required}
                  rows={2}
                  className="w-full bg-bg border border-b1 rounded-lg px-2.5 py-1.5 text-xs text-txt outline-none focus:border-acc transition-colors resize-none"
                />
              ) : f.field_type === 'select' ? (
                <select
                  value={values[f.field_name]}
                  onChange={e => set(f.field_name, e.target.value)}
                  required={f.required}
                  className="w-full bg-bg border border-b1 rounded-lg px-2.5 py-1.5 text-xs text-txt outline-none focus:border-acc transition-colors"
                >
                  <option value="">— Zgjidh —</option>
                  {(f.field_options ?? []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : f.field_type === 'boolean' ? (
                <select
                  value={values[f.field_name]}
                  onChange={e => set(f.field_name, e.target.value)}
                  className="w-full bg-bg border border-b1 rounded-lg px-2.5 py-1.5 text-xs text-txt outline-none focus:border-acc transition-colors"
                >
                  <option value="">— Zgjidh —</option>
                  <option value="true">Po</option>
                  <option value="false">Jo</option>
                </select>
              ) : (
                <input
                  type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                  value={values[f.field_name]}
                  onChange={e => set(f.field_name, e.target.value)}
                  required={f.required}
                  className="w-full bg-bg border border-b1 rounded-lg px-2.5 py-1.5 text-xs text-txt outline-none focus:border-acc transition-colors"
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer — always visible */}
        <div className="flex gap-2 px-3 py-2.5 border-t border-b1 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-b2 text-txt2 text-xs font-mono hover:bg-s3 transition-colors"
          >
            Anulo
          </button>
          <button
            onClick={fields.length === 0 ? () => onSubmit({}) : handleSubmit as unknown as React.MouseEventHandler}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-acc text-[#05101e] font-semibold text-xs hover:bg-[#3a9aff] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Duke ruajtur...' : 'Ruaj'}
          </button>
        </div>
      </div>
    </div>
  )
}
