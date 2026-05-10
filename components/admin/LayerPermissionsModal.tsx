'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile, Layer, LayerPermLevel } from '@/lib/types'

const ROLE_DEFAULT: Record<string, LayerPermLevel> = {
  admin: 'edit', editor: 'edit', field: 'edit', viewer: 'view',
}

const PERM_OPTS = [
  { value: 'default', label: 'Auto',    title: 'Sipas rolit',    cls: 'bg-s3 text-txt2' },
  { value: 'none',    label: 'Asnjë',   title: 'E fshehur',      cls: 'bg-err text-white' },
  { value: 'view',    label: 'Shikim',  title: 'Vetëm lexim',    cls: 'bg-acc2 text-white' },
  { value: 'edit',    label: 'Editim',  title: 'Qasje e plotë',  cls: 'bg-acc text-white' },
] as const

interface Props {
  user: Profile
  layers: Layer[]
  onClose: () => void
}

export default function LayerPermissionsModal({ user, layers, onClose }: Props) {
  const supabase = createClient()
  const [perms,   setPerms]   = useState<Record<string, LayerPermLevel>>({})
  const [saving,  setSaving]  = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('layer_permissions')
      .select('layer_id, permission')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const m: Record<string, LayerPermLevel> = {}
        for (const p of data ?? []) m[p.layer_id] = p.permission as LayerPermLevel
        setPerms(m)
        setLoading(false)
      })
  }, [user.id]) // eslint-disable-line

  const setPerm = useCallback(async (layerId: string, val: LayerPermLevel | 'default') => {
    setSaving(layerId)
    if (val === 'default') {
      await supabase.from('layer_permissions').delete()
        .eq('layer_id', layerId).eq('user_id', user.id)
      setPerms(p => { const n = { ...p }; delete n[layerId]; return n })
    } else {
      await supabase.from('layer_permissions')
        .upsert({ layer_id: layerId, user_id: user.id, permission: val },
          { onConflict: 'layer_id,user_id' })
      setPerms(p => ({ ...p, [layerId]: val }))
    }
    setSaving(null)
  }, [user.id]) // eslint-disable-line

  const roleDefault = ROLE_DEFAULT[user.role] ?? 'view'
  const isAdmin     = user.role === 'admin'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-bg border border-b1 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col"
        style={{ maxHeight: '80vh' }}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-b1 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-b2 flex items-center justify-center shrink-0 text-sm font-bold font-mono text-txt2">
            {(user.full_name ?? user.email)[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-txt truncate">{user.full_name ?? user.email}</p>
            <p className="text-xs text-txt3 font-mono">
              Rol: <span className="text-txt2">{user.role}</span>
              {' · '}
              Parazgjedhje: <span className="text-txt2">{roleDefault === 'edit' ? 'Editim' : 'Vetëm shikim'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-txt3 hover:text-txt hover:bg-s3 transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Note */}
        {isAdmin ? (
          <div className="px-5 py-2.5 bg-err/5 border-b border-b1 shrink-0">
            <p className="text-[11px] text-err font-mono">
              Admini ka gjithmonë qasje të plotë — lejet specifike nuk zbatohen.
            </p>
          </div>
        ) : (
          <div className="px-5 py-2.5 bg-s2 border-b border-b1 shrink-0">
            <p className="text-[11px] text-txt3 font-mono">
              <span className="text-txt2 font-semibold">Auto</span> → zbaton rolin e parazgjedhur.
              Lejet specifike mbivendosin rolin për atë shtresë.
            </p>
          </div>
        )}

        {/* Layer list */}
        <div className="flex-1 overflow-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" className="animate-spin text-txt3">
                <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
              </svg>
            </div>
          ) : layers.length === 0 ? (
            <p className="text-xs text-txt3 font-mono text-center py-8">Nuk ka shtresa.</p>
          ) : (
            <div className="space-y-1">
              {layers.map(layer => {
                const current = perms[layer.id] ?? 'default'
                const isSaving = saving === layer.id
                return (
                  <div key={layer.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-s2 transition-colors">
                    {/* Layer color + name */}
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: layer.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-txt truncate">{layer.name}</p>
                      <p className="text-[10px] text-txt3 font-mono">{layer.geom_type}</p>
                    </div>

                    {/* Segmented permission control */}
                    <div className={`flex rounded-lg border border-b2 overflow-hidden text-[11px] font-mono shrink-0 ${
                      isSaving ? 'opacity-60 pointer-events-none' : ''
                    } ${isAdmin ? 'opacity-40 pointer-events-none' : ''}`}>
                      {PERM_OPTS.map(opt => {
                        const isActive = current === opt.value
                        return (
                          <button
                            key={opt.value}
                            title={opt.title}
                            onClick={() => setPerm(layer.id, opt.value as LayerPermLevel | 'default')}
                            className={`px-2.5 py-1.5 border-r border-b2 last:border-r-0 transition-all ${
                              isActive
                                ? opt.cls
                                : 'bg-s1 text-txt3 hover:bg-s2 hover:text-txt'
                            }`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-b1 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-txt3 font-mono">
            {Object.keys(perms).length} leje specifike të caktuara
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-acc text-white text-xs font-semibold hover:bg-[#1d4ed8] transition-colors"
          >
            Mbyll
          </button>
        </div>
      </div>
    </div>
  )
}
