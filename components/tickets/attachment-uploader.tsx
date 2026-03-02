'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileImage, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Image from 'next/image'

export interface UploadedFile {
  id?: string
  filename: string
  url: string
  size: number
  mime_type: string
  isNew?: boolean
  path?: string
}

interface AttachmentUploaderProps {
  ticketId?: string
  value: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  disabled?: boolean
  maxFiles?: number
}

export function AttachmentUploader({
  ticketId,
  value,
  onChange,
  disabled,
  maxFiles = 5,
}: AttachmentUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function uploadFile(file: File): Promise<UploadedFile | null> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const folder = ticketId ?? 'temp'
    const path = `${folder}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { error } = await supabase.storage
      .from('ticket-attachments')
      .upload(path, file, { contentType: file.type })

    if (error) {
      toast.error(`Failed to upload ${file.name}`, { description: error.message })
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('ticket-attachments')
      .getPublicUrl(path)

    return {
      filename: file.name,
      url: publicUrl,
      size: file.size,
      mime_type: file.type,
      isNew: true,
      path,
    }
  }

  async function handleFiles(files: FileList) {
    if (value.length >= maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`)
      return
    }

    const toUpload = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, maxFiles - value.length)

    if (toUpload.length === 0) {
      toast.error('Only image files are allowed')
      return
    }

    setUploading(true)
    const uploaded: UploadedFile[] = []

    for (const file of toUpload) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`)
        continue
      }
      const result = await uploadFile(file)
      if (result) uploaded.push(result)
    }

    onChange([...value, ...uploaded])
    setUploading(false)
  }

  async function removeFile(index: number) {
    const file = value[index]
    if (file.path) {
      await supabase.storage.from('ticket-attachments').remove([file.path])
    }
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30',
          (disabled || uploading || value.length >= maxFiles) && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => !disabled && !uploading && value.length < maxFiles && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled && !uploading) handleFiles(e.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-6 w-6" />
            <div>
              <p className="text-sm font-medium">Drop screenshots here</p>
              <p className="text-xs">or click to browse — images only, max 10MB each</p>
            </div>
            <p className="text-xs">
              {value.length}/{maxFiles} files
            </p>
          </div>
        )}
      </div>

      {/* Previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {value.map((file, index) => (
            <div
              key={index}
              className="relative group rounded-lg border overflow-hidden bg-muted"
            >
              {file.mime_type?.startsWith('image/') ? (
                <div className="aspect-video relative">
                  <Image
                    src={file.url}
                    alt={file.filename}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center">
                  <FileImage className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs truncate text-muted-foreground">{file.filename}</p>
              </div>
              {!disabled && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFile(index)}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
