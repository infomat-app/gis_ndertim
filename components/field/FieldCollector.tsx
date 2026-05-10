'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import type { Profile, Layer, Feature } from '@/lib/types'
import Navbar from '@/components/ui/Navbar'
import FieldFeaturePopup from './FieldFeaturePopup'

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
  const [myLocation,      setMyLocation]    = useState<[number, number] | null>(null)
  const [locateTrigger,   setLocateTrigger] = useState(0)
  const [locating,        setLocating]      = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)

  const handleLocated = useCallback((pos: [number, number]) => {
    setMyLocation(pos)
    setLocating(false)
  }, [])

  // Load all features for the layer (with profile info)
  useEffect(() => {
    if (!activeLayer) return
    supabase
      .from('features')
      .select('*, profile:profiles(full_name,email)')
      .eq('layer_id', activeLayer.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const all = data ?? []
        setFeatures(all)
        setRecentItems(all.filter(f => f.created_by === profile.id).slice(0, 10))
      })
  }, [activeLayer, supabase, profile.id])

  const handleFeatureUpdate = async (feature: Feature, properties: Record<string, unknown>) => {
    const { data } = await supabase
      .from('features')
      .update({ properties })
      .eq('id', feature.id)
      .select('*, profile:profiles(full_name,email)')
      .single()
    if (data) {
      setFeatures(prev => prev.map(f => f.id === data.id ? data : f))
      setRecentItems(prev => prev.map(f => f.id === data.id ? data : f))
      setSelectedFeature(data)
    }
  }

  const handleFeatureDelete = async (feature: Feature) => {
    await supabase.from('features').delete().eq('id', feature.id)
    setFeatures(prev => prev.filter(f => f.id !== feature.id))
    setRecentItems(prev => prev.filter(f => f.id !== feature.id))
    setSelectedFeature(null)
  }

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
    if (selectedFeature) { setSelectedFeature(null); return }
    setPendingCoords([lat, lng])
    setStep('form')
  }, [selectedFeature])

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

      {/* MAP + FORM — harta qëndron gjithmonë kur activeLayer është zgjedhur */}
      {activeLayer && step !== 'select' && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Harta — flex-1 në map/done, e ngushtë në form */}
          <div className={`relative shrink-0 ${step === 'form' ? 'h-[42%]' : 'flex-1'}`}>
            <FieldMap
              layer={activeLayer}
              features={features}
              pendingCoords={pendingCoords}
              gpsCoords={gpsCoords}
              gpsRequest={gpsRequest}
              myLocation={myLocation}
              locateTrigger={locateTrigger}
              selectedFeatureId={selectedFeature?.id}
              onMapClick={handleMapClick}
              onGPSCapture={handleGPSCapture}
              onLocated={handleLocated}
              onFeatureClick={f => { setSelectedFeature(f); setStep('map') }}
            />
            {step === 'done' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-acc/95 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-2xl">
                  ✓ U ruajt me sukses!
                </div>
              </div>
            )}
          </div>

          {/* Toolbar GPS — vetëm gjatë hartimit */}
          {(step === 'map' || step === 'done') && (
            <div className="bg-s1 border-t border-b1 px-3 py-2.5 safe-area-bottom shrink-0">
              <div className="flex items-center gap-2 max-w-sm mx-auto">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: activeLayer.color }} />
                  <span className="text-xs font-mono font-semibold text-txt truncate">{activeLayer.name}</span>
                </div>
                <button
                  onClick={() => { setStep('select'); setActiveLayer(null); setGpsCoords(null); setMyLocation(null) }}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-s3 border border-b2 text-txt2 text-xs font-mono active:scale-95 transition-transform shrink-0"
                  title="Ndalo"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <span className="hidden sm:inline">Ndalo</span>
                </button>
                <button
                  onClick={() => setGpsRequest(n => n + 1)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-acc2/20 border border-acc2/40 text-acc2 text-xs font-mono active:scale-95 transition-transform shrink-0"
                  title="GPS"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>
                  GPS
                </button>
                <button
                  onClick={() => { setLocating(true); setLocateTrigger(n => n + 1) }}
                  disabled={locating}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono active:scale-95 transition-transform disabled:opacity-60 shrink-0 ${
                    myLocation
                      ? 'bg-blue-600/20 border border-blue-500/40 text-blue-600'
                      : 'bg-s3 border border-b2 text-txt2'
                  }`}
                  title="Vendodhja ime"
                >
                  {locating
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="8" strokeOpacity=".5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round"/></svg>
                  }
                  <span className="hidden sm:inline">{locating ? '...' : 'Vendodhja'}</span>
                </button>
              </div>
              <p className="text-center text-[11px] text-txt3 font-mono mt-1.5">Klikoni në hartë ose përdorni GPS</p>
            </div>
          )}

          {/* Forma — poshtë hartës */}
          {step === 'form' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-bg">

          {/* Header strip */}
          <div className="px-4 py-3 bg-s1 border-b border-b1 flex items-center gap-3 shrink-0">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: activeLayer.color }} />
            <span className="font-semibold text-txt text-sm flex-1 truncate">{activeLayer.name}</span>
            {pendingCoords && (
              <span className="text-[11px] font-mono text-txt3 shrink-0">
                {pendingCoords[0].toFixed(4)}, {pendingCoords[1].toFixed(4)}
              </span>
            )}
          </div>

          {/* Scrollable fields */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-sm mx-auto px-4 py-4 space-y-3">
              {fields.length === 0 && (
                <p className="text-xs text-txt3 font-mono text-center py-6">
                  Kjo shtresë nuk ka fusha të konfiguruara.
                </p>
              )}

              {fields.sort((a, b) => a.sort_order - b.sort_order).map(f => (
                <div key={f.id}>
                  <label className="block text-xs font-semibold text-txt2 uppercase tracking-wide mb-1.5">
                    {f.field_label}
                    {f.required && <span className="text-err ml-1">*</span>}
                  </label>

                  {f.field_type === 'textarea' ? (
                    <textarea
                      value={formValues[f.field_name] ?? ''}
                      onChange={e => setFormValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      required={f.required}
                      rows={3}
                      className="w-full bg-s1 border border-b1 rounded-xl px-3 py-2.5 text-sm text-txt outline-none focus:border-acc focus:ring-2 focus:ring-acc/20 transition-all resize-none"
                      placeholder={f.field_label}
                    />
                  ) : f.field_type === 'select' ? (
                    <select
                      value={formValues[f.field_name] ?? ''}
                      onChange={e => setFormValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      required={f.required}
                      className="w-full bg-s1 border border-b1 rounded-xl px-3 py-2.5 text-sm text-txt outline-none focus:border-acc focus:ring-2 focus:ring-acc/20 transition-all"
                    >
                      <option value="">— Zgjidh —</option>
                      {(f.field_options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.field_type === 'boolean' ? (
                    <div className="flex gap-2">
                      {['true', 'false'].map(val => {
                        const active = formValues[f.field_name] === val
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setFormValues(p => ({ ...p, [f.field_name]: val }))}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-95 ${
                              active
                                ? val === 'true'
                                  ? 'bg-green-500 text-white border-green-500'
                                  : 'bg-red-500 text-white border-red-500'
                                : 'bg-s1 border-b1 text-txt3 hover:border-b2'
                            }`}
                          >
                            {val === 'true'
                              ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Po</>
                              : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Jo</>
                            }
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <input
                      type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                      value={formValues[f.field_name] ?? ''}
                      onChange={e => setFormValues(p => ({ ...p, [f.field_name]: e.target.value }))}
                      required={f.required}
                      placeholder={f.field_label}
                      className="w-full bg-s1 border border-b1 rounded-xl px-3 py-2.5 text-sm text-txt outline-none focus:border-acc focus:ring-2 focus:ring-acc/20 transition-all"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer: action buttons */}
          <div className="shrink-0 px-4 py-3 bg-s1 border-t border-b1">
            <div className="max-w-sm mx-auto flex gap-2">
              <button
                onClick={() => { setPendingCoords(null); setStep('map') }}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-b2 text-txt2 text-sm font-medium active:scale-95 transition-transform shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                Prapa
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-acc text-white font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                {saving ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                )}
                {saving ? 'Duke ruajtur...' : 'Ruaj Pikën'}
              </button>
            </div>

            {/* Recent items */}
            {recentItems.length > 0 && (
              <div className="max-w-sm mx-auto mt-3 pt-3 border-t border-b1">
                <p className="text-[10px] text-txt3 font-mono uppercase tracking-widest mb-2">
                  Të regjistruara ({recentItems.length})
                </p>
                <div className="space-y-1">
                  {recentItems.slice(0, 4).map(item => {
                    const firstVal = Object.values(item.properties ?? {})[0]
                    return (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: activeLayer.color }} />
                        <span className="text-xs text-txt flex-1 truncate">
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
      )}

      {/* Feature popup */}
      {selectedFeature && activeLayer && (
        <FieldFeaturePopup
          feature={selectedFeature}
          layer={activeLayer}
          isOwn={selectedFeature.created_by === profile.id}
          onClose={() => setSelectedFeature(null)}
          onSave={props => handleFeatureUpdate(selectedFeature, props)}
          onDelete={() => handleFeatureDelete(selectedFeature)}
        />
      )}
    </div>
  )
}
