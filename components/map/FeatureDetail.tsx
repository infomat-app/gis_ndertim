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

export default function FeatureDetail({ feature, layer, canEdit, onClose, onDelete, onSave }: Props) {
  const fields = layer.fields ?? []
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map(f => [f.field_name, String(feature.properties?.[f.field_name] ?? '')])
    )
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
    setEditing(false)
  }

  const createdAt = new Date(feature.created_at).toLocaleString('sq-AL')

  return (
    <div className="absolute top-2 right-2 z-[1000] w-72 bg-s1 border border-b1 rounded-xl shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-b1">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: layer.color }}
        />
        <span className="text-xs font-mono font-semibold text-txt flex-1 truncate">{layer.name}</span>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded hover:bg-acc2/20 text-txt3 hover:text-acc2 transition-colors"
            title="Edito"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => { if (confirm('Fshi objektin?')) onDelete() }}
            className="p-1 rounded hover:bg-err/20 text-txt3 hover:text-err transition-colors"
            title="Fshi"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        )}
        <button onClick={onClose} className="p-1 text-txt3 hover:text-txt transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Properties */}
      <div className="p-3 space-y-2 flex-1 overflow-y-auto max-h-80">
        {fields.length === 0 && Object.keys(feature.properties ?? {}).length === 0 && (
          <p className="text-xs text-txt3 font-mono text-center py-2">Nuk ka fusha.</p>
        )}
        {fields.length === 0 && Object.entries(feature.properties ?? {}).map(([k, v]) => (
          <div key={k}>
            <label className="text-[10px] text-txt3 font-mono uppercase tracking-wide">{k}</label>
            <p className="text-xs text-txt mt-0.5 font-mono break-all">{String(v ?? '—')}</p>
          </div>
        ))}
        {fields.sort((a, b) => a.sort_order - b.sort_order).map(f => (
          <div key={f.id}>
            <label className="text-[10px] text-txt3 font-mono uppercase tracking-wide">{f.field_label}</label>
            {editing ? (
              f.field_type === 'select' ? (
                <select
                  value={values[f.field_name]}
                  onChange={e => set(f.field_name, e.target.value)}
                  className="w-full mt-0.5 bg-bg border border-b1 rounded px-2 py-1 text-xs text-txt outline-none focus:border-acc"
                >
                  <option value="">—</option>
                  {(f.field_options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.field_type === 'boolean' ? (
                <select
                  value={values[f.field_name]}
                  onChange={e => set(f.field_name, e.target.value)}
                  className="w-full mt-0.5 bg-bg border border-b1 rounded px-2 py-1 text-xs text-txt outline-none focus:border-acc"
                >
                  <option value="">—</option>
                  <option value="true">Po</option>
                  <option value="false">Jo</option>
                </select>
              ) : (
                <input
                  type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                  value={values[f.field_name]}
                  onChange={e => set(f.field_name, e.target.value)}
                  className="w-full mt-0.5 bg-bg border border-b1 rounded px-2 py-1 text-xs text-txt outline-none focus:border-acc"
                />
              )
            ) : (
              <p className="text-xs text-txt mt-0.5 font-mono">
                {String(feature.properties?.[f.field_name] ?? '—')}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-b1">
        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-1.5 rounded border border-b2 text-txt2 text-xs font-mono hover:bg-s3"
            >
              Anulo
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-1.5 rounded bg-acc text-[#021a10] font-semibold text-xs hover:bg-[#04c490]"
            >
              Ruaj
            </button>
          </div>
        ) : (
          <div>
            <p className="text-[10px] text-txt3 font-mono">{createdAt}</p>
            {feature.profile && (
              <p className="text-[10px] text-txt3 font-mono">
                {feature.profile.full_name ?? feature.profile.email}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
