'use client'
import { useState } from 'react'
import type { Layer, Feature } from '@/lib/types'

export interface FilterCondition {
  id: string
  fieldName: string
  operator: string
  value: string
}

export interface LayerFilter {
  conditions: FilterCondition[]
  logic: 'AND' | 'OR'
}

interface Props {
  layers: Layer[]
  features: Record<string, Feature[]>
  layerFilters: Record<string, LayerFilter>
  onFiltersChange: (filters: Record<string, LayerFilter>) => void
  onClose: () => void
}

const NUM_TYPES = ['number', 'formula', 'counter', 'gps_lat', 'gps_lng', 'gps_alt', 'gps_speed']
const BOOL_TYPES = ['boolean']
const SELECT_TYPES = ['select', 'radio', 'multiselect']

function getOperators(fieldType: string) {
  if (NUM_TYPES.includes(fieldType)) return [
    { value: 'eq',       label: '= barabartë' },
    { value: 'neq',      label: '≠ nuk barabartë' },
    { value: 'gt',       label: '> më i madh' },
    { value: 'gte',      label: '≥ m.i madh ose =' },
    { value: 'lt',       label: '< më i vogël' },
    { value: 'lte',      label: '≤ m.i vogël ose =' },
    { value: 'empty',    label: 'zbrazët' },
    { value: 'notempty', label: 'jo zbrazët' },
  ]
  if (BOOL_TYPES.includes(fieldType)) return [
    { value: 'eq',       label: '= barabartë' },
    { value: 'empty',    label: 'zbrazët' },
    { value: 'notempty', label: 'jo zbrazët' },
  ]
  return [
    { value: 'eq',         label: '= barabartë' },
    { value: 'neq',        label: '≠ nuk barabartë' },
    { value: 'contains',   label: 'përmban' },
    { value: 'notcontains',label: 'nuk përmban' },
    { value: 'empty',      label: 'zbrazët' },
    { value: 'notempty',   label: 'jo zbrazët' },
  ]
}

export function testCondition(props: Record<string, unknown>, cond: FilterCondition): boolean {
  const raw = props[cond.fieldName]
  const val = raw === null || raw === undefined ? '' : String(raw)
  const cv  = cond.value
  if (cond.operator === 'empty')      return val === '' || raw === null || raw === undefined
  if (cond.operator === 'notempty')   return val !== '' && raw !== null && raw !== undefined
  if (cond.operator === 'eq')         return val.toLowerCase() === cv.toLowerCase()
  if (cond.operator === 'neq')        return val.toLowerCase() !== cv.toLowerCase()
  if (cond.operator === 'contains')   return val.toLowerCase().includes(cv.toLowerCase())
  if (cond.operator === 'notcontains')return !val.toLowerCase().includes(cv.toLowerCase())
  const n = parseFloat(val), nc = parseFloat(cv)
  if (isNaN(n) || isNaN(nc)) return false
  if (cond.operator === 'gt')  return n > nc
  if (cond.operator === 'gte') return n >= nc
  if (cond.operator === 'lt')  return n < nc
  if (cond.operator === 'lte') return n <= nc
  return true
}

