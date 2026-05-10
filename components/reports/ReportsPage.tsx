'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { Layer, Feature, Profile } from '@/lib/types'
import Navbar from '@/components/ui/Navbar'

const MEDIA_TYPES = new Set(['photo', 'video', 'audio', 'signature', 'hidden'])
const GPS_TYPES   = new Set(['gps_lat', 'gps_lng', 'gps_alt', 'gps_speed', 'device_id', 'device_model'])

function fmtVal(val: unknown, type?: string): string {
  if (val == null || val === '') return '—'
  if (type === 'boolean') return val ? 'Po' : 'Jo'
  if (type === 'multiselect') {
    if (Array.isArray(val)) return val.join(', ')
    try { const a = JSON.parse(String(val)); return Array.isArray(a) ? a.join(', ') : String(val) }
    catch { return String(val) }
  }
  const s = String(val)
  if (s.startsWith('data:')) return '[Media]'
  return s
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ReportsPage({ profile }: { profile: Profile }) {
  const supabase = createClient()

  const [layers,     setLayers]     = useState<Layer[]>([])
  const [layerId,    setLayerId]    = useState('')
  const [features,   setFeatures]   = useState<Feature[]>([])
  const [loading,    setLoading]    = useState(false)
  const [filters,    setFilters]    = useState<Record<string, string>>({})
  const [exporting,  setExporting]  = useState<'xls' | 'pdf' | null>(null)

  useEffect(() => {
    supabase
      .from('layers')
      .select('*, fields:layer_fields(*)')
      .order('sort_order')
      .then(({ data }) => { if (data) setLayers(data) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!layerId) { setFeatures([]); setFilters({}); return }
    setLoading(true)
    setFilters({})
    supabase
      .from('features')
      .select('*, profile:profiles(full_name,email)')
      .eq('layer_id', layerId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setFeatures(data ?? []); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerId])

  const selectedLayer = useMemo(() => layers.find(l => l.id === layerId) ?? null, [layers, layerId])

  const columns = useMemo(() => {
    if (!selectedLayer?.fields?.length) return []
    return [...selectedLayer.fields]
      .filter(f => !MEDIA_TYPES.has(f.field_type) && !GPS_TYPES.has(f.field_type))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [selectedLayer])

  const filterableFields = useMemo(() =>
    columns.filter(f => ['text','number','select','radio','multiselect','textarea','date','username','boolean'].includes(f.field_type)),
    [columns])

  const filtered = useMemo(() => {
    return features.filter(f => {
      return Object.entries(filters).every(([key, val]) => {
        if (!val.trim()) return true
        const raw = key === '_perdoruesi_profile'
          ? (f.profile?.full_name ?? f.profile?.email ?? '')
          : String(f.properties?.[key] ?? '')
        return raw.toLowerCase().includes(val.trim().toLowerCase())
      })
    })
  }, [features, filters])

  const setFilter = useCallback((key: string, val: string) => {
    setFilters(prev => ({ ...prev, [key]: val }))
  }, [])

  const clearFilters = () => setFilters({})
  const hasFilters = Object.values(filters).some(v => v.trim())

  // ---- Export XLS ----
  const exportXLS = async () => {
    if (!selectedLayer || !filtered.length) return
    setExporting('xls')
    try {
      const { utils, write } = await import('xlsx')
      const headers = ['Nr', 'Data', 'Krijuar nga', ...columns.map(c => c.field_label)]
      const rows = filtered.map((f, i) => [
        i + 1,
        fmtDate(f.created_at),
        f.profile?.full_name ?? f.profile?.email ?? '—',
        ...columns.map(c => fmtVal(f.properties?.[c.field_name], c.field_type)),
      ])
      const ws = utils.aoa_to_sheet([headers, ...rows])
      // Column widths
      ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 5 : i < 3 ? 18 : 22 }))
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, selectedLayer.name.slice(0, 31))
      const buf = write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([buf], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `Raport_${selectedLayer.name}_${new Date().toISOString().slice(0,10)}.xlsx`
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setExporting(null) }
  }

  // ---- Export PDF ----
  const exportPDF = async () => {
    if (!selectedLayer || !filtered.length) return
    setExporting('pdf')
    try {
      const jsPDF    = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })

      // Header
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(`Raport: ${selectedLayer.name}`, 14, 16)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)
      doc.text(`Gjeneruar: ${new Date().toLocaleString('sq-AL')}  |  Rekorde: ${filtered.length}`, 14, 23)
      if (hasFilters) {
        const fStr = Object.entries(filters).filter(([,v]) => v.trim())
          .map(([k, v]) => `${k}: "${v}"`).join('  |  ')
        doc.text(`Filtrat: ${fStr}`, 14, 29)
      }

      autoTable(doc, {
        startY: hasFilters ? 34 : 28,
        head: [['Nr', 'Data', 'Krijuar nga', ...columns.map(c => c.field_label)]],
        body: filtered.map((f, i) => [
          i + 1,
          fmtDate(f.created_at),
          f.profile?.full_name ?? f.profile?.email ?? '—',
          ...columns.map(c => fmtVal(f.properties?.[c.field_name], c.field_type)),
        ]),
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 28 }, 2: { cellWidth: 30 } },
        margin: { left: 14, right: 14 },
      })

      doc.save(`Raport_${selectedLayer.name}_${new Date().toISOString().slice(0,10)}.pdf`)
    } finally { setExporting(null) }
  }

  return (
    <div className="flex flex-col h-screen bg-bg">
      <Navbar profile={profile} />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Top bar */}
        <div className="bg-s1 border-b border-b1 px-6 py-3 flex flex-wrap items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-acc">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span className="text-sm font-semibold text-txt">Raporte</span>
          </div>

          {/* Layer selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-txt2 font-mono shrink-0">Shtresa:</label>
            <select
              value={layerId}
              onChange={e => setLayerId(e.target.value)}
              className="border border-b1 rounded-lg px-3 py-1.5 text-sm bg-s1 text-txt focus:outline-none focus:border-acc min-w-[200px]"
            >
              <option value="">— Zgjidh shtresën —</option>
              {layers.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {selectedLayer && (
            <span className="text-xs font-mono text-txt2 bg-s2 border border-b1 rounded px-2 py-1">
              {loading ? 'Duke ngarkuar...' : `${filtered.length} / ${features.length} rekorde`}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {selectedLayer && filtered.length > 0 && (
              <>
                <button
                  onClick={exportXLS}
                  disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors active:scale-95"
                >
                  {exporting === 'xls' ? (
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeOpacity=".3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                  )}
                  XLS
                </button>
                <button
                  onClick={exportPDF}
                  disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors active:scale-95"
                >
                  {exporting === 'pdf' ? (
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeOpacity=".3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                  )}
                  PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filters bar */}
        {selectedLayer && filterableFields.length > 0 && (
          <div className="bg-s2/50 border-b border-b1 px-6 py-2.5 flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-txt2 shrink-0">Filtrat:</span>
            {filterableFields.map(f => (
              <div key={f.field_name} className="flex items-center gap-1">
                <span className="text-[10px] text-txt2 font-mono shrink-0">{f.field_label}:</span>
                <input
                  type="text"
                  placeholder="kërko..."
                  value={filters[f.field_name] ?? ''}
                  onChange={e => setFilter(f.field_name, e.target.value)}
                  className="border border-b1 rounded px-2 py-0.5 text-xs bg-s1 text-txt w-28 focus:outline-none focus:border-acc"
                />
              </div>
            ))}
            {/* Filtër për përdoruesin */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-txt2 font-mono shrink-0">Krijuar nga:</span>
              <input
                type="text"
                placeholder="kërko..."
                value={filters['_perdoruesi_profile'] ?? ''}
                onChange={e => setFilter('_perdoruesi_profile', e.target.value)}
                className="border border-b1 rounded px-2 py-0.5 text-xs bg-s1 text-txt w-28 focus:outline-none focus:border-acc"
              />
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-err hover:text-err/70 font-mono transition-colors ml-1">
                × Pastro
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {!layerId && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-b2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <p className="text-sm text-txt2">Zgjidh një shtresë për të parë raportin</p>
            </div>
          )}

          {layerId && loading && (
            <div className="flex items-center justify-center h-full gap-2 text-txt2">
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity=".3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
              </svg>
              <span className="text-sm font-mono">Duke ngarkuar...</span>
            </div>
          )}

          {layerId && !loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm text-txt2">
                {hasFilters ? 'Asnjë rekord nuk përputhet me filtrat.' : 'Kjo shtresë nuk ka rekorde.'}
              </p>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs text-acc hover:underline">Pastro filtrat</button>
              )}
            </div>
          )}

          {layerId && !loading && filtered.length > 0 && (
            <div className="rounded-xl border border-b1 overflow-hidden shadow-sm">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-acc text-white">
                    <th className="px-3 py-2.5 text-left font-semibold w-10 shrink-0">Nr</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Data</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Krijuar nga</th>
                    {columns.map(c => (
                      <th key={c.field_name} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">
                        {c.field_label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f, i) => (
                    <tr
                      key={f.id}
                      className={`border-t border-b1 transition-colors ${i % 2 === 0 ? 'bg-s1' : 'bg-s2/40'} hover:bg-acc/5`}
                    >
                      <td className="px-3 py-2 font-mono text-txt2">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-txt2 whitespace-nowrap">{fmtDate(f.created_at)}</td>
                      <td className="px-3 py-2 text-txt whitespace-nowrap">
                        {f.profile?.full_name ?? f.profile?.email ?? '—'}
                      </td>
                      {columns.map(c => (
                        <td key={c.field_name} className="px-3 py-2 text-txt max-w-[200px] truncate" title={fmtVal(f.properties?.[c.field_name], c.field_type)}>
                          {fmtVal(f.properties?.[c.field_name], c.field_type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
