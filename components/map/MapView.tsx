'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import {
  MapContainer, Marker, Polyline, Polygon,
  useMapEvents, useMap, Tooltip,
} from 'react-leaflet'
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

function pointIcon(color: string, style: PointStyle = 'circle', selected = false) {
  const size = selected ? 22 : 16
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
  onMapClick,
  onMapDblClick,
}: {
  activeLayer: { geom_type: string } | null
  onMapClick: (lat: number, lng: number) => void
  onMapDblClick: () => void
}) {
  const map = useMapEvents({
    click(e) {
      if (!activeLayer) return
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
    dblclick(e) {
      if (!activeLayer) return
      e.originalEvent.preventDefault()
      e.originalEvent.stopPropagation()
      onMapDblClick()
    },
  })

  useEffect(() => {
    map.getContainer().style.cursor = activeLayer ? 'crosshair' : ''
  }, [activeLayer, map])

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
  selectedFeature?: Feature | null
  onZoomDone: () => void
  onMapClick: (lat: number, lng: number) => void
  onMapDblClick: () => void
  onGPSCapture: (lat: number, lng: number) => void
  onFeatureClick: (f: Feature) => void
  onGeometryUpdate?: (featureId: string, newGeom: GeoJSONGeometry) => void
}

export default function MapView({
  layers, features, activeLayer, drawingCoords,
  gpsRequest, zoomToLayerId, zoomToFeature,
  selectedFeatureId, selectedFeature,
  onZoomDone, onMapClick, onMapDblClick, onGPSCapture,
  onFeatureClick, onGeometryUpdate,
}: Props) {

  const [baseLayerId, setBaseLayerId] = useState('osm')

  const getFirstProp = useCallback((f: Feature): string => {
    const vals = Object.values(f.properties ?? {})
    return vals.length ? String(vals[0]) : f.id.slice(0, 8)
  }, [])

  return (
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
          const isSelected = feat.id === selectedFeatureId
          if (layer.geom_type === 'Point') {
            const [lng, lat] = feat.geometry.coordinates as [number, number]
            return (
              <Marker
                key={feat.id}
                position={[lat, lng]}
                icon={pointIcon(layer.color, layer.point_style ?? 'circle', isSelected)}
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

      <DrawHandler
        activeLayer={activeLayer}
        onMapClick={onMapClick}
        onMapDblClick={onMapDblClick}
      />
      <GPSHandler gpsRequest={gpsRequest} onCapture={onGPSCapture} />
      <ZoomToLayer layerId={zoomToLayerId} features={features} onDone={onZoomDone} />
      <ZoomToFeature feature={zoomToFeature} onDone={onZoomDone} />
    </MapContainer>
  )
}
