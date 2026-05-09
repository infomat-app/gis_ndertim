'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
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
  onMapClick: (lat: number, lng: number) => void
  onGPSCapture: (lat: number, lng: number) => void
}

export default function FieldMap({
  layer, features, pendingCoords, gpsCoords,
  gpsRequest, onMapClick, onGPSCapture,
}: Props) {
  const [baseLayerId,    setBaseLayerId]    = useState('osm')
  const [myLocation,     setMyLocation]     = useState<[number, number] | null>(null)
  const [locateTrigger,  setLocateTrigger]  = useState(0)
  const [locating,       setLocating]       = useState(false)

  const handleLocate = () => {
    setLocating(true)
    setLocateTrigger(n => n + 1)
  }

  const handleLocated = useCallback((pos: [number, number]) => {
    setMyLocation(pos)
    setLocating(false)
  }, [])

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
          return <Marker key={f.id} position={[lat, lng]} icon={dotIcon(layer.color)} />
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
        <MyLocationHandler trigger={locateTrigger} onLocated={handleLocated} />
      </MapContainer>

      {/* "My Location" floating button — below zoom control (top-left) */}
      <button
        onClick={handleLocate}
        disabled={locating}
        title="Vendndodhja ime"
        style={{ position: 'absolute', left: 10, top: 82, zIndex: 1000 }}
        className={`w-[34px] h-[34px] bg-white rounded-md flex items-center justify-center shadow-md transition-all
          ${locating
            ? 'opacity-60 cursor-wait border-2 border-acc/40'
            : 'border-2 border-gray-300 hover:border-acc hover:text-acc active:scale-95'
          } text-gray-600`}
      >
        {locating ? (
          // Spinner
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className="animate-spin">
            <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
          </svg>
        ) : (
          // Crosshair / locate icon
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity=".3"/>
            <circle cx="12" cy="12" r="8" strokeOpacity=".4"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {/* Accuracy label when location is known */}
      {myLocation && (
        <div
          style={{ position: 'absolute', left: 52, top: 88, zIndex: 1000 }}
          className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] font-mono text-gray-600 shadow-sm pointer-events-none"
        >
          {myLocation[0].toFixed(5)}, {myLocation[1].toFixed(5)}
        </div>
      )}
    </div>
  )
}
