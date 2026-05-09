'use client'
import { useState, useEffect } from 'react'
import type { Layer, LayerField, GeomType, FieldType } from '@/lib/types'

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text',     label: 'Tekst' },
  { value: 'number',   label: 'Numër' },
  { value: 'date',     label: 'Datë' },
  { value: 'select',   label: 'Listë zgjedhëse' },
  { value: 'textarea', label: 'Tekst i gjatë' },
  { value: 'boolean',  label: 'Po / Jo' },
]

type DraftField = Omit<LayerField, 'id' | 'layer_id'>

interface Props {
  layer: Layer | null
  onSave: (layerData: Omit<Layer, 'id'|'created_at'|'updated_at'>, fields: DraftField[]) => void
  onClose: () => void
}

const blank: Omit<Layer, 'id'|'created_at'|'updated_at'> = {
  name: '',
  description: '',
  geom_type: 'Point',
  color: '#e91e8c',
  fill_color: '#e91e8c',
  opacity: 0.8,
  visible: true,
  sort_order: 0,
  created_by: null,
}

export default function LayerEditorModal({ layer, onSave, onClose }: Props) {
  const [data, setData]     = useState<Omit<Layer,'id'|'created_at'|'updated_at'>>(blank)
  const [fields, setFields] = useState<DraftField[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (layer) {
      const { id, created_at, updated_at, fields: lf, ...rest } = layer
      setData(rest)
      setFields((lf ?? []).map(f => {
        const { id: _, layer_id: __, ...fRest } = f
        return fRest
      }))
    } else {
      setData(blank)
      setFields([])
    }
  }, [layer])

  const set = (k: keyof typeof data, v: unknown) => setData(p => ({ ...p, [k]: v }))

  const addField = () => setFields(prev => [...prev, {
    field_name: `field_${Date.now()}`,
    field_label: 'Fusha e re',
    field_type: 'text',
    field_options: null,
    required: false,
    sort_order: prev.length,
  }])

  const updateField = (i: number, key: keyof DraftField, val: unknown) =>
    setFields(prev => prev.map((f, idx) => idx === i ? { ...f, [key]: val } : f))

  const removeField = (i: number) =>
    setFields(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await onSave(data, fields)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-s1 border border-b1 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-b1 shrink-0">
          <h2 className="text-sm font-semibold text-txt flex-1">
            {layer ? 'Edito Shtresën' : 'Shtresë e Re'}
          </h2>
          <button onClick={onClose} className="text-txt3 hover:text-txt">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Basic info */}
            <div>
              <p className="text-[10px] font-mono text-txt3 uppercase tracking-wider mb-3">Informacion Bazë</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-txt2 font-mono mb-1">Emri i shtresës *</label>
                  <input
                    value={data.name}
                    onChange={e => set('name', e.target.value)}
                    required
                    className="w-full bg-bg border border-b1 rounded-lg px-3 py-2 text-sm text-txt outline-none focus:border-acc transition-colors"
                    placeholder="p.sh. Kantiere_Ndertimi"
                  />
                </div>
                <div>
                  <label className="block text-xs text-txt2 font-mono mb-1">Përshkrim</label>
                  <input
                    value={data.description ?? ''}
                    onChange={e => set('description', e.target.value)}
                    className="w-full bg-bg border border-b1 rounded-lg px-3 py-2 text-sm text-txt outline-none focus:border-acc transition-colors"
                    placeholder="Përshkrim opsional"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-txt2 font-mono mb-1">Lloji i gjeometrisë *</label>
                    <select
                      value={data.geom_type}
                      onChange={e => set('geom_type', e.target.value as GeomType)}
                      disabled={!!layer}
                      className="w-full bg-bg border border-b1 rounded-lg px-3 py-2 text-sm text-txt outline-none focus:border-acc disabled:opacity-50"
                    >
                      <option value="Point">Pikë (Point)</option>
                      <option value="LineString">Vijë (Line)</option>
                      <option value="Polygon">Poligon</option>
                    </select>
                    {layer && <p className="text-[10px] text-txt3 mt-1 font-mono">Nuk mund të ndryshohet pas krijimit</p>}
                  </div>

                  <div>
                    <label className="block text-xs text-txt2 font-mono mb-1">Ngjyra</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={data.color}
                        onChange={e => { set('color', e.target.value); set('fill_color', e.target.value) }}
                        className="h-9 w-14 rounded-lg border border-b1 bg-bg cursor-pointer"
                      />
                      <input
                        value={data.color}
                        onChange={e => { set('color', e.target.value); set('fill_color', e.target.value) }}
                        className="flex-1 bg-bg border border-b1 rounded-lg px-2 py-1 text-xs text-txt font-mono outline-none focus:border-acc"
                        placeholder="#e91e8c"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fields */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono text-txt3 uppercase tracking-wider">Fushat e Formës</p>
                <button
                  type="button"
                  onClick={addField}
                  className="text-xs font-mono text-acc hover:text-acc/80 flex items-center gap-1"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Shto Fushë
                </button>
              </div>

              {fields.length === 0 && (
                <p className="text-xs text-txt3 font-mono text-center py-4 bg-s2 rounded-lg border border-b1">
                  Nuk ka fusha. Shto fushat e formës për mbledhjen e të dhënave.
                </p>
              )}

              <div className="space-y-3">
                {fields.map((f, i) => (
                  <div key={i} className="bg-s2 border border-b1 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-txt3 font-mono">Etiketa</label>
                        <input
                          value={f.field_label}
                          onChange={e => updateField(i, 'field_label', e.target.value)}
                          className="w-full bg-bg border border-b1 rounded px-2 py-1 text-xs text-txt outline-none focus:border-acc mt-0.5"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-txt3 font-mono">Emri teknik</label>
                        <input
                          value={f.field_name}
                          onChange={e => updateField(i, 'field_name', e.target.value.replace(/\s/g, '_'))}
                          className="w-full bg-bg border border-b1 rounded px-2 py-1 text-xs text-txt font-mono outline-none focus:border-acc mt-0.5"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeField(i)}
                        className="self-end p-1.5 text-txt3 hover:text-err transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>

                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-[10px] text-txt3 font-mono">Lloji</label>
                        <select
                          value={f.field_type}
                          onChange={e => updateField(i, 'field_type', e.target.value)}
                          className="w-full bg-bg border border-b1 rounded px-2 py-1 text-xs text-txt outline-none focus:border-acc mt-0.5"
                        >
                          {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-txt2 pb-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={f.required}
                          onChange={e => updateField(i, 'required', e.target.checked)}
                          className="accent-acc"
                        />
                        E detyrueshme
                      </label>
                    </div>

                    {f.field_type === 'select' && (
                      <div>
                        <label className="text-[10px] text-txt3 font-mono">Opsionet (ndaj me presje)</label>
                        <input
                          value={(f.field_options ?? []).join(', ')}
                          onChange={e => updateField(i, 'field_options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          className="w-full bg-bg border border-b1 rounded px-2 py-1 text-xs text-txt font-mono outline-none focus:border-acc mt-0.5"
                          placeholder="Opsion 1, Opsion 2, Opsion 3"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex gap-3 px-5 py-4 border-t border-b1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-b2 text-txt2 text-sm font-mono hover:bg-s3 transition-colors"
            >
              Anulo
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-acc text-white font-semibold text-sm hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Duke ruajtur...' : layer ? 'Ruaj Ndryshimet' : 'Krijo Shtresën'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
