'use client'
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Layer, Feature } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function dotIcon(color: string, size = 16) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid rgba(255,255,255,.9);box-shadow:0 0 0 1.5px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.3)"></div>`,
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

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng) },
  })
  useEffect(() => {
    map.getContainer().style.cursor = 'crosshair'
  }, [map])
  return null
}

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

interface Props {
  layer: Layer
  features: Feature[]
  pendingCoords: [number, number] | null
  gpsCoords: [number, number] | null
  gpsRequest: number
  onMapClick: (lat: number, lng: number) => void
  onGPSCapture: (lat: number, lng: number) => void
}

export default function FieldMap({
  layer, features, pendingCoords, gpsCoords,
  gpsRequest, onMapClick, onGPSCapture,
}: Props) {
  return (
    <MapContainer
      center={[41.33, 19.83]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
        maxZoom={19}
      />

      {/* Existing features */}
      {features.map(f => {
        const [lng, lat] = f.geometry.coordinates as [number, number]
        return (
          <Marker key={f.id} position={[lat, lng]} icon={dotIcon(layer.color)} />
        )
      })}

      {/* Pending location */}
      {pendingCoords && (
        <Marker position={pendingCoords} icon={pendingIcon} />
      )}

      {/* GPS location */}
      {gpsCoords && !pendingCoords && (
        <Marker position={gpsCoords} icon={gpsIcon} />
      )}

      <ClickHandler onMapClick={onMapClick} />
      <GPSHandler gpsRequest={gpsRequest} onCapture={onGPSCapture} />
    </MapContainer>
  )
}
