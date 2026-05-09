'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  field: 'Field',
  viewer: 'Viewer',
}

const ROLE_COLORS: Record<string, string> = {
  admin:  'text-err   bg-err/10   border-err/30',
  editor: 'text-acc   bg-acc/10   border-acc/30',
  field:  'text-warn  bg-warn/10  border-warn/30',
  viewer: 'text-acc2  bg-acc2/10  border-acc2/30',
}

export default function Navbar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/map',   label: 'Harta',  roles: ['admin','editor','field','viewer'] },
    { href: '/admin', label: 'Admin',  roles: ['admin'] },
    { href: '/field', label: 'Terren', roles: ['admin','editor','field'] },
  ].filter(l => l.roles.includes(profile.role))

  return (
    <header className="h-12 bg-s1 border-b border-b1 flex items-center px-4 gap-4 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-6 h-6 rounded bg-acc/20 border border-acc/40 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2.5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2"/>
          </svg>
        </div>
        <span className="text-xs font-mono font-semibold text-acc tracking-wider">GIS NDËRTIM</span>
      </div>

      {/* Nav links */}
      <nav className="flex gap-1">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${
              pathname.startsWith(l.href)
                ? 'bg-acc text-[#05101e] font-semibold'
                : 'text-txt2 hover:text-txt hover:bg-s3'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {/* Role badge */}
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${ROLE_COLORS[profile.role]}`}>
          {ROLE_LABELS[profile.role]}
        </span>
        {/* User name */}
        <span className="text-xs text-txt2 font-mono hidden sm:block">
          {profile.full_name ?? profile.email}
        </span>
        {/* Logout */}
        <button
          onClick={logout}
          className="text-xs text-txt3 hover:text-err font-mono transition-colors"
          title="Dil"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
