'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export interface LightboxImage {
  url: string
  filename?: string
}

interface ImageLightboxProps {
  images: LightboxImage[]
  initialIndex?: number
  open: boolean
  onClose: () => void
}

export function ImageLightbox({ images, initialIndex = 0, open, onClose }: ImageLightboxProps) {
  const [idx, setIdx] = useState(initialIndex)

  // Sync index when caller changes initialIndex
  useEffect(() => { setIdx(initialIndex) }, [initialIndex, open])

  const current = images[idx]
  if (!current) return null

  function prev(e: React.MouseEvent) { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)) }
  function next(e: React.MouseEvent) { e.stopPropagation(); setIdx((i) => Math.min(images.length - 1, i + 1)) }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] p-0 bg-black/90 border-none overflow-hidden flex items-center justify-center">
        <DialogTitle className="sr-only">{current.filename ?? 'Image preview'}</DialogTitle>

        {/* Close */}
        <button
          className="absolute top-3 right-3 z-20 bg-black/50 hover:bg-black/80 rounded-full p-1.5 text-white transition-colors"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Prev */}
        {images.length > 1 && idx > 0 && (
          <button
            className="absolute left-3 z-20 bg-black/50 hover:bg-black/80 rounded-full p-2 text-white transition-colors"
            onClick={prev}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {/* Image */}
        <div className="flex items-center justify-center w-full h-full p-6 min-h-[40vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.filename ?? 'Image'}
            className="max-w-full max-h-[85vh] object-contain rounded select-none"
            draggable={false}
          />
        </div>

        {/* Next */}
        {images.length > 1 && idx < images.length - 1 && (
          <button
            className="absolute right-3 z-20 bg-black/50 hover:bg-black/80 rounded-full p-2 text-white transition-colors"
            onClick={next}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {/* Filename */}
        {current.filename && (
          <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
            <span className="text-white/60 text-xs bg-black/40 px-2 py-0.5 rounded">{current.filename}</span>
          </div>
        )}

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {images.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/35'}`}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Convenience hook
export function useLightbox() {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [images, setImages] = useState<LightboxImage[]>([])

  function openAt(imgs: LightboxImage[], i: number) {
    setImages(imgs)
    setIndex(i)
    setOpen(true)
  }

  function close() { setOpen(false) }

  return { open, index, images, openAt, close }
}
