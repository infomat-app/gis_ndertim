'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import type { Profile, Layer, Feature, LayerField } from '@/lib/types'
import Navbar from '@/components/ui/Navbar'

const FieldMap = dynamic(() => import('./FieldMap'), { ssr: false })

type Step = 'select' | 'map' | 'form' | 'done'

interface Props {
  profile: Profile
  layers: Layer[]
}

export default function FieldCollector({ profile, layers }: Props) {
  const supabase = createClient()

  const [step,           setStep]         = useState<Step>('select')
  const [activeLayer,    setActiveLayer]  = useState<Layer | null>(null)
  const [pendingCoords,  setPendingCoords] = useState<[number, number] | null>(null)
  const [gpsRequest,     setGpsRequest]   = useState(0)
  const [gpsCoords,      setGpsCoords]    = useState<[number, number] | null>(null)
  const [features,       setFeatures]     = useState<Feature[]>([])
  const [formValues,     setFormValues]   = useState<Record<string, string>>({})
  const [saving,         setSaving]       = useState(false)
  const [recentItems,    setRecentItems]  = useState<Feature[]>([])

  // Load recent features for this user
  useEffect(() => {
    if (!activeLayer) return
    supabase
      .from('features')
      .select('*')
      .eq('layer_id', activeLayer.id)
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setRecentItems(data ?? []))
  }, [activeLayer, supabase, profile.id])

  const initForm = (layer: Layer) => {
    const init: Record<string, string> = {}
    for (const f of layer.fields ?? []) init[f.field_name] = ''
    setFormValues(init)
  }

  const selectLayer = (layer: Layer) => {
    setActiveLayer(layer)
    initForm(layer)
    setStep('map')
  }

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPendingCoords([lat, lng])
    setStep('form')
  }, [])

  const handleGPSCapture = useCallback((lat: number, lng: number) => {
    setGpsCoords([lat, lng])
    setPendingCoords([lat, lng])
    setStep('form')
  }, [])

  const handleSave = async () => {
    if (!pendingCoords || !activeLayer) return
    setSaving(true)

    const props: Record<string, unknown> = {}
    for (const f of activeLayer.fields ?? []) {
      const v = formValues[f.field_name]
      if (!v && f.required) { setSaving(false); return }
      if (f.field_type === 'number') props[f.field_name] = v ? Number(v) : null
      else if (f.field_type === 'boolean') props[f.field_name] = v === 'true'
      else props[f.field_name] = v || null
    }

    const [lat, lng] = pendingCoords
    const { data, error } = await supabase.from('features').insert({
      layer_id: activeLayer.id,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: props,
      created_by: profile.id,
    }).select().single()

    if (!error && data) {
      setFeatures(prev => [data, ...prev])
      setRecentItems(prev => [data, ...prev].slice(0, 10))
    }

    setSaving(false)
    setPendingCoords(null)
    initForm(activeLayer)
    setStep('done')
    setTimeout(() => setStep('map'), 2000)
  }

  const fields = activeLayer?.fields ?? []

  return (
    <div className="flex flex-col h-screen bg-bg">
      <Navbar profile={profile} />

      {/* Step: SELECT LAYER */}
      {step === 'select' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-sm mx-auto pt-4">
            <h2 className="text-base font-semibold text-txt mb-1">Zgjidh Shtresën</h2>
            <p className="text-xs text-txt3 font-mono mb-5">Ku do të regjistrohen të dhënat?</p>

            {layers.length === 0 ? (
              <div className="text-center py-10 text-txt3 font-mono text-xs">
                Nuk ka shtresa të konfiguruara.<br/>Kontakto administratorin.
              </div>
            ) : (
              <div className="space-y-2">
                {layers.map(layer => (
                  <button
                    key={layer.id}
                    onClick={() => selectLayer(layer)}
                    className="w-full flex items-center gap-4 p-4 bg-s1 border border-b1 rounded-2xl hover:border-b2 active:scale-[.98] transition-all text-left"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: layer.color + '22', border: `1.5px solid ${layer.color}55` }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={layer.color} strokeWidth="2">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                        <circle cx="12" cy="9" r="2.5"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-txt text-sm">{layer.name}</p>
                      <p className="text-xs text-txt3 font-mono mt-0.5">
                        {(layer.fields ?? []).length} fusha · {layer.description ?? 'Pikë gjeografike'}
                      </p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3d5275" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step: MAP */}
      {(step === 'map' || step === 'done') && activeLayer && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Map takes most of the screen */}
          <div className="flex-1 relative">
            <FieldMap
              layer={activeLayer}
              features={features}
              pendingCoords={pendingCoords}
              gpsCoords={gpsCoords}
              gpsRequest={gpsRequest}
              onMapClick={handleMapClick}
              onGPSCapture={handleGPSCapture}
            />

            {/* Success flash */}
            {step === 'done' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-acc/95 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-2xl">
                  ✓ U ruajt me sukses!
                </div>
              </div>
            )}
          </div>

          {/* Bottom toolbar */}
          <div className="bg-s1 border-t border-b1 px-4 py-3 safe-area-bottom">
            <div className="flex items-center gap-3 max-w-sm mx-auto">
              {/* Layer name */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: activeLayer.color }} />
                <span className="text-xs font-mono font-semibold text-txt truncate">{activeLayer.name}</span>
              </div>

              {/* GPS button */}
              <button
                onClick={() => setGpsRequest(n => n + 1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-acc2/20 border border-acc2/40 text-acc2 text-sm font-mono active:scale-95 transition-transform"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
                </svg>
                GPS
              </button>

              {/* Change layer */}
              <button
                onClick={() => { setStep('select'); setActiveLayer(null); setGpsCoords(null) }}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-s3 border border-b2 text-txt2 text-xs font-mono active:scale-95 transition-transform"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Ndalo
              </button>
            </div>

            <p className="text-center text-xs text-txt3 font-mono mt-2">
              Klikoni në hartë ose përdorni GPS
            </p>
          </div>
        </div>
      )}

      {/* Step: FORM */}
      {step === 'form' && activeLayer && (
        <div className="flex-1 overflow-auto bg-bg">
          <div className="max-w-sm mx-auto p-4 pt-2">
            {/* Location summary */}
            {pendingCoords && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-acc2/10 border border-acc2/30 rounded-xl">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d8bff" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
                </svg>
                <span className="text-xs font-mono text-acc2">
                  {pendingCoords[0].toFixed(5)}, {pendingCoords[1].toFixed(5)}
                </span>
              </div>
            )}

            <h2 className="text-base font-semibold text-txt mb-1">Detajet e Objektit</h2>
            <p className="text-xs text-txt3 font-mono mb-5">{activeLayer.name}</p>

            <div className="space-y-4">
              {fields.length === 0 && (
                <p className="text-xs text-txt3 font-mono text-center py-4 bg-s1 rounded-xl border border-b1">
                  Kjo shtresë nuk ka fusha.
                </p>
              )}

              {fields.sort((a, b) => a.sort_order - b.sort_order).map(f => (
                <div key={f.id}>
                  <label className="block text-sm font-medium text-txt mb-1.5">
                    {f.field_label}
                    {f.required && <span className="text-err ml-1">*</span>}
                  </label>

                  {f.field_type === 'textarea' ? (
                    <textarea
                      value={formValues[f.field_name] ?? ''}
                      onChange={e => setFormValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      required={f.required}
                      rows={4}
                      className="w-full bg-s1 border border-b1 rounded-xl px-4 py-3 text-sm text-txt outline-none focus:border-acc transition-colors resize-none"
                      placeholder={f.field_label}
                    />
                  ) : f.field_type === 'select' ? (
                    <select
                      value={formValues[f.field_name] ?? ''}
                      onChange={e => setFormValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      required={f.required}
                      className="w-full bg-s1 border border-b1 rounded-xl px-4 py-3 text-sm text-txt outline-none focus:border-acc transition-colors"
                    >
                      <option value="">— Zgjidh —</option>
                      {(f.field_options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.field_type === 'boolean' ? (
                    <div className="flex gap-3">
                      {['true','false'].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormValues(p => ({ ...p, [f.field_name]: val }))}
                          className={`flex-1 py-3 rounded-xl border text-sm font-mono transition-all ${
                            formValues[f.field_name] === val
                              ? 'bg-acc text-white border-acc font-semibold'
                              : 'bg-s1 border-b1 text-txt2 hover:border-b2'
                          }`}
                        >
                          {val === 'true' ? 'Po ✓' : 'Jo ✕'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                      value={formValues[f.field_name] ?? ''}
                      onChange={e => setFormValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      required={f.required}
                      placeholder={f.field_label}
                      className="w-full bg-s1 border border-b1 rounded-xl px-4 py-3 text-sm text-txt outline-none focus:border-acc transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 rounded-2xl bg-acc text-white font-bold text-base active:scale-95 transition-transform disabled:opacity-50"
              >
                {saving ? 'Duke ruajtur...' : '✓ Ruaj Pikën'}
              </button>
              <button
                onClick={() => { setPendingCoords(null); setStep('map') }}
                className="w-full py-3 rounded-2xl border border-b2 text-txt2 text-sm font-mono active:scale-95 transition-transform"
              >
                ← Kthehu te harta
              </button>
            </div>

            {/* Recent items */}
            {recentItems.length > 0 && (
              <div className="mt-6">
                <p className="text-xs text-txt3 font-mono uppercase tracking-wider mb-3">
                  Të regjistruarat sot ({recentItems.length})
                </p>
                <div className="space-y-2">
                  {recentItems.slice(0, 5).map(item => {
                    const firstVal = Object.values(item.properties ?? {})[0]
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-3 py-2 bg-s1 border border-b1 rounded-xl">
                        <span className="w-2 h-2 rounded-full bg-acc shrink-0" />
                        <span className="text-xs text-txt flex-1 truncate font-mono">
                          {firstVal ? String(firstVal) : item.id.slice(0, 8)}
                        </span>
                        <span className="text-[10px] text-txt3 font-mono shrink-0">
                          {new Date(item.created_at).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
