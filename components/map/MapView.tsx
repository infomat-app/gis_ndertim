'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import {
  MapContainer, Marker, Polyline, Polygon,
  useMapEvents, useMap, Tooltip,
} from 'react-leaflet'
import L from 'leaflet'
import type { Layer, Feature } from '@/lib/types'
import BaseLayerControl from './BaseLayerControl'

// Fix Leaflet default icon (CDN fallback for Next.js)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function dotIcon(color: string, selected = false) {
  const size = selected ? 20 : 14
  const style = selected
    ? `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 3px ${color},0 2px 10px rgba(0,0,0,.5)`
    : `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,.85);box-shadow:0 0 0 1.5px rgba(0,0,0,.45),0 2px 6px rgba(0,0,0,.35)`
  return L.divIcon({
    className: '',
    html: `<div style="${style}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
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
  onZoomDone: () => void
  onMapClick: (lat: number, lng: number) => void
  onMapDblClick: () => void
  onGPSCapture: (lat: number, lng: number) => void
  onFeatureClick: (f: Feature) => void
}

export default function MapView({
  layers, features, activeLayer, drawingCoords,
  gpsRequest, zoomToLayerId, zoomToFeature, selectedFeatureId,
  onZoomDone, onMapClick, onMapDblClick, onGPSCapture, onFeatureClick,
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
                icon={dotIcon(layer.color, isSelected)}
                zIndexOffset={isSelected ? 1000 : 0}
                eventHandlers={{ click: () => onFeatureClick(feat) }}
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
