'use client'
import { useState } from 'react'
import type { Layer } from '@/lib/types'

const GEOM_ICON: Record<string, string> = {
  Point:      '●',
  LineString: '—',
  Polygon:    '▬',
}

interface Props {
  open: boolean
  layers: Layer[]
  activeLayer: Layer | null
  canEdit: boolean
  isAdmin: boolean
  onToggle: () => void
  onSelectLayer: (l: Layer) => void
  onToggleVisibility: (id: string, v: boolean) => void
  onAddLayer: () => void
  onEditLayer: (l: Layer) => void
  onDeleteLayer: (id: string) => void
}

export default function LayerPanel({
  open, layers, activeLayer, canEdit, isAdmin,
  onToggle, onSelectLayer, onToggleVisibility,
  onAddLayer, onEditLayer, onDeleteLayer,
}: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null)

  return (
    <aside
      className={`flex flex-col bg-s1 border-r border-b1 shrink-0 transition-all duration-200 ${
        open ? 'w-72' : 'w-10'
      }`}
    >
      {/* Header */}
      <div className="h-10 flex items-center px-2 border-b border-b1 gap-2">
        {open && (
          <span className="text-[10px] font-mono text-txt3 tracking-widest uppercase flex-1">
            Shtresat
          </span>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded hover:bg-s3 text-txt2 transition-colors"
          title={open ? 'Mbyll panelin' : 'Hap panelin'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open
              ? <path d="M11 19l-7-7 7-7M19 19l-7-7 7-7"/>
              : <path d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
            }
          </svg>
        </button>
      </div>

      {open && (
        <>
          {/* Add layer button */}
          {canEdit && (
            <div className="p-2 border-b border-b1">
              <button
                onClick={onAddLayer}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-xs font-mono hover:bg-acc/20 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Shto Shtresë
              </button>
            </div>
          )}

          {/* Layer list */}
          <div className="flex-1 overflow-y-auto py-1">
            {layers.length === 0 && (
              <p className="text-xs text-txt3 font-mono text-center py-8 px-4">
                Nuk ka shtresa.<br/>Shto shtresën e parë.
              </p>
            )}
            {layers.map(layer => {
              const isActive = activeLayer?.id === layer.id
              return (
                <div
                  key={layer.id}
                  onMouseEnter={() => setHoverId(layer.id)}
                  onMouseLeave={() => setHoverId(null)}
                  className={`group flex items-center gap-2 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-all ${
                    isActive
                      ? 'bg-s4 border border-b2'
                      : 'hover:bg-s3 border border-transparent'
                  }`}
                >
                  {/* Visibility toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); onToggleVisibility(layer.id, !layer.visible) }}
                    className="shrink-0 text-txt3 hover:text-txt transition-colors"
                    title={layer.visible ? 'Fshih' : 'Shfaq'}
                  >
                    {layer.visible ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    )}
                  </button>

                  {/* Color dot + geom icon */}
                  <span
                    className="text-base shrink-0"
                    style={{ color: layer.color }}
                  >
                    {GEOM_ICON[layer.geom_type]}
                  </span>

                  {/* Name */}
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => canEdit && onSelectLayer(layer)}
                  >
                    <p className={`text-xs font-mono truncate ${layer.visible ? 'text-txt' : 'text-txt3 line-through'}`}>
                      {layer.name}
                    </p>
                    <p className="text-[10px] text-txt3">
                      {layer.geom_type}
                    </p>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <span className="text-[9px] font-mono text-acc bg-acc/10 border border-acc/30 px-1.5 py-0.5 rounded shrink-0">
                      AKTIV
                    </span>
                  )}

                  {/* Edit/Delete actions */}
                  {canEdit && (hoverId === layer.id || isActive) && (
                    <div className="flex gap-0.5 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); onEditLayer(layer) }}
                        className="p-1 rounded hover:bg-acc2/20 text-txt3 hover:text-acc2 transition-colors"
                        title="Edito shtresën"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); onDeleteLayer(layer.id) }}
                          className="p-1 rounded hover:bg-err/20 text-txt3 hover:text-err transition-colors"
                          title="Fshi shtresën"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer info */}
          <div className="px-3 py-2 border-t border-b1">
            <p className="text-[10px] text-txt3 font-mono">
              {layers.length} shtresa · {Object.values({}).length} objekte
            </p>
          </div>
        </>
      )}
    </aside>
  )
}
