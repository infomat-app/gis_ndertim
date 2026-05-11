'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import {
  MapContainer, Marker, Polyline, Polygon, Circle,
  useMapEvents, useMap, Tooltip,
} from 'react-leaflet'
import type { MapTool } from './MapToolbar'
import L from 'leaflet'
import type { Layer, Feature, PointStyle, GeoJSONGeometry } from '@/lib/types'
import BaseLayerControl from './BaseLayerControl'

// Fix Leaflet default icon (CDN fallback for Next.js)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function svgShape(color: string, style: PointStyle, sw: number): string {
  switch (style) {
    case 'square':
      return `<rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="${color}" stroke="white" stroke-width="${sw}"/>`
    case 'diamond':
      return `<polygon points="8,1 15,8 8,15 1,8" fill="${color}" stroke="white" stroke-width="${sw}"/>`
    case 'triangle':
      return `<polygon points="8,1.5 14.5,14.5 1.5,14.5" fill="${color}" stroke="white" stroke-width="${sw}" stroke-linejoin="round"/>`
    case 'star':
      return `<polygon points="8,1 9.76,5.57 14.66,5.84 10.85,8.93 12.11,13.66 8,11 3.89,13.66 5.15,8.93 1.34,5.84 6.24,5.57" fill="${color}" stroke="white" stroke-width="${sw}"/>`
    case 'cross':
      return `<path d="M5.5 1h5v4.5H15v5h-4.5V15h-5v-4.5H1v-5h4.5z" fill="${color}" stroke="white" stroke-width="${sw}" stroke-linejoin="round"/>`
    default: // circle
      return `<circle cx="8" cy="8" r="6.5" fill="${color}" stroke="white" stroke-width="${sw}"/>`
  }
}

function pointIcon(color: string, style: PointStyle = 'circle', selected = false, baseSize = 16) {
  const size = selected ? Math.round(baseSize * 1.375) : baseSize
  const sw   = selected ? 2 : 1.5
  const glow = selected
    ? `filter:drop-shadow(0 0 5px ${color})drop-shadow(0 0 2px ${color})`
    : `filter:drop-shadow(0 1px 3px rgba(0,0,0,0.45))`
  const html = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16" style="${glow}">${svgShape(color, style, sw)}</svg>`
  return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

const gpsIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#2d8bff;border:3px solid white;box-shadow:0 0 0 2px #2d8bff55,0 2px 8px rgba(0,0,0,.5)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const measureDotIcon = (isFirst: boolean) => L.divIcon({
  className: '',
  html: `<div style="width:8px;height:8px;border-radius:50%;background:${isFirst ? '#2563eb' : '#fff'};border:2px solid #2563eb;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
  iconSize: [8, 8],
  iconAnchor: [4, 4],
})

const xyPinIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,.4))">
    <path d="M11 0C6.03 0 2 4.03 2 9c0 7 9 21 9 21S20 16 20 9c0-4.97-4.03-9-9-9z" fill="#7c3aed"/>
    <circle cx="11" cy="9" r="4" fill="white"/>
    <circle cx="11" cy="9" r="2" fill="#7c3aed"/>
  </svg>`,
  iconSize: [22, 30],
  iconAnchor: [11, 30],
})

const myLocPinIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))">
    <path d="M14 1C8.48 1 4 5.48 4 11c0 8.5 10 24 10 24S24 19.5 24 11C24 5.48 19.52 1 14 1z" fill="#1d4ed8"/>
    <circle cx="14" cy="11" r="5" fill="white"/>
    <circle cx="14" cy="11" r="2.5" fill="#1d4ed8"/>
  </svg>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
})

function MyLocationHandler({
  trigger,
  onLocated,
}: {
  trigger: number
  onLocated: (pos: [number, number]) => void
}) {
  const map = useMap()
  const prevRef = useRef(0)
  useEffect(() => {
    if (trigger === 0 || trigger === prevRef.current) return
    prevRef.current = trigger
    if (!navigator.geolocation) { alert('GPS nuk mbështetet nga shfletuesi'); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        map.flyTo([lat, lng], 17, { duration: 1.5 })
        onLocated([lat, lng])
      },
      () => alert('Nuk mund të merret vendndodhja. Kontrollo lejet e shfletuesit.')
    )
  }, [trigger, map, onLocated])
  return null
}

