'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import type { Layer, Feature, Profile, GeoJSONGeometry } from '@/lib/types'
import Navbar from '@/components/ui/Navbar'
import LayerPanel from './LayerPanel'
import DrawToolbar from './DrawToolbar'
import FeatureForm from './FeatureForm'
import FeatureDetail from './FeatureDetail'
import LayerEditorModal from './LayerEditorModal'
import ImportModal, { type GeoJSONFeature } from './ImportModal'

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-s2">
      <div className="text-txt2 font-mono text-sm">Duke ngarkuar hartën...</div>
    </div>
  ),
})

interface Props {
  profile: Profile
  initialLayers: Layer[]
}

export default function MapPage({ profile, initialLayers }: Props) {
  const supabase  = createClient()
  const canEdit   = ['admin','editor'].includes(profile.role)
  const isAdmin   = profile.role === 'admin'

  const [layers,          setLayers]         = useState<Layer[]>(initialLayers)
  const [features,        setFeatures]       = useState<Record<string, Feature[]>>({})
  const [activeLayer,     setActiveLayer]    = useState<Layer | null>(null)
  const [drawingCoords,   setDrawingCoords]  = useState<[number, number][]>([])
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [pendingGeom,     setPendingGeom]    = useState<GeoJSONGeometry | null>(null)
  const [showFeatureForm, setShowFeatureForm] = useState(false)
  const [showLayerEditor, setShowLayerEditor] = useState(false)
  const [editingLayer,    setEditingLayer]   = useState<Layer | null>(null)
  const [showImport,      setShowImport]     = useState(false)
  const [sidebarOpen,     setSidebarOpen]    = useState(true)
  const [gpsRequest,      setGpsRequest]     = useState(0)

  // Load features for visible layers
  useEffect(() => {
    const ids = layers.filter(l => l.visible).map(l => l.id)
    if (!ids.length) return
    supabase
      .from('features')
      .select('*, profile:profiles(full_name,email)')
      .in('layer_id', ids)
      .then(({ data }) => {
        if (!data) return
        const grouped = data.reduce((acc, f) => {
          acc[f.layer_id] = [...(acc[f.layer_id] ?? []), f]
          return acc
        }, {} as Record<string, Feature[]>)
        setFeatures(grouped)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.map(l => `${l.id}:${l.visible}`).join(',')])

  // -------- Map event handlers --------
  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!activeLayer || !canEdit) return
    if (activeLayer.geom_type === 'Point') {
      setPendingGeom({ type: 'Point', coordinates: [lng, lat] })
      setShowFeatureForm(true)
    } else {
      setDrawingCoords(prev => [...prev, [lat, lng]])
    }
  }, [activeLayer, canEdit])

  const handleMapDblClick = useCallback(() => {
    if (!activeLayer || !canEdit) return
    if (activeLayer.geom_type === 'LineString' && drawingCoords.length >= 2) {
      const coords = drawingCoords.map(([la, ln]) => [ln, la])
      setPendingGeom({ type: 'LineString', coordinates: coords })
      setDrawingCoords([])
      setShowFeatureForm(true)
    } else if (activeLayer.geom_type === 'Polygon' && drawingCoords.length >= 3) {
      const ring = [...drawingCoords.map(([la, ln]) => [ln, la])]
      ring.push(ring[0])
      setPendingGeom({ type: 'Polygon', coordinates: [ring] })
      setDrawingCoords([])
      setShowFeatureForm(true)
    }
  }, [activeLayer, canEdit, drawingCoords])

  const handleGPSCapture = useCallback((lat: number, lng: number) => {
    if (!activeLayer || !canEdit) return
    if (activeLayer.geom_type === 'Point') {
      setPendingGeom({ type: 'Point', coordinates: [lng, lat] })
      setShowFeatureForm(true)
    }
  }, [activeLayer, canEdit])

  // -------- Feature CRUD --------
  const handleFeatureSubmit = async (properties: Record<string, unknown>) => {
    if (!pendingGeom || !activeLayer) return
    const { data, error } = await supabase
      .from('features')
      .insert({ layer_id: activeLayer.id, geometry: pendingGeom, properties, created_by: profile.id })
      .select('*, profile:profiles(full_name,email)')
      .single()
    if (!error && data) {
      setFeatures(prev => ({ ...prev, [activeLayer.id]: [...(prev[activeLayer.id] ?? []), data] }))
    }
    setPendingGeom(null)
    setShowFeatureForm(false)
  }

  const handleFeatureDelete = async (feature: Feature) => {
    await supabase.from('features').delete().eq('id', feature.id)
    setFeatures(prev => ({
      ...prev,
      [feature.layer_id]: (prev[feature.layer_id] ?? []).filter(f => f.id !== feature.id),
    }))
    setSelectedFeature(null)
  }

  const handleFeatureUpdate = async (feature: Feature, properties: Record<string, unknown>) => {
    const { data } = await supabase
      .from('features')
      .update({ properties })
      .eq('id', feature.id)
      .select('*, profile:profiles(full_name,email)')
      .single()
    if (data) {
      setFeatures(prev => ({
        ...prev,
        [feature.layer_id]: (prev[feature.layer_id] ?? []).map(f => f.id === feature.id ? data : f),
      }))
      setSelectedFeature(data)
    }
  }

  // -------- Layer CRUD --------
  const handleLayerSave = async (layerData: Omit<Layer, 'id'|'created_at'|'updated_at'>, fields: object[]) => {
    if (editingLayer) {
      const { data } = await supabase
        .from('layers').update(layerData).eq('id', editingLayer.id).select().single()
      if (data) {
        // replace fields
        await supabase.from('layer_fields').delete().eq('layer_id', editingLayer.id)
        if (fields.length) await supabase.from('layer_fields').insert(fields.map((f,i) => ({ ...f, layer_id: editingLayer.id, sort_order: i })))
        setLayers(prev => prev.map(l => l.id === editingLayer.id ? { ...data, fields: data.fields ?? [] } : l))
      }
    } else {
      const { data } = await supabase
        .from('layers').insert({ ...layerData, created_by: profile.id }).select().single()
      if (data) {
        if (fields.length) await supabase.from('layer_fields').insert(fields.map((f,i) => ({ ...f, layer_id: data.id, sort_order: i })))
        setLayers(prev => [...prev, { ...data, fields: [] }])
      }
    }
    setShowLayerEditor(false)
    setEditingLayer(null)
    // reload layers with fields
    const { data: fresh } = await supabase
      .from('layers').select('*, fields:layer_fields(*)').order('sort_order')
    if (fresh) setLayers(fresh)
  }

  const handleLayerDelete = async (layerId: string) => {
    if (!confirm('Fshi shtresën dhe të gjitha objektet e saj?')) return
    await supabase.from('layers').delete().eq('id', layerId)
    setLayers(prev => prev.filter(l => l.id !== layerId))
    if (activeLayer?.id === layerId) setActiveLayer(null)
    setFeatures(prev => { const n = { ...prev }; delete n[layerId]; return n })
  }

  const handleStopDrawing = () => {
    setActiveLayer(null)
    setDrawingCoords([])
  }

  return (
    <div className="flex flex-col h-screen bg-bg">
      <Navbar profile={profile} />
      <div className="flex flex-1 overflow-hidden">
        {/* Layer Sidebar */}
        <LayerPanel
          open={sidebarOpen}
          layers={layers}
          activeLayer={activeLayer}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onImport={() => setShowImport(true)}
          onToggle={() => setSidebarOpen(o => !o)}
          onSelectLayer={l => { setActiveLayer(a => a?.id === l.id ? null : l); setDrawingCoords([]) }}
          onToggleVisibility={(id, v) => setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: v } : l))}
          onAddLayer={() => { setEditingLayer(null); setShowLayerEditor(true) }}
          onEditLayer={l => { setEditingLayer(l); setShowLayerEditor(true) }}
          onDeleteLayer={handleLayerDelete}
        />

        {/* Map */}
        <div className="flex-1 relative overflow-hidden">
          <MapView
            layers={layers}
            features={features}
            activeLayer={activeLayer}
            drawingCoords={drawingCoords}
            gpsRequest={gpsRequest}
            onMapClick={handleMapClick}
            onMapDblClick={handleMapDblClick}
            onGPSCapture={handleGPSCapture}
            onFeatureClick={setSelectedFeature}
          />

          {/* Draw toolbar at bottom center */}
          {activeLayer && canEdit && (
            <DrawToolbar
              layer={activeLayer}
              drawingCoords={drawingCoords}
              onGPS={() => setGpsRequest(n => n + 1)}
              onStop={handleStopDrawing}
            />
          )}

          {/* Feature detail panel */}
          {selectedFeature && (
            <FeatureDetail
              feature={selectedFeature}
              layer={layers.find(l => l.id === selectedFeature.layer_id)!}
              canEdit={canEdit}
              onClose={() => setSelectedFeature(null)}
              onDelete={() => handleFeatureDelete(selectedFeature)}
              onSave={props => handleFeatureUpdate(selectedFeature, props)}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {showFeatureForm && activeLayer && pendingGeom && (
        <FeatureForm
          layer={activeLayer}
          geomType={pendingGeom.type}
          onSubmit={handleFeatureSubmit}
          onCancel={() => { setShowFeatureForm(false); setPendingGeom(null) }}
        />
      )}

      {showImport && (
        <ImportModal
          layers={layers}
          onClose={() => setShowImport(false)}
          onImport={async (layerId, geojsonFeatures) => {
            let ok = 0, err = 0
            for (let i = 0; i < geojsonFeatures.length; i += 100) {
              const batch = geojsonFeatures.slice(i, i + 100).map((f: GeoJSONFeature) => ({
                layer_id: layerId, geometry: f.geometry,
                properties: f.properties ?? {}, created_by: profile.id,
              }))
              const { data, error } = await supabase.from('features').insert(batch).select()
              if (error) err += batch.length; else ok += data?.length ?? 0
            }
            const { data: fresh } = await supabase
              .from('features').select('*, profile:profiles(full_name,email)').eq('layer_id', layerId)
            if (fresh) setFeatures(prev => ({ ...prev, [layerId]: fresh }))
            return { ok, err }
          }}
          onCreateAndImport={async (name, geomType, color, geojsonFeatures) => {
            // 1. Create new layer
            const { data: newLayer, error: layerErr } = await supabase
              .from('layers')
              .insert({ name, geom_type: geomType, color, fill_color: color, created_by: profile.id, visible: true, opacity: 0.8, sort_order: layers.length })
              .select().single()
            if (layerErr || !newLayer) return { ok: 0, err: geojsonFeatures.length }
            setLayers(prev => [...prev, { ...newLayer, fields: [] }])
            // 2. Import features
            let ok = 0, err = 0
            for (let i = 0; i < geojsonFeatures.length; i += 100) {
              const batch = geojsonFeatures.slice(i, i + 100).map((f: GeoJSONFeature) => ({
                layer_id: newLayer.id, geometry: f.geometry,
                properties: f.properties ?? {}, created_by: profile.id,
              }))
              const { data, error: fErr } = await supabase.from('features').insert(batch).select()
              if (fErr) err += batch.length; else ok += data?.length ?? 0
            }
            setFeatures(prev => {
              const all = geojsonFeatures.map((f, i) => ({ id: `tmp-${i}`, layer_id: newLayer.id, geometry: f.geometry as GeoJSONGeometry, properties: f.properties ?? {}, created_by: profile.id, created_at: '', updated_at: '' }))
              return { ...prev, [newLayer.id]: all }
            })
            return { ok, err }
          }}
        />
      )}

      {showLayerEditor && (
        <LayerEditorModal
          layer={editingLayer}
          onSave={handleLayerSave}
          onClose={() => { setShowLayerEditor(false); setEditingLayer(null) }}
        />
      )}
    </div>
  )
}
