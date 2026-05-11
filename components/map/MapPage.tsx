'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import type { Layer, Feature, Profile, GeoJSONGeometry } from '@/lib/types'
import Navbar from '@/components/ui/Navbar'
import LayerPanel from './LayerPanel'
import DrawToolbar from './DrawToolbar'
import MapToolbar, { type MapTool } from './MapToolbar'
import FeatureForm from './FeatureForm'
import FeatureDetail from './FeatureDetail'
import LayerEditorModal from './LayerEditorModal'
import ImportModal, { type GeoJSONFeature } from './ImportModal'
import AttributeTableModal from './AttributeTableModal'
import { exportGeoJSON, exportCSV, exportXLS, exportKML, exportShapefile, exportMultiCSV, exportMultiXLS } from '@/lib/exports'
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
  const canEdit   = ['admin','editor','field'].includes(profile.role)
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
  const [sidebarOpen,     setSidebarOpen]    = useState(false)
  const [gpsRequest,      setGpsRequest]     = useState(0)
  const [attrLayer,       setAttrLayer]      = useState<Layer | null>(null)
  const [zoomRequest,     setZoomRequest]    = useState<string | null>(null)
  const [zoomFeature,     setZoomFeature]    = useState<Feature | null>(null)

  // ---- Tool state ----
  const [activeTool,      setActiveTool]      = useState<MapTool | null>(null)
  const [mapSelectedIds,  setMapSelectedIds]  = useState<Set<string>>(new Set())
  const [measurePts,    setMeasurePts]    = useState<[number, number][]>([])
  const [bufferCenter,  setBufferCenter]  = useState<[number, number] | null>(null)
  const [bufferRadius,  setBufferRadius]  = useState(100)
  const [xyMarker,      setXYMarker]      = useState<[number, number] | null>(null)
  const [xyLat,         setXYLat]         = useState('')
  const [xyLng,         setXYLng]         = useState('')
  const [xyFlyTrigger,  setXYFlyTrigger]  = useState(0)
  const [infoFeatures,  setInfoFeatures]  = useState<Array<{ feature: Feature; layer: Layer }>>([])

  // Auto-open sidebar on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true)
  }, [])

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

  const canEditFeature = (feature: Feature) => {
    if (!canEditLayer(feature.layer_id)) return false
    if (profile.role === 'field') return feature.created_by === profile.id
    return canEdit
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

  // Pending point marker position for MapView (lat, lng in Leaflet order)
  const pendingMapPoint = useMemo<[number, number] | null>(() => {
    if (!showFeatureForm || pendingGeom?.type !== 'Point') return null
    const [lng, lat] = pendingGeom.coordinates as [number, number]
    return [lat, lng]
  }, [showFeatureForm, pendingGeom])

  const handlePendingPointDrag = useCallback((lat: number, lng: number) => {
    setPendingGeom({ type: 'Point', coordinates: [lng, lat] })
  }, [])

  // -------- Map event handlers --------
  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!activeLayer || !canEdit || showFeatureForm) return
    if (activeLayer.geom_type === 'Point') {
      setPendingGeom({ type: 'Point', coordinates: [lng, lat] })
      setShowFeatureForm(true)
    } else {
      setDrawingCoords(prev => [...prev, [lat, lng]])
    }
  }, [activeLayer, canEdit, showFeatureForm])

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

  // ---- Tool helpers ----
  function haversineDist(a: [number, number], b: [number, number]): number {
    const R = 6371000
    const φ1 = a[0] * Math.PI / 180, φ2 = b[0] * Math.PI / 180
    const Δφ = (b[0] - a[0]) * Math.PI / 180, Δλ = (b[1] - a[1]) * Math.PI / 180
    const h = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1-h))
  }

  function calcTotalDist(pts: [number, number][]): number {
    let d = 0
    for (let i = 1; i < pts.length; i++) d += haversineDist(pts[i-1], pts[i])
    return d
  }

  function calcPolygonArea(pts: [number, number][]): number {
    if (pts.length < 3) return 0
    const R = 6371000
    const avgLat = pts.reduce((s, p) => s + p[0], 0) / pts.length * Math.PI / 180
    let area = 0
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length
      area += pts[i][1] * pts[j][0] - pts[j][1] * pts[i][0]
    }
    const mPerDegLat = (Math.PI * R) / 180
    return (Math.abs(area) / 2) * mPerDegLat * (mPerDegLat * Math.cos(avgLat))
  }

  function fmtDist(m: number) {
    return m < 1000 ? `${m.toFixed(1)} m` : `${(m / 1000).toFixed(3)} km`
  }

  function fmtArea(m2: number) {
    if (m2 < 10000) return `${m2.toFixed(1)} m²`
    if (m2 < 1_000_000) return `${(m2 / 10000).toFixed(2)} ha`
    return `${(m2 / 1_000_000).toFixed(3)} km²`
  }

  function pointNearGeom(geom: GeoJSONGeometry, lat: number, lng: number, tol: number): boolean {
    const coords: [number, number][] = []
    const flatten = (c: unknown) => {
      if (Array.isArray(c) && typeof c[0] === 'number') coords.push(c as [number, number])
      else if (Array.isArray(c)) c.forEach(flatten)
    }
    flatten(geom.coordinates)
    if (!coords.length) return false
    if (geom.type === 'Point') {
      return Math.hypot(coords[0][0] - lng, coords[0][1] - lat) < tol
    }
    if (geom.type === 'Polygon') {
      const ring = (geom.coordinates as [number, number][][])[0]
      let inside = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j]
        if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
          inside = !inside
        }
      }
      return inside
    }
    // LineString: proximity to any segment
    for (let i = 1; i < coords.length; i++) {
      const [ax, ay] = coords[i-1], [bx, by] = coords[i]
      const dx = bx - ax, dy = by - ay
      const t = (dx || dy) ? Math.max(0, Math.min(1, ((lng-ax)*dx + (lat-ay)*dy) / (dx*dx+dy*dy))) : 0
      if (Math.hypot(lng - (ax+t*dx), lat - (ay+t*dy)) < tol) return true
    }
    return false
  }

  const handleToolSelect = (tool: MapTool | null) => {
    setActiveTool(tool)
    setMeasurePts([])
    setBufferCenter(null)
    setInfoFeatures([])
    setXYMarker(null)
    if (tool !== 'select') setMapSelectedIds(new Set())
    if (tool !== null) {
      setActiveLayer(null)
      setDrawingCoords([])
    }
  }

  const handleToolMapClick = useCallback((lat: number, lng: number) => {
    if (activeTool === 'measure-dist' || activeTool === 'measure-area') {
      setMeasurePts(prev => [...prev, [lat, lng]])
    } else if (activeTool === 'buffer') {
      setBufferCenter([lat, lng])
    } else if (activeTool === 'info') {
      const tol = 0.001
      const found: Array<{ feature: Feature; layer: Layer }> = []
      layers.filter(l => l.visible && canViewLayer(l.id)).forEach(l => {
        ;(features[l.id] ?? []).forEach(f => {
          if (pointNearGeom(f.geometry, lat, lng, tol)) found.push({ feature: f, layer: l })
        })
      })
      setInfoFeatures(found)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, layers, features])

  const handleXYGo = () => {
    const lat = parseFloat(xyLat), lng = parseFloat(xyLng)
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return
    setXYMarker([lat, lng])
    setXYFlyTrigger(n => n + 1)
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
            setActiveTool(null)
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
          {/* Map tools toolbar */}
          <MapToolbar activeTool={activeTool} onSelectTool={handleToolSelect}/>

          {/* XY panel */}
          {activeTool === 'xy' && (
            <div
              className="absolute z-[1001] bg-white/95 backdrop-blur-sm border border-b1 rounded-xl shadow-lg p-3 flex flex-col gap-2"
              style={{ top: 80, left: 8 }}
            >
              <span className="text-xs font-semibold text-txt">Shko tek koordinatat</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Gjerësi (lat)"
                  value={xyLat}
                  onChange={e => setXYLat(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleXYGo() }}
                  className="w-28 border border-b1 rounded-lg px-2 py-1.5 text-xs bg-s1 text-txt focus:outline-none focus:border-acc"
                />
                <input
                  type="text"
                  placeholder="Gjatësi (lng)"
                  value={xyLng}
                  onChange={e => setXYLng(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleXYGo() }}
                  className="w-28 border border-b1 rounded-lg px-2 py-1.5 text-xs bg-s1 text-txt focus:outline-none focus:border-acc"
                />
              </div>
              <button
                onClick={handleXYGo}
                className="bg-acc text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-acc/90 active:scale-95 transition-all"
              >
                Shko
              </button>
              {xyMarker && (
                <p className="text-[10px] text-txt2 font-mono text-center">
                  {xyMarker[0].toFixed(6)}, {xyMarker[1].toFixed(6)}
                </p>
              )}
            </div>
          )}

          {/* Measure result panel */}
          {(activeTool === 'measure-dist' || activeTool === 'measure-area') && (
            <div className="absolute z-[1001] bottom-8 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-b1 rounded-xl shadow-lg px-4 py-2 flex items-center gap-3 whitespace-nowrap">
              <span className="text-xs text-txt2">
                {activeTool === 'measure-dist' ? 'Distanca:' : 'Sipërfaqja:'}
              </span>
              <span className="text-sm font-bold text-txt font-mono">
                {activeTool === 'measure-dist'
                  ? (measurePts.length > 1 ? fmtDist(calcTotalDist(measurePts)) : '—')
                  : (measurePts.length > 2 ? fmtArea(calcPolygonArea(measurePts)) : '—')}
              </span>
              <span className="text-xs text-txt2 border-l border-b1 pl-3">{measurePts.length} pika</span>
              <button
                onClick={() => setMeasurePts([])}
                className="text-xs text-err hover:text-err/70 transition-colors ml-1"
              >
                Pastro
              </button>
            </div>
          )}

          {/* Buffer control panel */}
          {activeTool === 'buffer' && (
            <div className="absolute z-[1001] bottom-8 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-b1 rounded-xl shadow-lg px-4 py-2 flex items-center gap-3 whitespace-nowrap">
              <span className="text-xs text-txt2">Rreze:</span>
              <input
                type="number"
                value={bufferRadius}
                min={1}
                max={100000}
                onChange={e => setBufferRadius(Math.max(1, Number(e.target.value)))}
                className="w-20 border border-b1 rounded-lg px-2 py-1 text-xs bg-s1 text-txt font-mono focus:outline-none focus:border-acc"
              />
              <span className="text-xs text-txt2">m</span>
              {bufferCenter ? (
                <>
                  <span className="text-xs text-txt2 border-l border-b1 pl-3">
                    Zona: ~{fmtArea(Math.PI * bufferRadius ** 2)}
                  </span>
                  <button onClick={() => setBufferCenter(null)} className="text-xs text-err hover:text-err/70">
                    Pastro
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-txt2 italic">Klikoni hartën për vendosur qendrën</span>
              )}
            </div>
          )}

          {/* Select tool export panel */}
          {activeTool === 'select' && (
            <div className="absolute z-[1001] bottom-8 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-b1 rounded-xl shadow-lg px-4 py-2 flex items-center gap-3 whitespace-nowrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-txt2 shrink-0">
                <path d="M4 4l6 16 3-7 7-3z"/>
              </svg>
              <span className="text-xs text-txt2">
                {mapSelectedIds.size > 0
                  ? <><strong className="text-txt">{mapSelectedIds.size}</strong> objekte të zgjedhura</>
                  : <span className="italic text-txt3">Klikoni mbi objekte në hartë</span>}
              </span>
              {mapSelectedIds.size > 0 && (
                <>
                  <button
                    onClick={() => {
                      const allFeats = Object.values(features).flat()
                      const sel = allFeats.filter(f => mapSelectedIds.has(f.id))
                      const lmap = new Map(layers.map(l => [l.id, l]))
                      exportMultiCSV(lmap, sel)
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    CSV
                  </button>
                  <button
                    onClick={async () => {
                      const allFeats = Object.values(features).flat()
                      const sel = allFeats.filter(f => mapSelectedIds.has(f.id))
                      const lmap = new Map(layers.map(l => [l.id, l]))
                      await exportMultiXLS(lmap, sel)
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    XLS
                  </button>
                  <button
                    onClick={() => setMapSelectedIds(new Set())}
                    className="text-xs text-err hover:text-err/70 transition-colors ml-1"
                  >
                    Pastro
                  </button>
                </>
              )}
            </div>
          )}

          {/* Info panel */}
          {infoFeatures.length > 0 && (
            <div className="absolute z-[1001] right-12 top-1/2 -translate-y-1/2 w-64 bg-white/95 backdrop-blur-sm border border-b1 rounded-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-b1 bg-s2/50">
                <span className="text-xs font-semibold text-txt">
                  {infoFeatures.length} objekt{infoFeatures.length !== 1 ? 'e' : ''}
                </span>
                <button onClick={() => setInfoFeatures([])} className="text-txt2 hover:text-txt transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-b1">
                {infoFeatures.map(({ feature, layer }) => (
                  <div key={feature.id} className="px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: layer.color }}/>
                      <span className="text-[10px] font-semibold text-txt2 uppercase tracking-wide truncate">{layer.name}</span>
                    </div>
                    {Object.entries(feature.properties ?? {}).slice(0, 5).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs py-0.5">
                        <span className="text-txt2 shrink-0 w-20 truncate">{k}:</span>
                        <span className="text-txt truncate">{String(v ?? '—')}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => { setSelectedFeature(feature); setInfoFeatures([]) }}
                      className="mt-1.5 text-[10px] text-acc hover:underline"
                    >
                      Shiko detajet →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mobile sidebar toggle — positioned below zoom controls (top-left) */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden absolute z-[999] bg-white/90 backdrop-blur border border-gray-200 rounded-lg p-2 shadow-md text-gray-700"
              style={{ top: 80, left: 8 }}
              title="Shtresat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          )}
          <MapView
            layers={layers.filter(l => canViewLayer(l.id))}
            features={features}
            activeLayer={activeLayer}
            drawingCoords={drawingCoords}
            gpsRequest={gpsRequest}
            zoomToLayerId={zoomRequest}
            zoomToFeature={zoomFeature}
            selectedFeatureId={selectedFeature?.id}
            selectedFeatureIds={mapSelectedIds.size > 0 ? mapSelectedIds : undefined}
            selectedFeature={selectedFeature}
            onGeometryUpdate={selectedFeature && canEditLayer(selectedFeature.layer_id) ? handleGeometryUpdate : undefined}
            pendingPoint={pendingMapPoint}
            onPendingPointDrag={handlePendingPointDrag}
            onZoomDone={() => { setZoomRequest(null); setZoomFeature(null) }}
            onMapClick={handleMapClick}
            onMapDblClick={handleMapDblClick}
            onGPSCapture={handleGPSCapture}
            onFeatureClick={f => {
              if (activeTool === 'select') {
                setMapSelectedIds(prev => {
                  const next = new Set(prev)
                  if (next.has(f.id)) next.delete(f.id); else next.add(f.id)
                  return next
                })
              } else {
                setSelectedFeature(f)
              }
            }}
            activeTool={activeTool}
            measurePts={measurePts}
            bufferCenter={bufferCenter}
            bufferRadius={bufferRadius}
            xyMarker={xyMarker}
            flyToPoint={xyMarker}
            flyToTrigger={xyFlyTrigger}
            onToolMapClick={handleToolMapClick}
            onFlyDone={() => {}}
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
              canEdit={canEditFeature(selectedFeature)}
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
          canEditFeature={canEditFeature}
          onClose={() => setAttrLayer(null)}
          onSelectFeature={f => setSelectedFeature(f)}
          onZoomToFeature={f => setZoomFeature(f)}
          onDeleteFeature={handleFeatureDelete}
        />
      )}
    </div>
  )
}
