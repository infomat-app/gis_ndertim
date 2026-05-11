'use client'

export type MapTool = 'select' | 'xy' | 'measure-dist' | 'measure-area' | 'buffer' | 'info'

interface Props {
  activeTool: MapTool | null
  onSelectTool: (tool: MapTool | null) => void
}

export default function MapToolbar({ activeTool, onSelectTool }: Props) {
  const tools: { id: MapTool; title: string; svg: React.ReactNode }[] = [
    {
      id: 'select',
      title: 'Selekto objekte',
      svg: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4l6 16 3-7 7-3z" fill="currentColor" fillOpacity="0.15"/>
          <path d="M4 4l6 16 3-7 7-3L4 4z"/>
        </svg>
      ),
    },
    {
      id: 'xy',
      title: 'Shko tek XY',
      svg: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
        </svg>
      ),
    },
    {
      id: 'measure-dist',
      title: 'Mat distancën',
      svg: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="2" y1="12" x2="22" y2="12"/>
          <line x1="2" y1="8" x2="2" y2="16"/>
          <line x1="22" y1="8" x2="22" y2="16"/>
          <line x1="12" y1="9" x2="12" y2="15"/>
        </svg>
      ),
    },
    {
      id: 'measure-area',
      title: 'Mat sipërfaqen',
      svg: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3L21.5 20H2.5z" fill="currentColor" fillOpacity="0.15"/>
        </svg>
      ),
    },
    {
      id: 'buffer',
      title: 'Buffer / Zonë',
      svg: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2"/>
          <circle cx="12" cy="12" r="9" strokeDasharray="3 2.5"/>
        </svg>
      ),
    },
    {
      id: 'info',
      title: 'Info objekti',
      svg: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="2.5"/>
        </svg>
      ),
    },
  ]

  return (
    <div
      className="flex flex-col gap-0.5 p-1 bg-white/95 backdrop-blur-sm border border-b1 rounded-xl shadow-lg"
      style={{ position: 'absolute', top: 80, right: 8, zIndex: 1000 }}
    >
      {tools.map(t => (
        <button
          key={t.id}
          title={t.title}
          onClick={() => onSelectTool(activeTool === t.id ? null : t.id)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-95 ${
            activeTool === t.id
              ? 'bg-acc text-white shadow-sm'
              : 'text-txt2 hover:bg-s2 hover:text-txt'
          }`}
        >
          {t.svg}
        </button>
      ))}
    </div>
  )
}