export default function FilterPanel({ layers, features, layerFilters, onFiltersChange, onClose }: Props) {
  const visibleLayers = layers.filter(l => l.visible && (l.fields?.length ?? 0) > 0)
  const [selectedLayerId, setSelectedLayerId] = useState<string>(visibleLayers[0]?.id ?? '')

  const selectedLayer = layers.find(l => l.id === selectedLayerId)
  const fields = (selectedLayer?.fields ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)

  const currentFilter: LayerFilter = layerFilters[selectedLayerId] ?? { conditions: [], logic: 'AND' }

  const updateFilter = (f: LayerFilter) => {
    if (!selectedLayerId) return
    const next = { ...layerFilters }
    if (f.conditions.length === 0) delete next[selectedLayerId]
    else next[selectedLayerId] = f
    onFiltersChange(next)
  }

  const addCondition = () => {
    if (!fields.length) return
    updateFilter({
      ...currentFilter,
      conditions: [...currentFilter.conditions, {
        id: Math.random().toString(36).slice(2),
        fieldName: fields[0].field_name,
        operator: 'eq',
        value: '',
      }],
    })
  }

  const updateCondition = (id: string, changes: Partial<FilterCondition>) =>
    updateFilter({ ...currentFilter, conditions: currentFilter.conditions.map(c => c.id === id ? { ...c, ...changes } : c) })

  const removeCondition = (id: string) =>
    updateFilter({ ...currentFilter, conditions: currentFilter.conditions.filter(c => c.id !== id) })

  const clearAll = () => {
    const next = { ...layerFilters }
    delete next[selectedLayerId]
    onFiltersChange(next)
  }

  const allFeats  = features[selectedLayerId] ?? []
  const total     = allFeats.length
  const matched   = currentFilter.conditions.length === 0
    ? total
    : allFeats.filter(feat => {
        const tests = currentFilter.conditions.map(c => testCondition(feat.properties, c))
        return currentFilter.logic === 'AND' ? tests.every(Boolean) : tests.some(Boolean)
      }).length

  const totalActiveFilters = Object.values(layerFilters).reduce((s, f) => s + f.conditions.length, 0)

  return (
    <div
      className="absolute z-[1001] bg-white/97 backdrop-blur-sm border border-b1 rounded-xl shadow-xl flex flex-col"
      style={{ top: 80, left: 8, width: 296, maxHeight: 'calc(100vh - 120px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-s2/60 border-b border-b1 shrink-0">
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-acc">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <span className="text-xs font-semibold text-txt">Filtri i Hartës</span>
          {totalActiveFilters > 0 && (
            <span className="text-[10px] bg-acc text-white rounded-full px-1.5 py-0.5 font-mono leading-none">{totalActiveFilters}</span>
          )}
        </div>
        <button onClick={onClose} className="text-txt2 hover:text-txt transition-colors p-0.5 rounded">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-3">

        {/* Layer selector */}
        <div>
          <label className="block text-[10px] text-txt2 font-mono mb-1 uppercase tracking-wide">Shtresa</label>
          {visibleLayers.length === 0 ? (
            <p className="text-[11px] text-txt3 italic py-1">Shfaqni shtresa me fusha për të filtruar.</p>
          ) : (
            <select
              value={selectedLayerId}
              onChange={e => setSelectedLayerId(e.target.value)}
              className="w-full border border-b1 rounded-lg px-2 py-1.5 text-xs bg-s1 text-txt focus:outline-none focus:border-acc"
            >
              {visibleLayers.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}{layerFilters[l.id]?.conditions.length ? ` ✦ ${layerFilters[l.id].conditions.length}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedLayer && fields.length === 0 && (
          <p className="text-[11px] text-txt3 italic text-center py-1">Kjo shtresë nuk ka fusha të definuara.</p>
        )}

        {selectedLayer && fields.length > 0 && (
          <>
            {/* Logic toggle — only when 2+ conditions */}
            {currentFilter.conditions.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-txt2 font-mono shrink-0">Logjika:</span>
                {(['AND', 'OR'] as const).map(lg => (
                  <button
                    key={lg}
                    onClick={() => updateFilter({ ...currentFilter, logic: lg })}
                    className={`px-2.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                      currentFilter.logic === lg ? 'bg-acc text-white border-acc' : 'text-txt2 border-b1 hover:bg-s2'
                    }`}
                  >{lg}</button>
                ))}
              </div>
            )}

            {/* Condition list */}
            <div className="flex flex-col gap-2">
              {currentFilter.conditions.map((cond, idx) => {
                const field    = fields.find(f => f.field_name === cond.fieldName)
                const ftype    = field?.field_type ?? 'text'
                const ops      = getOperators(ftype)
                const noValue  = cond.operator === 'empty' || cond.operator === 'notempty'

                return (
                  <div key={cond.id} className="bg-s2/60 rounded-lg p-2 flex flex-col gap-1.5 border border-b1">
                    {idx > 0 && (
                      <span className="text-[9px] text-acc font-bold font-mono uppercase self-start px-1 bg-acc/10 rounded">
                        {currentFilter.logic}
                      </span>
                    )}

                    {/* Row: field + delete */}
                    <div className="flex items-center gap-1">
                      <select
                        value={cond.fieldName}
                        onChange={e => updateCondition(cond.id, { fieldName: e.target.value, operator: 'eq', value: '' })}
                        className="flex-1 min-w-0 border border-b1 rounded px-1.5 py-1 text-[11px] bg-white text-txt focus:outline-none focus:border-acc"
                      >
                        {fields.map(f => (
                          <option key={f.field_name} value={f.field_name}>{f.field_label || f.field_name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeCondition(cond.id)}
                        className="shrink-0 text-txt3 hover:text-err transition-colors p-0.5"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>

                    {/* Operator */}
                    <select
                      value={cond.operator}
                      onChange={e => updateCondition(cond.id, { operator: e.target.value, value: '' })}
                      className="w-full border border-b1 rounded px-1.5 py-1 text-[11px] bg-white text-txt focus:outline-none focus:border-acc"
                    >
                      {ops.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>

                    {/* Value */}
                    {!noValue && (
                      BOOL_TYPES.includes(ftype) ? (
                        <select
                          value={cond.value}
                          onChange={e => updateCondition(cond.id, { value: e.target.value })}
                          className="w-full border border-b1 rounded px-1.5 py-1 text-[11px] bg-white text-txt focus:outline-none focus:border-acc"
                        >
                          <option value="true">Po (true)</option>
                          <option value="false">Jo (false)</option>
                        </select>
                      ) : SELECT_TYPES.includes(ftype) && (field?.field_options?.length ?? 0) > 0 ? (
                        <select
                          value={cond.value}
                          onChange={e => updateCondition(cond.id, { value: e.target.value })}
                          className="w-full border border-b1 rounded px-1.5 py-1 text-[11px] bg-white text-txt focus:outline-none focus:border-acc"
                        >
                          <option value="">— zgjedh —</option>
                          {field!.field_options!.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={NUM_TYPES.includes(ftype) ? 'number' : ftype === 'date' ? 'date' : 'text'}
                          placeholder="vlera..."
                          value={cond.value}
                          onChange={e => updateCondition(cond.id, { value: e.target.value })}
                          className="w-full border border-b1 rounded px-1.5 py-1 text-[11px] bg-white text-txt focus:outline-none focus:border-acc placeholder:text-txt3"
                        />
                      )
                    )}
                  </div>
                )
              })}
            </div>

            {/* Add condition */}
            <button
              onClick={addCondition}
              className="flex items-center gap-1.5 text-[11px] text-acc hover:text-acc/80 font-medium transition-colors self-start"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Shto kusht
            </button>

            {/* Result count + clear */}
            {currentFilter.conditions.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-b1">
                <span className="text-[11px] text-txt2">
                  <strong className="text-txt">{matched}</strong> / {total} objekte
                </span>
                <button
                  onClick={clearAll}
                  className="text-[10px] text-err hover:text-err/70 font-medium transition-colors"
                >
                  Pastro filtrin
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
