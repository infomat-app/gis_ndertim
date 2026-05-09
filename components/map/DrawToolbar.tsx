'use client'
import type { Layer } from '@/lib/types'

const GEOM_HINT: Record<string, string> = {
  Point:      'Klikoni në hartë për të shtuar pikë',
  LineString: 'Klikoni për të shtuar vertekse · 2x-klik për të mbaruar vijën',
  Polygon:    'Klikoni për të shtuar vertekse · 2x-klik për të mbyllur poligonin',
}

interface Props {
  layer: Layer
  drawingCoords: [number, number][]
  onGPS: () => void
  onStop: () => void
}

export default function DrawToolbar({ layer, drawingCoords, onGPS, onStop }: Props) {
  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-4 py-2.5 bg-s1/95 backdrop-blur-sm border border-b2 rounded-2xl shadow-2xl">
      {/* Layer color dot + name */}
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: layer.color }}
        />
        <span className="text-xs font-mono font-semibold text-txt">{layer.name}</span>
      </div>

      <div className="w-px h-4 bg-b2" />

      {/* Hint text */}
      <span className="text-xs text-txt2 font-mono hidden sm:block">
        {GEOM_HINT[layer.geom_type]}
      </span>

      {/* Vertex count for line/polygon */}
      {layer.geom_type !== 'Point' && drawingCoords.length > 0 && (
        <span className="text-[10px] font-mono text-warn bg-warn/10 border border-warn/30 px-2 py-0.5 rounded">
          {drawingCoords.length} pika
        </span>
      )}

      <div className="w-px h-4 bg-b2" />

      {/* GPS button */}
      {layer.geom_type === 'Point' && (
        <button
          onClick={onGPS}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-acc2/20 border border-acc2/40 text-acc2 text-xs font-mono hover:bg-acc2/30 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
          </svg>
          GPS
        </button>
      )}

      {/* Stop button */}
      <button
        onClick={onStop}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-err/10 border border-err/30 text-err text-xs font-mono hover:bg-err/20 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Ndalo
      </button>
    </div>
  )
}
