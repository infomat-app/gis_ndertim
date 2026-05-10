'use client'
import { useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  height?: number
}

export default function SignaturePad({ value, onChange, height = 100 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const getPos = (e: MouseEvent | { clientX: number; clientY: number }) => {
    const c = ref.current!
    const rect = c.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (c.width / rect.width),
      y: (e.clientY - rect.top) * (c.height / rect.height),
    }
  }

  useEffect(() => {
    if (value && ref.current) {
      const img = new Image()
      img.onload = () => ref.current?.getContext('2d')?.drawImage(img, 0, 0)
      img.src = value
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ctx = () => {
    const c = ref.current!.getContext('2d')!
    c.strokeStyle = '#1e293b'; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round'
    return c
  }

  const begin = (pos: { x: number; y: number }) => { ctx().beginPath(); ctx().moveTo(pos.x, pos.y) }
  const draw  = (pos: { x: number; y: number }) => { const c = ctx(); c.lineTo(pos.x, pos.y); c.stroke() }
  const end   = () => { drawing.current = false; onChange(ref.current?.toDataURL() ?? '') }

  return (
    <div className="border border-b1 rounded-lg overflow-hidden bg-white select-none">
      <canvas
        ref={ref} width={400} height={height}
        className="w-full touch-none block" style={{ cursor: 'crosshair' }}
        onMouseDown={e => { drawing.current = true; begin(getPos(e.nativeEvent)) }}
        onMouseMove={e => { if (!drawing.current) return; draw(getPos(e.nativeEvent)) }}
        onMouseUp={end} onMouseLeave={end}
        onTouchStart={e => { e.preventDefault(); drawing.current = true; begin(getPos(e.touches[0])) }}
        onTouchMove={e => { e.preventDefault(); if (!drawing.current) return; draw(getPos(e.touches[0])) }}
        onTouchEnd={end}
      />
      <button
        type="button"
        onClick={() => { ref.current!.getContext('2d')!.clearRect(0, 0, 400, height); onChange('') }}
        className="w-full text-[10px] font-mono text-txt3 py-0.5 border-t border-b1 hover:bg-s3 transition-colors"
      >
        Pastro
      </button>
    </div>
  )
}