const vertexIcon = (first: boolean) => L.divIcon({
  className: '',
  html: `<div style="width:10px;height:10px;border-radius:50%;background:${first ? '#fff' : '#ffaa2e'};border:2px solid rgba(0,0,0,.5)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
})

const editVertexIcon = L.divIcon({
  className: '',
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#fbbf24;border:2.5px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.25),0 2px 5px rgba(0,0,0,.3);cursor:grab"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

// ---- Vertex editor for selected LineString / Polygon ----
function VertexEditor({
  feature,
  onUpdate,
}: {
  feature: Feature
  onUpdate: (featureId: string, newGeom: GeoJSONGeometry) => void
}) {
  if (feature.geometry.type === 'LineString') {
    const coords = feature.geometry.coordinates as [number, number][]
    return (
      <>
        {coords.map((coord, i) => (
          <Marker
            key={`ve-${i}`}
            position={[coord[1], coord[0]]}
            icon={editVertexIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const pos = (e.target as L.Marker).getLatLng()
                const newCoords = coords.map((c, idx) => idx === i ? [pos.lng, pos.lat] as [number, number] : c)
                onUpdate(feature.id, { type: 'LineString', coordinates: newCoords })
              },
            }}
          />
        ))}
      </>
    )
  }
  if (feature.geometry.type === 'Polygon') {
    const ring = (feature.geometry.coordinates as [number, number][][])[0]
    const verts = ring.slice(0, -1)
    return (
      <>
        {verts.map((coord, i) => (
          <Marker
            key={`ve-${i}`}
            position={[coord[1], coord[0]]}
            icon={editVertexIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const pos = (e.target as L.Marker).getLatLng()
                const newVerts = verts.map((c, idx) => idx === i ? [pos.lng, pos.lat] as [number, number] : c)
                newVerts.push(newVerts[0])
                onUpdate(feature.id, { type: 'Polygon', coordinates: [newVerts] })
              },
            }}
          />
        ))}
      </>
    )
  }
  return null
}

// ---- Map event handler inner component ----
function DrawHandler({
  activeLayer,
  activeTool,
  onMapClick,
  onMapDblClick,
}: {
  activeLayer: { geom_type: string } | null
  activeTool: MapTool | null
  onMapClick: (lat: number, lng: number) => void
  onMapDblClick: () => void
}) {
  const map = useMapEvents({
    click(e) {
      if (!activeLayer || activeTool) return
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
    dblclick(e) {
      if (!activeLayer || activeTool) return
      e.originalEvent.preventDefault()
      e.originalEvent.stopPropagation()
      onMapDblClick()
    },
  })

  useEffect(() => {
    if (!activeTool) {
      map.getContainer().style.cursor = activeLayer ? 'crosshair' : ''
    }
  }, [activeLayer, activeTool, map])

  return null
}

// ---- Tool click handler ----
function ToolHandler({
  activeTool,
  onToolClick,
}: {
  activeTool: MapTool | null
  onToolClick: (lat: number, lng: number) => void
}) {
  const map = useMapEvents({
    click(e) {
      if (!activeTool || activeTool === 'xy' || activeTool === 'select') return
      onToolClick(e.latlng.lat, e.latlng.lng)
    },
  })

  useEffect(() => {
    if (!activeTool) return
    const cursor = activeTool === 'info' ? 'help'
      : (activeTool === 'xy' || activeTool === 'select') ? 'default'
      : 'crosshair'
    map.getContainer().style.cursor = cursor
  }, [activeTool, map])

  return null
}

// ---- Fly to a point ----
function FlyToHandler({
  point,
  trigger,
  onDone,
}: {
  point: [number, number] | null
  trigger: number
  onDone: () => void
}) {
  const map = useMap()
  const prevRef = useRef(0)
  useEffect(() => {
    if (!point || trigger === 0 || trigger === prevRef.current) return
    prevRef.current = trigger
    map.flyTo(point, 16, { duration: 1.5 })
    onDone()
  }, [trigger, point, map, onDone])
  return null
}

// ---- Zoom to layer bounds ----
function ZoomToLayer({
  layerId, features, onDone,
}: {
  layerId: string | null
  features: Record<string, import('@/lib/types').Feature[]>
  onDone: () => void
}) {
  const map = useMap()
  useEffect(() => {
    if (!layerId) return
    const feats = features[layerId] ?? []
    if (!feats.length) { onDone(); return }
    const latlngs: [number, number][] = []
    feats.forEach(f => {
      const g = f.geometry
      const flatten = (c: unknown): void => {
        if (Array.isArray(c) && typeof c[0] === 'number') {
          latlngs.push([c[1] as number, c[0] as number])
        } else if (Array.isArray(c)) {
          c.forEach(flatten)
        }
      }
      flatten(g.coordinates)
    })
    if (latlngs.length) map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 17 })
    onDone()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerId])
  return null
}

// ---- Zoom to single feature ----
function ZoomToFeature({ feature, onDone }: { feature: Feature | null; onDone: () => void }) {
  const map = useMap()
  useEffect(() => {
    if (!feature) return
    const latlngs: [number, number][] = []
    const flatten = (c: unknown): void => {
      if (Array.isArray(c) && typeof c[0] === 'number') latlngs.push([c[1] as number, c[0] as number])
      else if (Array.isArray(c)) c.forEach(flatten)
    }
    flatten(feature.geometry.coordinates)
    if (latlngs.length === 1) map.flyTo(latlngs[0], 17, { duration: 1 })
    else if (latlngs.length > 1) map.fitBounds(latlngs, { padding: [60, 60], maxZoom: 18, animate: true })
    onDone()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature])
  return null
}

// ---- GPS fly-to ----
function GPSHandler({
  gpsRequest,
  onCapture,
}: {
  gpsRequest: number
  onCapture: (lat: number, lng: number) => void
}) {
  const map = useMap()
  const prevRef = useRef(0)

  useEffect(() => {
    if (gpsRequest === 0 || gpsRequest === prevRef.current) return
    prevRef.current = gpsRequest

    if (!navigator.geolocation) {
      alert('GPS nuk mbështetet nga shfletuesi')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        map.flyTo([lat, lng], 17, { duration: 1.5 })
        onCapture(lat, lng)
      },
      () => alert('Nuk mund të marrë lokacionin GPS. Kontrollo lejet e shfletuesit.')
    )
  }, [gpsRequest, map, onCapture])

  return null
}

// ---- Main MapView component ----
interface Props {
  layers: Layer[]
  features: Record<string, Feature[]>
  activeLayer: Layer | null
  drawingCoords: [number, number][]
  gpsRequest: number
  zoomToLayerId: string | null
  zoomToFeature: Feature | null
  selectedFeatureId?: string | null
  selectedFeatureIds?: Set<string>
  selectedFeature?: Feature | null
  onZoomDone: () => void
  onMapClick: (lat: number, lng: number) => void
  onMapDblClick: () => void
  onGPSCapture: (lat: number, lng: number) => void
  onFeatureClick: (f: Feature) => void
  onGeometryUpdate?: (featureId: string, newGeom: GeoJSONGeometry) => void
  // Tool props
  activeTool?: MapTool | null
  measurePts?: [number, number][]
  bufferCenter?: [number, number] | null
  bufferRadius?: number
  xyMarker?: [number, number] | null
  flyToPoint?: [number, number] | null
  flyToTrigger?: number
  onToolMapClick?: (lat: number, lng: number) => void
  onFlyDone?: () => void
}

export default function MapView({
  layers, features, activeLayer, drawingCoords,
  gpsRequest, zoomToLayerId, zoomToFeature,
  selectedFeatureId, selectedFeatureIds, selectedFeature,
  onZoomDone, onMapClick, onMapDblClick, onGPSCapture,
  onFeatureClick, onGeometryUpdate,
  activeTool = null,
  measurePts = [],
  bufferCenter = null,
  bufferRadius = 100,
  xyMarker = null,
  flyToPoint = null,
  flyToTrigger = 0,
  onToolMapClick,
  onFlyDone,
}: Props) {

  const [baseLayerId,   setBaseLayerId]   = useState('osm')
  const [myLocation,    setMyLocation]    = useState<[number, number] | null>(null)
  const [locateTrigger, setLocateTrigger] = useState(0)
  const [locating,      setLocating]      = useState(false)

  const handleLocate = () => {
    setLocating(true)
    setLocateTrigger(n => n + 1)
  }

  const handleLocated = useCallback((pos: [number, number]) => {
    setMyLocation(pos)
    setLocating(false)
  }, [])

  const getFirstProp = useCallback((f: Feature): string => {
    const val = Object.values(f.properties ?? {}).find(v => {
      const s = String(v ?? '')
      return s.length > 0 && s.length < 120 && !s.startsWith('data:')
    })
    return val ? String(val) : f.id.slice(0, 8)
  }, [])

  return (
    <div className="relative h-full w-full">
    <MapContainer
      center={[41.33, 19.83]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      doubleClickZoom={false}
      zoomControl={true}
    >
      <BaseLayerControl activeId={baseLayerId} onChange={setBaseLayerId} />

      {/* Render features per visible layer */}
      {layers.filter(l => l.visible).map(layer =>
        (features[layer.id] ?? []).map(feat => {
          const isSelected = feat.id === selectedFeatureId || (selectedFeatureIds?.has(feat.id) ?? false)
          if (layer.geom_type === 'Point') {
            const [lng, lat] = feat.geometry.coordinates as [number, number]
            return (
              <Marker
                key={feat.id}
                position={[lat, lng]}
                icon={pointIcon(layer.color, layer.point_style ?? 'circle', isSelected, layer.point_size ?? 16)}
                zIndexOffset={isSelected ? 1000 : 0}
                draggable={isSelected && !!onGeometryUpdate}
                eventHandlers={{
                  click: () => onFeatureClick(feat),
                  dragend: (e) => {
                    if (!onGeometryUpdate) return
                    const pos = (e.target as L.Marker).getLatLng()
                    onGeometryUpdate(feat.id, { type: 'Point', coordinates: [pos.lng, pos.lat] })
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                  <span className="text-xs">{getFirstProp(feat)}</span>
                </Tooltip>
              </Marker>
            )
          }
          if (layer.geom_type === 'LineString') {
            const pos = (feat.geometry.coordinates as [number, number][]).map(([lo, la]) => [la, lo] as [number, number])
            return (
              <Polyline
                key={feat.id}
                positions={pos}
                color={isSelected ? '#f59e0b' : layer.color}
                weight={isSelected ? 5 : 3}
                opacity={isSelected ? 1 : layer.opacity}
                eventHandlers={{ click: () => onFeatureClick(feat) }}
              >
                <Tooltip sticky>{getFirstProp(feat)}</Tooltip>
              </Polyline>
            )
          }
          if (layer.geom_type === 'Polygon') {
            const ring = (feat.geometry.coordinates as [number, number][][])[0]
              .map(([lo, la]) => [la, lo] as [number, number])
            return (
              <Polygon
                key={feat.id}
                positions={ring}
                color={isSelected ? '#f59e0b' : layer.color}
                fillColor={isSelected ? '#f59e0b' : layer.fill_color}
                fillOpacity={isSelected ? 0.45 : layer.opacity * 0.4}
                weight={isSelected ? 3 : 2}
                eventHandlers={{ click: () => onFeatureClick(feat) }}
              >
                <Tooltip sticky>{getFirstProp(feat)}</Tooltip>
              </Polygon>
            )
          }
          return null
        })
      )}

      {/* Drawing preview */}
      {activeLayer && drawingCoords.length > 0 && (
        <>
          {activeLayer.geom_type === 'LineString' && drawingCoords.length >= 2 && (
            <Polyline
              positions={drawingCoords}
              color={activeLayer.color}
              weight={2}
              dashArray="8 5"
            />
          )}
          {activeLayer.geom_type === 'Polygon' && drawingCoords.length >= 2 && (
            <Polygon
              positions={drawingCoords}
              color={activeLayer.color}
              fillColor={activeLayer.fill_color}
              fillOpacity={0.15}
              dashArray="8 5"
            />
          )}
          {drawingCoords.map((coord, i) => (
            <Marker key={i} position={coord} icon={vertexIcon(i === 0)} />
          ))}
        </>
      )}

      {/* Vertex editing handles for selected LineString / Polygon */}
      {selectedFeature && onGeometryUpdate && selectedFeature.geometry.type !== 'Point' && (
        <VertexEditor feature={selectedFeature} onUpdate={onGeometryUpdate} />
      )}

      {/* "My Location" pin marker */}
      {myLocation && <Marker position={myLocation} icon={myLocPinIcon} />}

      {/* Measure overlay */}
      {measurePts.length >= 2 && (activeTool === 'measure-dist' || activeTool === 'measure-area') && (
        <Polyline positions={measurePts} color="#2563eb" weight={2} dashArray="8 4"/>
      )}
      {measurePts.length >= 3 && activeTool === 'measure-area' && (
        <Polygon positions={measurePts} color="#2563eb" fillColor="#3b82f6" fillOpacity={0.15} weight={2} dashArray="8 4"/>
      )}
      {(activeTool === 'measure-dist' || activeTool === 'measure-area') && measurePts.map((pt, i) => (
        <Marker key={`mp-${i}`} position={pt} icon={measureDotIcon(i === 0)}/>
      ))}

      {/* Buffer circle */}
      {bufferCenter && bufferRadius > 0 && (
        <Circle
          center={bufferCenter}
          radius={bufferRadius}
          color="#f59e0b"
          fillColor="#fbbf24"
          fillOpacity={0.15}
          weight={2}
          dashArray="6 4"
        />
      )}

      {/* XY marker */}
      {xyMarker && <Marker position={xyMarker} icon={xyPinIcon}/>}

      <DrawHandler
        activeLayer={activeLayer}
        activeTool={activeTool}
        onMapClick={onMapClick}
        onMapDblClick={onMapDblClick}
      />
      <ToolHandler
        activeTool={activeTool}
        onToolClick={onToolMapClick ?? (() => {})}
      />
      {flyToPoint && (
        <FlyToHandler point={flyToPoint} trigger={flyToTrigger} onDone={onFlyDone ?? (() => {})}/>
      )}
      <GPSHandler gpsRequest={gpsRequest} onCapture={onGPSCapture} />
      <ZoomToLayer layerId={zoomToLayerId} features={features} onDone={onZoomDone} />
      <ZoomToFeature feature={zoomToFeature} onDone={onZoomDone} />
      <MyLocationHandler trigger={locateTrigger} onLocated={handleLocated} />
    </MapContainer>

    {/* My Location floating button — above BaseLayerControl */}
    <button
      onClick={handleLocate}
      disabled={locating}
      title="Vendndodhja ime"
      style={{ position: 'absolute', bottom: 172, right: 8, zIndex: 1000 }}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-lg transition-all text-xs font-semibold
        ${locating
          ? 'bg-blue-400 text-white cursor-wait opacity-80'
          : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
        }`}
    >
      {locating ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className="animate-spin shrink-0">
          <circle cx="12" cy="12" r="10" strokeOpacity=".3"/>
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
          <circle cx="12" cy="12" r="8" strokeOpacity=".6"/>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round"/>
        </svg>
      )}
      <span>{locating ? 'Duke kërkuar...' : 'Vendodhja'}</span>
    </button>

    {/* Coordinates label — left of Vendodhja button, only on md+ */}
    {myLocation && (
      <div
        style={{ position: 'absolute', bottom: 178, right: 150, zIndex: 1000 }}
        className="hidden md:block bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] font-mono text-gray-600 shadow-sm pointer-events-none"
      >
        {myLocation[0].toFixed(5)}, {myLocation[1].toFixed(5)}
      </div>
    )}
    </div>
  )
}
