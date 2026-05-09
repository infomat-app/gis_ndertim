'use client'
import { useState, useRef } from 'react'
import type { Layer, Feature } from '@/lib/types'
import LayerContextMenu from './LayerContextMenu'

const GEOM_ICON: Record<string, string> = {
  Point:      '●',
  LineString: '—',
  Polygon:    '▬',
}

interface Props {
  open: boolean
  layers: Layer[]
  features: Record<string, Feature[]>
  activeLayer: Layer | null
  canEdit: boolean
  isAdmin: boolean
  onToggle: () => void
  onSelectLayer: (l: Layer) => void
  onToggleVisibility: (id: string, v: boolean) => void
  onAddLayer: () => void
  onEditLayer: (l: Layer) => void
  onDeleteLayer: (id: string) => void
  onImport: () => void
  onZoomToLayer: (layerId: string) => void
  onAttributeTable: (layer: Layer) => void
  onRename: (layer: Layer) => void
  onExport: (layer: Layer, format: 'geojson' | 'csv' | 'xls' | 'kml' | 'shp') => void
}

export default function LayerPanel({
  open, layers, features, activeLayer, canEdit, isAdmin,
  onToggle, onSelectLayer, onToggleVisibility,
  onAddLayer, onEditLayer, onDeleteLayer, onImport,
  onZoomToLayer, onAttributeTable, onRename, onExport,
}: Props) {
  const [menuLayer, setMenuLayer] = useState<Layer | null>(null)
  const [menuPos,   setMenuPos]   = useState({ x: 0, y: 0 })
  const [renaming,  setRenaming]  = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  const openMenu = (e: React.MouseEvent, layer: Layer) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuPos({ x: rect.right + 4, y: rect.top })
    setMenuLayer(layer)
  }

  const startRename = (layer: Layer) => {
    setRenaming(layer.id)
    setRenameVal(layer.name)
    setTimeout(() => renameRef.current?.select(), 50)
  }

  const commitRename = (layer: Layer) => {
    if (renameVal.trim() && renameVal.trim() !== layer.name) {
      onRename({ ...layer, name: renameVal.trim() })
    }
    setRenaming(null)
  }

  const featureCount = (id: string) => features[id]?.length ?? '?'

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
          {/* Add layer + Import buttons */}
          {canEdit && (
            <div className="p-2 border-b border-b1 space-y-1.5">
              <button
                onClick={onAddLayer}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-xs font-mono hover:bg-acc/20 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Shto Shtresë
              </button>
              <button
                onClick={onImport}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-acc2/10 border border-acc2/30 text-acc2 text-xs font-mono hover:bg-acc2/20 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Import (GeoJSON/CSV/KML/SHP)
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
              const isRenam  = renaming === layer.id
              return (
                <div
                  key={layer.id}
                  className={`group flex items-center gap-2 px-2 py-2 mx-1 rounded-lg transition-all ${
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

                  {/* Color dot */}
                  <span className="text-base shrink-0" style={{ color: layer.color }}>
                    {GEOM_ICON[layer.geom_type]}
                  </span>

                  {/* Name + meta */}
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => canEdit && !isRenam && onSelectLayer(layer)}
                  >
                    {isRenam ? (
                      <input
                        ref={renameRef}
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onBlur={() => commitRename(layer)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename(layer)
                          if (e.key === 'Escape') setRenaming(null)
                        }}
                        className="w-full bg-bg border border-acc rounded px-1.5 py-0.5 text-xs text-txt outline-none font-mono"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <p className={`text-xs font-mono truncate ${layer.visible ? 'text-txt' : 'text-txt3 line-through'}`}>
                          {layer.name}
                        </p>
                        <p className="text-[10px] text-txt3">
                          {featureCount(layer.id)} obj · {layer.geom_type.toLowerCase()}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Active badge */}
                  {isActive && !isRenam && (
                    <span className="text-[9px] font-mono text-acc bg-acc/10 border border-acc/30 px-1.5 py-0.5 rounded shrink-0">
                      AKTIV
                    </span>
                  )}

                  {/* Three-dot menu button */}
                  {!isRenam && (
                    <button
                      onClick={e => openMenu(e, layer)}
                      className="shrink-0 p-1 rounded hover:bg-b2 text-txt3 hover:text-txt transition-colors opacity-0 group-hover:opacity-100"
                      title="Veprime"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="5" r="1" fill="currentColor"/>
                        <circle cx="12" cy="12" r="1" fill="currentColor"/>
                        <circle cx="12" cy="19" r="1" fill="currentColor"/>
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer info */}
          <div className="px-3 py-2 border-t border-b1">
            <p className="text-[10px] text-txt3 font-mono">
              {layers.length} shtresa
            </p>
          </div>
        </>
      )}

      {/* Context menu */}
      {menuLayer && (
        <LayerContextMenu
          layer={menuLayer}
          position={menuPos}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onClose={() => setMenuLayer(null)}
          onZoom={() => onZoomToLayer(menuLayer.id)}
          onAttributeTable={() => onAttributeTable(menuLayer)}
          onStyle={() => onEditLayer(menuLayer)}
          onExport={fmt => onExport(menuLayer, fmt)}
          onEditFields={() => onEditLayer(menuLayer)}
          onRename={() => startRename(menuLayer)}
          onToggleVisibility={() => onToggleVisibility(menuLayer.id, !menuLayer.visible)}
          onDelete={() => { if (confirm('Fshi shtresën dhe të gjitha objektet e saj?')) onDeleteLayer(menuLayer.id) }}
        />
      )}
    </aside>
  )
}
