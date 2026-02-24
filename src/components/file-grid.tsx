'use client'

import { useState } from 'react'
import {
  FileText,
  Film,
  Music,
  Image,
  Archive,
  File,
  Download,
  Trash2,
  Play,
  MoreHorizontal,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react'
import { FileRecord } from '@/lib/types'
import { formatBytes, formatDate, getMimeCategory, isStreamable, cn } from '@/lib/utils-telecloud'
import { useApp } from './app-provider'

interface FileGridProps {
  files: FileRecord[]
  onPreview: (file: FileRecord) => void
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const cat = getMimeCategory(mimeType)
  const props = { className: cn('flex-shrink-0', className) }
  switch (cat) {
    case 'video': return <Film {...props} />
    case 'audio': return <Music {...props} />
    case 'image': return <Image {...props} />
    case 'pdf': return <FileText {...props} />
    case 'archive': return <Archive {...props} />
    default: return <File {...props} />
  }
}

function fileIconColor(mimeType: string): string {
  const cat = getMimeCategory(mimeType)
  switch (cat) {
    case 'video': return 'text-purple-400 bg-purple-500/15'
    case 'audio': return 'text-pink-400 bg-pink-500/15'
    case 'image': return 'text-green-400 bg-green-500/15'
    case 'pdf': return 'text-red-400 bg-red-500/15'
    case 'archive': return 'text-yellow-400 bg-yellow-500/15'
    default: return 'text-blue-400 bg-blue-500/15'
  }
}

export function FileGrid({ files, onPreview }: FileGridProps) {
  const { selectedFiles, setSelectedFiles, refreshFiles } = useApp()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const toggleSelect = (fileId: string) => {
    const next = new Set(selectedFiles)
    if (next.has(fileId)) next.delete(fileId)
    else next.add(fileId)
    setSelectedFiles(next)
  }

  const handleDelete = async (fileId: string) => {
    setActionLoading(fileId)
    setOpenMenu(null)
    try {
      await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      await refreshFiles()
    } finally {
      setActionLoading(null)
    }
  }

  const handleDownload = (file: FileRecord) => {
    const a = document.createElement('a')
    a.href = `/api/files/${file.id}`
    a.download = file.original_name
    a.click()
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <File className="w-10 h-10 text-slate-600" />
        </div>
        <p className="text-slate-400 font-medium text-lg">No files here yet</p>
        <p className="text-slate-600 text-sm mt-1">Drop files anywhere to upload</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-1">
      {files.map((file) => {
        const isSelected = selectedFiles.has(file.id)
        const colors = fileIconColor(file.mime_type)
        const streamable = isStreamable(file.mime_type)
        const isUploading = file.status === 'uploading'

        return (
          <div
            key={file.id}
            className={cn(
              'group relative rounded-2xl border transition-all duration-200 cursor-pointer',
              isSelected
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-white/8 bg-white/4 hover:bg-white/8 hover:border-white/15'
            )}
            onClick={() => !isUploading && onPreview(file)}
          >
            {/* Selection checkbox */}
            <button
              className={cn(
                'absolute top-2 left-2 z-10 transition-opacity',
                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
              onClick={(e) => { e.stopPropagation(); toggleSelect(file.id) }}
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Context menu button */}
            <button
              className={cn(
                'absolute top-2 right-2 z-10 w-6 h-6 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center transition-opacity',
                openMenu === file.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
              onClick={(e) => {
                e.stopPropagation()
                setOpenMenu(openMenu === file.id ? null : file.id)
              }}
            >
              <MoreHorizontal className="w-3.5 h-3.5 text-white" />
            </button>

            {/* Dropdown menu */}
            {openMenu === file.id && (
              <div className="absolute top-9 right-2 z-20 bg-[#1a1a2e] border border-white/10 rounded-xl overflow-hidden shadow-2xl w-40 py-1">
                {streamable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(null); onPreview(file) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" /> Preview
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenMenu(null); handleDownload(file) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <hr className="border-white/10 my-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(file.id) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}

            {/* File icon / thumbnail */}
            <div className="p-5 pb-2">
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', colors)}>
                {isUploading ? (
                  <Loader2 className={cn('w-6 h-6 animate-spin', colors.split(' ')[0])} />
                ) : actionLoading === file.id ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                ) : (
                  <FileIcon mimeType={file.mime_type} className={cn('w-6 h-6', colors.split(' ')[0])} />
                )}
              </div>

              {/* Play overlay for streamable */}
              {streamable && !isUploading && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl bg-black/20">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                </div>
              )}
            </div>

            {/* File info */}
            <div className="px-3 pb-3">
              <p className="text-white text-xs font-medium truncate leading-snug">{file.original_name}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-500 text-xs">{formatBytes(file.size)}</span>
                <span className="text-slate-600 text-xs">{formatDate(file.created_at)}</span>
              </div>
              {isUploading && (
                <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
