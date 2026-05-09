'use client'
import { useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef } from 'react'

export interface BaseLayer {
  id: string
  label: string
  url: string
  attribution: string
  maxZoom?: number
  subdomains?: string | string[]
}

export const BASE_LAYERS: BaseLayer[] = [
  {
    id: 'osm',
    label: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  },
  {
    id: 'google_streets',
    label: 'Google Maps',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    subdomains: '0123',
    maxZoom: 22,
  },
  {
    id: 'google_satellite',
    label: 'Google Satellite',
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Satellite',
    subdomains: '0123',
    maxZoom: 22,
  },
  {
    id: 'google_hybrid',
    label: 'Google Hybrid',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Hybrid',
    subdomains: '0123',
    maxZoom: 22,
  },
  {
    id: 'google_terrain',
    label: 'Google Terrain',
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Terrain',
    subdomains: '0123',
    maxZoom: 22,
  },
]

// Thumbnail preview colors for each layer
const LAYER_THUMBS: Record<string, { bg: string; label: string }> = {
  osm:              { bg: '#a8d5a2', label: 'OSM' },
  google_streets:   { bg: '#e8e0d8', label: 'Map' },
  google_satellite: { bg: '#2a4a2a', label: 'SAT' },
  google_hybrid:    { bg: '#3a5a3a', label: 'HYB' },
  google_terrain:   { bg: '#c8b870', label: 'TER' },
}

// Inner component: manages the single base tile layer imperatively
function TileUpdater({ activeId }: { activeId: string }) {
  const map     = useMap()
  const tileRef = useRef<L.TileLayer | null>(null)

  useEffect(() => {
    const bl = BASE_LAYERS.find(l => l.id === activeId)
    if (!bl) return

    // Remove ALL existing tile layers (including the react-leaflet TileLayer)
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer)
    })

    const layer = L.tileLayer(bl.url, {
      attribution: bl.attribution,
      maxZoom: bl.maxZoom ?? 19,
      subdomains: bl.subdomains ?? 'abc',
      crossOrigin: true,
    })
    layer.addTo(map)
    layer.bringToBack()
    tileRef.current = layer
  }, [activeId, map])

  return null
}

interface Props {
  activeId: string
  onChange: (id: string) => void
}

export default function BaseLayerControl({ activeId, onChange }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <TileUpdater activeId={activeId} />

      {/* Control button — bottom-right of map */}
      <div className="absolute bottom-8 right-2 z-[1000]">
        <div className="relative flex flex-col items-end">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-2 bg-s1/95 backdrop-blur-sm border border-b2 rounded-xl shadow-lg text-xs font-mono text-txt2 hover:text-txt hover:border-b3 transition-colors"
            title="Ndrysho hartën bazë"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/>
              <line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
            <span>{BASE_LAYERS.find(l => l.id === activeId)?.label ?? 'Bazë'}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {open && (
            <div className="absolute bottom-full right-0 mb-1.5 bg-s1/98 backdrop-blur-sm border border-b1 rounded-xl shadow-2xl overflow-hidden w-48">
              {BASE_LAYERS.map(bl => {
                const thumb = LAYER_THUMBS[bl.id]
                const active = bl.id === activeId
                return (
                  <button
                    key={bl.id}
                    onClick={() => { onChange(bl.id); setOpen(false) }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-mono transition-colors text-left ${
                      active
                        ? 'bg-acc/15 text-acc'
                        : 'text-txt2 hover:bg-s3 hover:text-txt'
                    }`}
                  >
                    {/* Mini thumbnail */}
                    <div
                      className="w-8 h-6 rounded shrink-0 flex items-center justify-center text-[8px] font-bold"
                      style={{ background: thumb.bg, color: active ? '#fff' : '#333' }}
                    >
                      {thumb.label}
                    </div>
                    <span>{bl.label}</span>
                    {active && (
                      <svg className="ml-auto shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
