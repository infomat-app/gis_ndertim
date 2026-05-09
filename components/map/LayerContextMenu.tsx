'use client'
import { useEffect, useRef } from 'react'
import type { Layer } from '@/lib/types'

interface Props {
  layer: Layer
  position: { x: number; y: number }
  canEdit: boolean
  isAdmin: boolean
  onClose: () => void
  onZoom: () => void
  onAttributeTable: () => void
  onStyle: () => void
  onExport: (format: 'geojson' | 'csv' | 'xls' | 'kml' | 'shp') => void
  onEditFields: () => void
  onRename: () => void
  onToggleVisibility: () => void
  onDelete: () => void
}

const Divider = () => <div className="my-1 border-t border-b1" />

function MenuItem({
  icon, label, onClick, danger, disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-mono transition-colors text-left rounded-lg ${
        danger
          ? 'text-err hover:bg-err/10 disabled:opacity-40'
          : 'text-txt2 hover:bg-s3 hover:text-txt disabled:opacity-40'
      }`}
    >
      <span className="shrink-0 w-4 flex items-center justify-center">{icon}</span>
      {label}
    </button>
  )
}

export default function LayerContextMenu({
  layer, position, canEdit, isAdmin, onClose,
  onZoom, onAttributeTable, onStyle,
  onExport, onEditFields, onRename,
  onToggleVisibility, onDelete,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handleKey) }
  }, [onClose])

  // Adjust position so menu doesn't go off-screen
  const style: React.CSSProperties = {
    position: 'fixed',
    top: position.y,
    left: position.x,
    zIndex: 9999,
  }

  return (
    <div ref={ref} style={style}
      className="w-52 bg-s1 border border-b2 rounded-xl shadow-2xl py-1.5 px-1.5"
    >
      {/* Group 1: View */}
      <MenuItem
        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
        label="Zoom tek shtresa"
        onClick={() => { onZoom(); onClose() }}
      />
      <MenuItem
        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>}
        label="Tabela Atributeve"
        onClick={() => { onAttributeTable(); onClose() }}
      />
      {canEdit && (
        <MenuItem
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>}
          label="Stilo"
          onClick={() => { onStyle(); onClose() }}
        />
      )}

      <Divider />

      {/* Group 2: Export */}
      {(['geojson','csv','xls','kml','shp'] as const).map(fmt => {
        const labels: Record<string, string> = { geojson: 'Eksporto GeoJSON', csv: 'Eksporto CSV', xls: 'Eksporto XLS', kml: 'Eksporto KML', shp: 'Eksporto Shapefile' }
        return (
          <MenuItem
            key={fmt}
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
            label={labels[fmt]}
            onClick={() => { onExport(fmt); onClose() }}
          />
        )
      })}

      {canEdit && (
        <>
          <Divider />
          {/* Group 3: Edit */}
          <MenuItem
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
            label="Edito fushat"
            onClick={() => { onEditFields(); onClose() }}
          />
          <MenuItem
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
            label="Riemërto"
            onClick={() => { onRename(); onClose() }}
          />
        </>
      )}

      <Divider />

      {/* Group 4: Visibility + Delete */}
      <MenuItem
        icon={layer.visible
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        }
        label={layer.visible ? 'Largo nga hartë' : 'Shfaq në hartë'}
        onClick={() => { onToggleVisibility(); onClose() }}
      />
      {isAdmin && (
        <MenuItem
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>}
          label="Fshi shtresën"
          onClick={() => { onDelete(); onClose() }}
          danger
        />
      )}
    </div>
  )
}
