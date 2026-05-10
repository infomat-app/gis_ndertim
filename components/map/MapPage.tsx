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
import AttributeTableModal from './AttributeTableModal'
import { exportGeoJSON, exportCSV, exportXLS, exportKML, exportShapefile } from '@/lib/exports'
import type { LayerPermLevel } from '@/lib/types'

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
}

export default function MapPage({ profile }: Props) {
  const supabase  = createClient()
  const canEdit   = ['admin','editor'].includes(profile.role)
  const isAdmin   = profile.role === 'admin'

  const [layers,          setLayers]         = useState<Layer[]>([])
  const [layerPerms,      setLayerPerms]     = useState<Record<string, LayerPermLevel>>({})
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
  const [attrLayer,       setAttrLayer]      = useState<Layer | null>(null)
  const [zoomRequest,     setZoomRequest]    = useState<string | null>(null)
  const [zoomFeature,     setZoomFeature]    = useState<Feature | null>(null)

  // Escape closes attribute table
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setAttrLayer(null) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  // Load layers client-side (avoids SSR/CDN caching issues)
  useEffect(() => {
    supabase
      .from('layers')
      .select('*, fields:layer_fields(*)')
      .order('sort_order', { ascending: true })
      .then(({ data }) => { if (data) setLayers(data) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load layer-level permissions for this user (admins skip — always full access)
  useEffect(() => {
    if (profile.role === 'admin') return
    supabase
      .from('layer_permissions')
      .select('layer_id, permission')
      .eq('user_id', profile.id)
      .then(({ data }) => {
        const m: Record<string, LayerPermLevel> = {}
        for (const p of data ?? []) m[p.layer_id] = p.permission as LayerPermLevel
        setLayerPerms(m)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  // Per-layer permission helpers
  const canViewLayer = (layerId: string) => {
    if (profile.role === 'admin') return true
    return layerPerms[layerId] !== 'none'
  }
  const canEditLayer = (layerId: string) => {
    if (profile.role === 'admin') return true
    const p = layerPerms[layerId]
    if (p !== undefined) return p === 'edit'
    return profile.role !== 'viewer'
  }

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

  const handleGeometryUpdate = async (featureId: string, newGeom: GeoJSONGeometry) => {
    if (!canEdit) return
    const { data } = await supabase
      .from('features')
      .update({ geometry: newGeom })
      .eq('id', featureId)
      .select('*, profile:profiles(full_name,email)')
      .single()
    if (data) {
      setFeatures(prev => ({
        ...prev,
        [data.layer_id]: (prev[data.layer_id] ?? []).map(f => f.id === data.id ? data : f),
      }))
      setSelectedFeature(data)
    }
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
    await supabase.from('layers').delete().eq('id', layerId)
    setLayers(prev => prev.filter(l => l.id !== layerId))
    if (activeLayer?.id === layerId) setActiveLayer(null)
    setFeatures(prev => { const n = { ...prev }; delete n[layerId]; return n })
  }

  const handleRename = async (layer: Layer) => {
    await supabase.from('layers').update({ name: layer.name }).eq('id', layer.id)
    setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, name: layer.name } : l))
  }

  const handleExport = async (layer: Layer, format: 'geojson' | 'csv' | 'xls' | 'kml' | 'shp') => {
    const feats = features[layer.id] ?? []
    if (format === 'geojson') exportGeoJSON(layer, feats)
    else if (format === 'csv') exportCSV(layer, feats)
    else if (format === 'xls') await exportXLS(layer, feats)
    else if (format === 'kml') exportKML(layer, feats)
    else if (format === 'shp') await exportShapefile(layer, feats)
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
          layers={layers.filter(l => canViewLayer(l.id))}
          features={features}
          activeLayer={activeLayer}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onImport={() => setShowImport(true)}
          onToggle={() => setSidebarOpen(o => !o)}
          onSelectLayer={l => {
            if (!canEditLayer(l.id)) return
            setActiveLayer(a => a?.id === l.id ? null : l)
            setDrawingCoords([])
          }}
          onToggleVisibility={(id, v) => setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: v } : l))}
          onAddLayer={() => { setEditingLayer(null); setShowLayerEditor(true) }}
          onEditLayer={l => { setEditingLayer(l); setShowLayerEditor(true) }}
          onDeleteLayer={handleLayerDelete}
          onZoomToLayer={id => setZoomRequest(id)}
          onAttributeTable={l => setAttrLayer(l)}
          onRename={handleRename}
          onExport={handleExport}
        />

        {/* Map */}
        <div className="flex-1 relative overflow-hidden">
          <MapView
            layers={layers.filter(l => canViewLayer(l.id))}
            features={features}
            activeLayer={activeLayer}
            drawingCoords={drawingCoords}
            gpsRequest={gpsRequest}
            zoomToLayerId={zoomRequest}
            zoomToFeature={zoomFeature}
            selectedFeatureId={selectedFeature?.id}
            selectedFeature={selectedFeature}
            onGeometryUpdate={selectedFeature && canEditLayer(selectedFeature.layer_id) ? handleGeometryUpdate : undefined}
            onZoomDone={() => { setZoomRequest(null); setZoomFeature(null) }}
            onMapClick={handleMapClick}
            onMapDblClick={handleMapDblClick}
            onGPSCapture={handleGPSCapture}
            onFeatureClick={setSelectedFeature}
          />

          {/* Draw toolbar at bottom center */}
          {activeLayer && canEditLayer(activeLayer.id) && (
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
              key={selectedFeature.id}
              feature={selectedFeature}
              layer={layers.find(l => l.id === selectedFeature.layer_id)!}
              canEdit={canEditLayer(selectedFeature.layer_id)}
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
            if (layerErr || !newLayer) {
              console.error('Layer insert error:', layerErr)
              throw new Error(layerErr?.message ?? 'Nuk u krijua shtresa (kontrollo rolin në Supabase)')
            }
            // 2. Auto-create layer_fields from first feature's properties
            const firstProps = geojsonFeatures[0]?.properties ?? {}
            const autoFields = Object.entries(firstProps).map(([key, val], i) => ({
              layer_id: newLayer.id,
              field_name: key,
              field_label: key,
              field_type: typeof val === 'number' ? 'number' : typeof val === 'boolean' ? 'boolean' : 'text',
              required: false,
              field_options: null,
              sort_order: i,
            }))
            if (autoFields.length) await supabase.from('layer_fields').insert(autoFields)
            // 3. Import features
            let ok = 0, err = 0
            for (let i = 0; i < geojsonFeatures.length; i += 100) {
              const batch = geojsonFeatures.slice(i, i + 100).map((f: GeoJSONFeature) => ({
                layer_id: newLayer.id, geometry: f.geometry,
                properties: f.properties ?? {}, created_by: profile.id,
              }))
              const { data, error: fErr } = await supabase.from('features').insert(batch).select()
              if (fErr) err += batch.length; else ok += data?.length ?? 0
            }
            // 4. Reload layers with fields
            const { data: freshLayers } = await supabase
              .from('layers').select('*, fields:layer_fields(*)').order('sort_order')
            if (freshLayers) setLayers(freshLayers)
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

      {attrLayer && (
        <AttributeTableModal
          layer={attrLayer}
          features={features[attrLayer.id] ?? []}
          onClose={() => setAttrLayer(null)}
          onSelectFeature={f => setSelectedFeature(f)}
          onZoomToFeature={f => setZoomFeature(f)}
          onDeleteFeature={handleFeatureDelete}
        />
      )}
    </div>
  )
}
