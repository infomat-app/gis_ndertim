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

// Small preview tile for each layer (fixed tile at z=6 for Albania area)
const PREVIEW_URL: Record<string, string> = {
  osm:              'https://tile.openstreetmap.org/6/37/23.png',
  google_streets:   'https://mt0.google.com/vt/lyrs=m&x=37&y=23&z=6',
  google_satellite: 'https://mt0.google.com/vt/lyrs=s&x=37&y=23&z=6',
  google_hybrid:    'https://mt0.google.com/vt/lyrs=y&x=37&y=23&z=6',
  google_terrain:   'https://mt0.google.com/vt/lyrs=p&x=37&y=23&z=6',
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
  const active = BASE_LAYERS.find(l => l.id === activeId)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    L.DomEvent.disableClickPropagation(containerRef.current)
    L.DomEvent.disableScrollPropagation(containerRef.current)
  }, [])

  return (
    <>
      <TileUpdater activeId={activeId} />

      <div ref={containerRef} className="absolute bottom-8 right-2 z-[1000]">
        <div className="relative flex flex-col items-end">

          {/* Dropdown panel — opens upward */}
          {open && (
            <div className="absolute bottom-full right-0 mb-2 bg-white border border-[#d4e2ff] rounded-2xl shadow-2xl overflow-hidden"
              style={{ width: 220 }}>
              <div className="px-3 pt-3 pb-2">
                <p className="text-[10px] font-mono text-[#7a96c0] uppercase tracking-widest mb-2">
                  Harta Bazë
                </p>
                <div className="space-y-1">
                  {BASE_LAYERS.map(bl => {
                    const isActive = bl.id === activeId
                    return (
                      <button
                        key={bl.id}
                        onClick={() => { onChange(bl.id); setOpen(false) }}
                        className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl transition-all text-left ${
                          isActive
                            ? 'bg-[#2563eb]/10 border border-[#2563eb]/30'
                            : 'hover:bg-[#eef3ff] border border-transparent'
                        }`}
                      >
                        {/* Tile preview image */}
                        <div className="w-10 h-8 rounded-lg overflow-hidden shrink-0 border border-[#d4e2ff]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={PREVIEW_URL[bl.id]}
                            alt={bl.label}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        </div>

                        <span className={`text-sm font-medium flex-1 ${
                          isActive ? 'text-[#2563eb]' : 'text-[#0f1e3c]'
                        }`}>
                          {bl.label}
                        </span>

                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="#2563eb" strokeWidth="2.5" className="shrink-0">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Toggle button */}
          <button
            onClick={() => setOpen(o => !o)}
            className={`flex items-center gap-2 pl-2 pr-3 py-2 rounded-xl shadow-lg border text-xs font-mono transition-all ${
              open
                ? 'bg-white border-[#2563eb]/50 text-[#2563eb]'
                : 'bg-white/95 backdrop-blur-sm border-[#d4e2ff] text-[#3d5a8a] hover:border-[#d4e2ff] hover:text-[#0f1e3c]'
            }`}
          >
            {/* Active layer mini preview */}
            <div className="w-7 h-5 rounded overflow-hidden border border-[#d4e2ff] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PREVIEW_URL[activeId]}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
            <span>{active?.label ?? 'Bazë'}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              className={`transition-transform ${open ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

        </div>
      </div>
    </>
  )
}
