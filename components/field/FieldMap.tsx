'use client'
import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Layer, Feature } from '@/lib/types'
import BaseLayerControl from '../map/BaseLayerControl'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function dotIcon(color: string, size = 16, selected = false) {
  const glow = selected ? `box-shadow:0 0 0 3px white,0 0 0 5px ${color},0 2px 10px rgba(0,0,0,.4)` : `box-shadow:0 0 0 1.5px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.3)`
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid rgba(255,255,255,.9);${glow}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const pendingIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#ffaa2e;border:3px solid white;box-shadow:0 0 0 2px #ffaa2e,0 2px 10px rgba(0,0,0,.4);animation:pulse 1s infinite"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const gpsIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#2d8bff;border:3px solid white;box-shadow:0 0 0 2px #2d8bff55,0 2px 8px rgba(0,0,0,.4)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// Blue ring icon for "my location" (locate-only, not a captured point)
const myLocIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#1d4ed8;border:3px solid white;box-shadow:0 0 0 4px rgba(29,78,216,.25),0 2px 8px rgba(0,0,0,.4)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// ---- Map click handler ----
function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng) },
  })
  useEffect(() => {
    map.getContainer().style.cursor = 'crosshair'
  }, [map])
  return null
}

// ---- GPS capture (for saving a new point) ----
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
    if (!navigator.geolocation) { alert('GPS nuk mbështetet'); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        map.flyTo([lat, lng], 17, { duration: 1 })
        onCapture(lat, lng)
      },
      () => alert('Nuk mund të merret lokacioni GPS.')
    )
  }, [gpsRequest, map, onCapture])

  return null
}

// ---- "My Location" handler (locate only, no form) ----
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

interface Props {
  layer: Layer
  features: Feature[]
  pendingCoords: [number, number] | null
  gpsCoords: [number, number] | null
  gpsRequest: number
  myLocation: [number, number] | null
  locateTrigger: number
  selectedFeatureId?: string | null
  onMapClick: (lat: number, lng: number) => void
  onGPSCapture: (lat: number, lng: number) => void
  onLocated: (pos: [number, number]) => void
  onFeatureClick?: (f: Feature) => void
}

export default function FieldMap({
  layer, features, pendingCoords, gpsCoords,
  gpsRequest, myLocation, locateTrigger,
  selectedFeatureId, onMapClick, onGPSCapture, onLocated, onFeatureClick,
}: Props) {
  const [baseLayerId, setBaseLayerId] = useState('google_satellite')

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[41.33, 19.83]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <BaseLayerControl activeId={baseLayerId} onChange={setBaseLayerId} />

        {/* Existing features */}
        {features.map(f => {
          const [lng, lat] = f.geometry.coordinates as [number, number]
          const isSelected = f.id === selectedFeatureId
          return (
            <Marker
              key={f.id}
              position={[lat, lng]}
              icon={dotIcon(layer.color, isSelected ? 22 : 16, isSelected)}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{ click: () => onFeatureClick?.(f) }}
            />
          )
        })}

        {/* Pending location (orange pulse — about to save) */}
        {pendingCoords && (
          <Marker position={pendingCoords} icon={pendingIcon} />
        )}

        {/* GPS coords after capture (blue) */}
        {gpsCoords && !pendingCoords && (
          <Marker position={gpsCoords} icon={gpsIcon} />
        )}

        {/* "My Location" blue ring marker */}
        {myLocation && !pendingCoords && (
          <Marker position={myLocation} icon={myLocIcon} />
        )}

        <ClickHandler onMapClick={onMapClick} />
        <GPSHandler gpsRequest={gpsRequest} onCapture={onGPSCapture} />
        <MyLocationHandler trigger={locateTrigger} onLocated={onLocated} />
      </MapContainer>
    </div>
  )
}
