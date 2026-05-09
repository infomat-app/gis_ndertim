'use client'
import { useEffect, useRef, useCallback } from 'react'
import {
  MapContainer, TileLayer, Marker, Polyline, Polygon,
  useMapEvents, useMap, Tooltip,
} from 'react-leaflet'
import L from 'leaflet'
import type { Layer, Feature } from '@/lib/types'

// Fix Leaflet default icon (CDN fallback for Next.js)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function dotIcon(color: string, size = 14) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,.85);box-shadow:0 0 0 1.5px rgba(0,0,0,.45),0 2px 6px rgba(0,0,0,.35)"></div>`,
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
  onMapClick: (lat: number, lng: number) => void
  onMapDblClick: () => void
  onGPSCapture: (lat: number, lng: number) => void
  onFeatureClick: (f: Feature) => void
}

export default function MapView({
  layers, features, activeLayer, drawingCoords,
  gpsRequest, onMapClick, onMapDblClick, onGPSCapture, onFeatureClick,
}: Props) {

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
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      {/* Render features per visible layer */}
      {layers.filter(l => l.visible).map(layer =>
        (features[layer.id] ?? []).map(feat => {
          if (layer.geom_type === 'Point') {
            const [lng, lat] = feat.geometry.coordinates as [number, number]
            return (
              <Marker
                key={feat.id}
                position={[lat, lng]}
                icon={dotIcon(layer.color)}
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
                color={layer.color}
                weight={3}
                opacity={layer.opacity}
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
                color={layer.color}
                fillColor={layer.fill_color}
                fillOpacity={layer.opacity * 0.4}
                weight={2}
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
    </MapContainer>
  )
}
