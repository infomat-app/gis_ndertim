'use client'
import { useState } from 'react'
import type { Feature, Layer, LayerField } from '@/lib/types'
import SignaturePad from '@/components/ui/SignaturePad'

const AUTO_FILL = new Set(['gps_lat','gps_lng','gps_alt','gps_speed','device_id','device_model','username'])

interface Props {
  feature: Feature
  layer: Layer
  isOwn: boolean
  onClose: () => void
  onSave: (props: Record<string, unknown>) => void
  onDelete: () => void
}

async function readAsDataURL(file: File): Promise<string> {
  return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file) })
}

function displayValue(f: LayerField, raw: unknown): string {
  if (raw == null || raw === '') return '—'
  if (f.field_type === 'boolean') return raw ? 'Po' : 'Jo'
  if (f.field_type === 'multiselect') {
    if (Array.isArray(raw)) return raw.join(', ') || '—'
    try { const a = JSON.parse(String(raw)); return Array.isArray(a) ? a.join(', ') || '—' : String(raw) }
    catch { return String(raw) }
  }
  const s = String(raw)
  if (s.startsWith('data:')) return '[Media]'
  return s.length > 200 ? s.slice(0, 200) + '…' : s || '—'
}

export default function FieldFeaturePopup({ feature, layer, isOwn, onClose, onSave, onDelete }: Props) {
  const fields = layer.fields ?? []
  const [tab, setTab] = useState<'info' | 'edit' | 'geom'>('info')
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => {
      const raw = feature.properties?.[f.field_name]
      if (f.field_type === 'multiselect' && Array.isArray(raw)) return [f.field_name, JSON.stringify(raw)]
      return [f.field_name, String(raw ?? '')]
    }))
  )
  const [saving, setSaving] = useState(false)

  const set = (name: string, val: string) => setValues(p => ({ ...p, [name]: val }))
  const getMulti = (name: string): string[] => { try { return JSON.parse(values[name] || '[]') } catch { return [] } }
  const toggleMulti = (name: string, opt: string) => {
    const cur = getMulti(name)
    set(name, JSON.stringify(cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt]))
  }

  const firstVal = Object.values(feature.properties ?? {}).find(v => {
    const s = String(v ?? '')
    return s.length > 0 && s.length < 120 && !s.startsWith('data:')
  })
  const title = firstVal ? String(firstVal) : `#${feature.id.slice(0, 6)}`
  const [lng, lat] = feature.geometry.coordinates as [number, number]

  const handleSave = async () => {
    setSaving(true)
    const props: Record<string, unknown> = {}
    for (const f of fields) {
      const v = values[f.field_name]
      if (f.field_type === 'number') props[f.field_name] = v ? Number(v) : null
      else if (f.field_type === 'boolean') props[f.field_name] = v === 'true'
      else if (f.field_type === 'multiselect') props[f.field_name] = getMulti(f.field_name)
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

  /* ── Edit field renderer ── */
  const renderEdit = (f: LayerField) => {
    if (f.field_type === 'hidden') return null
    const val = values[f.field_name]

    if (AUTO_FILL.has(f.field_type)) return (
      <div className="flex items-center justify-between bg-bg/50 border border-b1 rounded-lg px-2.5 py-1.5">
        <span className="text-[10px] text-acc2 font-mono">auto</span>
        <span className="text-xs text-txt2 font-mono truncate max-w-[75%] text-right">{val || '—'}</span>
      </div>
    )

    if (f.field_type === 'textarea') return (
      <textarea value={val} onChange={e => set(f.field_name, e.target.value)} rows={2}
        className="w-full bg-s2 border border-b1 rounded-lg px-2.5 py-2 text-xs text-txt outline-none focus:border-acc resize-none" />
    )

    if (f.field_type === 'select') return (
      <select value={val} onChange={e => set(f.field_name, e.target.value)}
        className="w-full bg-s2 border border-b1 rounded-lg px-2.5 py-2 text-xs text-txt outline-none focus:border-acc">
        <option value="">— Zgjidh —</option>
        {(f.field_options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )

    if (f.field_type === 'radio') return (
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
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
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
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
            className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
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
          className="h-8 w-12 rounded-lg border border-b1 bg-s2 cursor-pointer" />
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
            className="flex items-center gap-2 px-3 py-1.5 bg-s3 border border-b1 rounded-lg cursor-pointer hover:bg-s2 transition-colors">
            <span>{cfg.icon}</span>
            <span className="text-xs text-txt2">{val ? 'Ndryshim' : cfg.label}</span>
          </label>
          <input id={`mf-${f.field_name}`} type="file" accept={cfg.accept}
            {...(cfg.capture ? { capture: cfg.capture } : {})}
            className="hidden"
            onChange={async e => { const file = e.target.files?.[0]; if (file) set(f.field_name, await readAsDataURL(file)) }}
          />
          {val && f.field_type === 'photo' && <img src={val} alt="" className="mt-1 w-full max-h-28 object-cover rounded-lg" />}
          {val && f.field_type === 'audio' && <audio src={val} controls className="mt-1 w-full" />}
          {val && f.field_type === 'video' && <video src={val} controls className="mt-1 w-full rounded-lg max-h-28" />}
        </div>
      )
    }

    if (f.field_type === 'signature') return (
      <SignaturePad value={val} onChange={v => set(f.field_name, v)} height={90} />
    )

    if (f.field_type === 'qrcode') return (
      <input value={val} onChange={e => set(f.field_name, e.target.value)}
        placeholder="Skano ose shkruaj"
        className="w-full bg-s2 border border-b1 rounded-lg px-2.5 py-2 text-xs text-txt font-mono outline-none focus:border-acc" />
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
        value={val} onChange={e => set(f.field_name, e.target.value)}
        className="w-full bg-s2 border border-b1 rounded-lg px-2.5 py-2 text-xs text-txt outline-none focus:border-acc"
      />
    )
  }

  /* ── Info field renderer ── */
  const renderInfo = (f: LayerField) => {
    if (f.field_type === 'hidden') return null
    const raw = feature.properties?.[f.field_name]
    const isMedia = ['photo','video','audio','signature'].includes(f.field_type)

    if (isMedia && raw && String(raw).startsWith('data:')) {
      return (
        <div key={f.id} className="py-1.5 border-b border-b1 last:border-0">
          <span className="text-[10px] text-txt3 font-mono uppercase tracking-wide block mb-1">{f.field_label}</span>
          {(f.field_type === 'photo' || f.field_type === 'signature')
            ? <img src={String(raw)} alt="" className="w-full max-h-28 object-cover rounded" />
            : f.field_type === 'audio'
            ? <audio src={String(raw)} controls className="w-full" />
            : <video src={String(raw)} controls className="w-full rounded max-h-28" />
          }
        </div>
      )
    }

    return (
      <div key={f.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-b1 last:border-0">
        <span className="text-[10px] text-txt3 font-mono uppercase tracking-wide shrink-0">{f.field_label}</span>
        <span className="text-[11px] text-txt font-medium text-right break-all max-w-[60%]">{displayValue(f, raw)}</span>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-[1999]" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-[2000] flex flex-col bg-s1 border-t border-b1 rounded-t-xl shadow-2xl"
        style={{ maxHeight: '48vh' }}>

        {/* Handle */}
        <div className="flex justify-center pt-1.5 shrink-0">
          <div className="w-7 h-0.5 rounded-full bg-b2" />
        </div>

        {/* Header */}
        <div className="px-3 pt-1.5 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: layer.color }} />
            <p className="text-xs font-semibold text-txt flex-1 truncate">{title}</p>
            {!isOwn && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-s3 text-txt3 border border-b2 shrink-0">
                {feature.profile?.full_name?.split(' ')[0] ?? 'Tjetër'}
              </span>
            )}
            <button onClick={onClose}
              className="w-6 h-6 rounded-md bg-s3 border border-b2 flex items-center justify-center text-txt3 shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mt-1.5">
            <div className="flex gap-0.5 bg-s2 border border-b1 rounded-md p-0.5 flex-1">
              {allTabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
                  className={`flex-1 py-0.5 rounded text-[11px] font-mono font-medium transition-all ${
                    tab === t.id ? 'bg-acc text-white' : 'text-txt3 hover:text-txt'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            {isOwn && (
              <button onClick={() => { if (confirm('Fshi këtë objekt?')) onDelete() }}
                className="w-7 h-7 rounded-md bg-err/10 border border-err/30 flex items-center justify-center text-err shrink-0"
                title="Fshi">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <div className="px-3 py-1">
              {fields.length === 0 && Object.keys(feature.properties ?? {}).length === 0 && (
                <p className="text-xs text-txt3 font-mono text-center py-3">Nuk ka atribute.</p>
              )}
              {fields.length > 0
                ? fields.filter(f => f.field_type !== 'hidden').sort((a, b) => a.sort_order - b.sort_order).map(f => renderInfo(f))
                : Object.entries(feature.properties ?? {})
                    .filter(([, v]) => { const s = String(v ?? ''); return !s.startsWith('data:') && s.length < 300 })
                    .map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-2 py-1.5 border-b border-b1 last:border-0">
                        <span className="text-[10px] text-txt3 font-mono uppercase tracking-wide shrink-0">{k}</span>
                        <span className="text-[11px] text-txt font-medium text-right break-all max-w-[60%]">{String(v ?? '—')}</span>
                      </div>
                    ))
              }
              {feature.profile && (
                <div className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-[10px] text-txt3 font-mono uppercase tracking-wide">Nga</span>
                  <span className="text-[11px] text-txt2">{feature.profile.full_name ?? feature.profile.email}</span>
                </div>
              )}
            </div>
          )}

          {/* EDIT */}
          {tab === 'edit' && isOwn && (
            <div className="px-3 py-2 space-y-2.5">
              {fields.filter(f => f.field_type !== 'hidden').sort((a, b) => a.sort_order - b.sort_order).map(f => (
                <div key={f.id}>
                  <label className="block text-[10px] font-mono text-txt3 uppercase tracking-wide mb-1">
                    {f.field_label}{f.required && <span className="text-err ml-1">*</span>}
                  </label>
                  {renderEdit(f)}
                </div>
              ))}
            </div>
          )}

          {/* GPS */}
          {tab === 'geom' && (
            <div className="px-3 py-1">
              {[
                { label: 'Lat', value: lat.toFixed(6) },
                { label: 'Lng', value: lng.toFixed(6) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2 py-1.5 border-b border-b1 last:border-0">
                  <span className="text-[10px] text-txt3 font-mono uppercase tracking-wide">{label}</span>
                  <span className="text-[11px] text-txt2 font-mono">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save footer */}
        {tab === 'edit' && isOwn && fields.length > 0 && (
          <div className="shrink-0 px-3 py-2 border-t border-b1 flex gap-2">
            <button onClick={() => setTab('info')}
              className="px-3 py-2 rounded-lg border border-b2 text-txt2 text-xs font-mono hover:bg-s3 transition-colors">
              Anulo
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 rounded-lg bg-acc text-white font-semibold text-xs disabled:opacity-50 active:scale-[.98] transition-all">
              {saving ? 'Duke ruajtur...' : 'Ruaj'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
