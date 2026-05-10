'use client'
import { useState, useEffect } from 'react'
import type { Layer, GeomType, LayerField, Profile } from '@/lib/types'
import SignaturePad from '@/components/ui/SignaturePad'

const AUTO_FILL = new Set(['gps_lat','gps_lng','gps_alt','gps_speed','device_id','device_model','username'])

async function readAsDataURL(file: File): Promise<string> {
  return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file) })
}

interface Props {
  layer: Layer
  geomType: GeomType
  profile?: Profile | null
  onSubmit: (properties: Record<string, unknown>) => void
  onCancel: () => void
}

export default function FeatureForm({ layer, geomType, profile, onSubmit, onCancel }: Props) {
  const fields = layer.fields ?? []
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(f => [f.field_name, f.field_type === 'multiselect' ? '[]' : '']))
  )
  const [loading, setLoading] = useState(false)

  const set = (name: string, val: string) => setValues(p => ({ ...p, [name]: val }))
  const getMulti = (name: string): string[] => { try { return JSON.parse(values[name] || '[]') } catch { return [] } }
  const toggleMulti = (name: string, opt: string) => {
    const cur = getMulti(name)
    set(name, JSON.stringify(cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt]))
  }

  // Auto-fill device / GPS fields on mount
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const f of fields) {
      if (f.field_type === 'username' && profile) {
        next[f.field_name] = profile.full_name ?? profile.email ?? ''
      } else if (f.field_type === 'device_id') {
        let id = localStorage.getItem('gis_device_id')
        if (!id) {
          id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
          localStorage.setItem('gis_device_id', id)
        }
        next[f.field_name] = id
      } else if (f.field_type === 'device_model') {
        next[f.field_name] = navigator.userAgent.substring(0, 200)
      }
    }
    if (Object.keys(next).length) setValues(p => ({ ...p, ...next }))

    const gpsFs = fields.filter(f => ['gps_lat','gps_lng','gps_alt','gps_speed'].includes(f.field_type))
    if (gpsFs.length && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setValues(p => {
          const n = { ...p }
          for (const f of gpsFs) {
            if (f.field_type === 'gps_lat') n[f.field_name] = pos.coords.latitude.toFixed(7)
            else if (f.field_type === 'gps_lng') n[f.field_name] = pos.coords.longitude.toFixed(7)
            else if (f.field_type === 'gps_alt' && pos.coords.altitude != null) n[f.field_name] = pos.coords.altitude.toFixed(1)
            else if (f.field_type === 'gps_speed' && pos.coords.speed != null) n[f.field_name] = pos.coords.speed.toFixed(2)
          }
          return n
        })
      }, undefined, { enableHighAccuracy: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    const props: Record<string, unknown> = {}
    for (const f of fields) {
      if (f.field_type === 'hidden') continue
      const v = values[f.field_name]
      if (!v && f.required && f.field_type !== 'multiselect' && !AUTO_FILL.has(f.field_type)) { setLoading(false); return }
      if (f.field_type === 'number') props[f.field_name] = v ? Number(v) : null
      else if (f.field_type === 'boolean') props[f.field_name] = v === 'true'
      else if (f.field_type === 'multiselect') props[f.field_name] = getMulti(f.field_name)
      else props[f.field_name] = v || null
    }
    await onSubmit(props)
    setLoading(false)
  }

  const renderField = (f: LayerField) => {
    if (f.field_type === 'hidden') return null
    const val = values[f.field_name]

    if (AUTO_FILL.has(f.field_type)) return (
      <div className="flex items-center justify-between bg-bg/50 border border-b1 rounded-lg px-2.5 py-1.5">
        <span className="text-[10px] text-acc2 font-mono">auto</span>
        <span className="text-xs text-txt2 font-mono truncate max-w-[75%] text-right">{val || '—'}</span>
      </div>
    )

    if (f.field_type === 'textarea') return (
      <textarea value={val} onChange={e => set(f.field_name, e.target.value)} required={f.required} rows={2}
        className="w-full bg-bg border border-b1 rounded-lg px-2.5 py-1.5 text-xs text-txt outline-none focus:border-acc resize-none transition-colors" />
    )

    if (f.field_type === 'select') return (
      <select value={val} onChange={e => set(f.field_name, e.target.value)} required={f.required}
        className="w-full bg-bg border border-b1 rounded-lg px-2.5 py-1.5 text-xs text-txt outline-none focus:border-acc transition-colors">
        <option value="">— Zgjidh —</option>
        {(f.field_options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )

    if (f.field_type === 'radio') return (
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-0.5">
        {(f.field_options ?? []).map(o => (
          <label key={o} className="flex items-center gap-1.5 text-xs text-txt cursor-pointer">
            <input type="radio" name={`r-${f.field_name}`} value={o} checked={val === o}
              onChange={() => set(f.field_name, o)} className="accent-acc" />
            {o}
          </label>
        ))}
      </div>
    )

    if (f.field_type === 'multiselect') return (
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-0.5">
        {(f.field_options ?? []).map(o => {
          const sel = getMulti(f.field_name)
          return (
            <label key={o} className="flex items-center gap-1.5 text-xs text-txt cursor-pointer">
              <input type="checkbox" checked={sel.includes(o)} onChange={() => toggleMulti(f.field_name, o)} className="accent-acc" />
              {o}
            </label>
          )
        })}
      </div>
    )

    if (f.field_type === 'boolean') return (
      <div className="flex gap-1.5">
        {(['true','false'] as const).map(v => (
          <button key={v} type="button" onClick={() => set(f.field_name, v)}
            className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              val === v ? (v === 'true' ? 'bg-green-600 text-white border-green-600' : 'bg-err text-white border-err') : 'bg-s2 border-b1 text-txt3'
            }`}>
            {v === 'true' ? 'Po' : 'Jo'}
          </button>
        ))}
      </div>
    )

    if (f.field_type === 'color') return (
      <div className="flex gap-2 items-center">
        <input type="color" value={val || '#000000'} onChange={e => set(f.field_name, e.target.value)}
          className="h-8 w-12 rounded-lg border border-b1 bg-bg cursor-pointer" />
        <span className="text-xs text-txt2 font-mono">{val}</span>
      </div>
    )

    if (f.field_type === 'photo' || f.field_type === 'video' || f.field_type === 'audio') {
      const cfg = {
        photo: { icon: '📷', accept: 'image/*', label: 'Kap / Zgjidh foto', capture: 'environment' as const },
        video: { icon: '🎬', accept: 'video/*', label: 'Kap / Zgjidh video', capture: 'environment' as const },
        audio: { icon: '🎙️', accept: 'audio/*', label: 'Regjistro audio', capture: undefined },
      }[f.field_type]
      return (
        <div>
          <label htmlFor={`mf-${f.field_name}`}
            className="flex items-center gap-2 px-3 py-2 bg-s2 border border-b1 rounded-lg cursor-pointer hover:bg-s3 transition-colors">
            <span>{cfg.icon}</span>
            <span className="text-xs text-txt2">{val ? 'Ndryshim' : cfg.label}</span>
          </label>
          <input id={`mf-${f.field_name}`} type="file" accept={cfg.accept}
            {...(cfg.capture ? { capture: cfg.capture } : {})}
            className="hidden"
            onChange={async e => { const file = e.target.files?.[0]; if (file) set(f.field_name, await readAsDataURL(file)) }}
          />
          {val && f.field_type === 'photo' && <img src={val} alt="" className="mt-1.5 w-full max-h-32 object-cover rounded-lg" />}
          {val && f.field_type === 'audio' && <audio src={val} controls className="mt-1.5 w-full" />}
          {val && f.field_type === 'video' && <video src={val} controls className="mt-1.5 w-full rounded-lg max-h-32" />}
        </div>
      )
    }

    if (f.field_type === 'signature') return (
      <SignaturePad value={val} onChange={v => set(f.field_name, v)} />
    )

    if (f.field_type === 'qrcode') return (
      <input value={val} onChange={e => set(f.field_name, e.target.value)} required={f.required}
        placeholder="Skano ose shkruaj"
        className="w-full bg-bg border border-b1 rounded-lg px-2.5 py-1.5 text-xs text-txt font-mono outline-none focus:border-acc transition-colors" />
    )

    if (f.field_type === 'formula' || f.field_type === 'counter') return (
      <div className="flex items-center justify-between bg-bg/50 border border-dashed border-b2 rounded-lg px-2.5 py-1.5">
        <span className="text-[10px] text-txt3 font-mono">{f.field_type}</span>
        <span className="text-xs text-txt2 font-mono">{val || '—'}</span>
      </div>
    )

    return (
      <input
        type={
          f.field_type === 'number'   ? 'number' :
          f.field_type === 'date'     ? 'date' :
          f.field_type === 'time'     ? 'time' :
          f.field_type === 'datetime' ? 'datetime-local' : 'text'
        }
        value={val} onChange={e => set(f.field_name, e.target.value)} required={f.required}
        className="w-full bg-bg border border-b1 rounded-lg px-2.5 py-1.5 text-xs text-txt outline-none focus:border-acc transition-colors"
      />
    )
  }

  const geomLabel = geomType === 'Point' ? '● Pikë' : geomType === 'LineString' ? '— Vijë' : '▬ Poligon'
  const visible = fields.filter(f => f.field_type !== 'hidden').sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-end p-3 pt-14 pointer-events-none">
      <div className="pointer-events-auto w-72 flex flex-col bg-s1 border border-b1 rounded-xl shadow-2xl"
        style={{ maxHeight: 'calc(100vh - 80px)' }}>

        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-b1 shrink-0">
          <span className="text-xs shrink-0" style={{ color: layer.color }}>{geomLabel}</span>
          <p className="text-xs font-semibold text-txt truncate font-mono flex-1">{layer.name}</p>
          <button onClick={onCancel} className="text-txt3 hover:text-txt shrink-0 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {visible.length === 0 && (
            <p className="text-xs text-txt3 font-mono text-center py-3">Nuk ka fusha. Ruaj objektin direkt.</p>
          )}
          {visible.map(f => (
            <div key={f.id}>
              <label className="block text-[10px] text-txt3 font-mono mb-0.5 uppercase tracking-wide">
                {f.field_label}{f.required && <span className="text-err ml-0.5">*</span>}
              </label>
              {renderField(f)}
            </div>
          ))}
        </div>

        <div className="flex gap-2 px-3 py-2.5 border-t border-b1 shrink-0">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-b2 text-txt2 text-xs font-mono hover:bg-s3 transition-colors">
            Anulo
          </button>
          <button
            onClick={visible.length === 0 ? () => onSubmit({}) : (e) => handleSubmit(e as React.FormEvent)}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-acc text-white font-semibold text-xs hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors">
            {loading ? 'Duke ruajtur...' : 'Ruaj'}
          </button>
        </div>
      </div>
    </div>
  )
}
