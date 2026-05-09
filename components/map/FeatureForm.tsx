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

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full sm:max-w-md bg-s1 border border-b1 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: layer.color + '22', border: `1px solid ${layer.color}55` }}
          >
            <span style={{ color: layer.color }} className="font-bold text-sm">
              {geomType === 'Point' ? '●' : geomType === 'LineString' ? '—' : '▬'}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-txt">{layer.name}</h3>
            <p className="text-[10px] text-txt3 font-mono">Shto objekt të ri · {geomType}</p>
          </div>
          <button onClick={onCancel} className="ml-auto text-txt3 hover:text-txt">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="text-xs text-txt3 font-mono text-center py-4">
            Kjo shtresë nuk ka fusha të konfiguruara.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {fields.sort((a, b) => a.sort_order - b.sort_order).map(f => (
              <div key={f.id}>
                <label className="block text-xs text-txt2 font-mono mb-1">
                  {f.field_label}
                  {f.required && <span className="text-err ml-1">*</span>}
                </label>

                {f.field_type === 'textarea' ? (
                  <textarea
                    value={values[f.field_name]}
                    onChange={e => set(f.field_name, e.target.value)}
                    required={f.required}
                    rows={3}
                    className="w-full bg-bg border border-b1 rounded-lg px-3 py-2 text-sm text-txt outline-none focus:border-acc transition-colors resize-none"
                  />
                ) : f.field_type === 'select' ? (
                  <select
                    value={values[f.field_name]}
                    onChange={e => set(f.field_name, e.target.value)}
                    required={f.required}
                    className="w-full bg-bg border border-b1 rounded-lg px-3 py-2 text-sm text-txt outline-none focus:border-acc transition-colors"
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
                    className="w-full bg-bg border border-b1 rounded-lg px-3 py-2 text-sm text-txt outline-none focus:border-acc transition-colors"
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
                    className="w-full bg-bg border border-b1 rounded-lg px-3 py-2 text-sm text-txt outline-none focus:border-acc transition-colors"
                  />
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-lg border border-b2 text-txt2 text-sm font-mono hover:bg-s3 transition-colors"
              >
                Anulo
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg bg-acc text-[#05101e] font-semibold text-sm hover:bg-[#3a9aff] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Duke ruajtur...' : 'Ruaj Objektin'}
              </button>
            </div>
          </form>
        )}

        {/* Quick save (no fields case) */}
        {fields.length === 0 && (
          <div className="flex gap-2 mt-4">
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg border border-b2 text-txt2 text-sm font-mono hover:bg-s3 transition-colors">
              Anulo
            </button>
            <button
              onClick={() => onSubmit({})}
              className="flex-1 py-2.5 rounded-lg bg-acc text-[#05101e] font-semibold text-sm hover:bg-[#3a9aff] transition-colors"
            >
              Ruaj
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
