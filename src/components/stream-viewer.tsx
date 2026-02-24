'use client'

import { useState } from 'react'
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react'
import { FileRecord } from '@/lib/types'
import { formatBytes, getMimeCategory } from '@/lib/utils-telecloud'

interface StreamViewerProps {
  file: FileRecord
  onClose: () => void
}

export function StreamViewer({ file, onClose }: StreamViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const streamUrl = `/api/files/${file.id}/stream`
  const category = getMimeCategory(file.mime_type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-5xl bg-[#0f0f1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold truncate">{file.original_name}</h3>
            <p className="text-slate-400 text-xs mt-0.5">
              {formatBytes(file.size)} · {file.mime_type}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <a
              href={`/api/files/${file.id}`}
              download={file.original_name}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-slate-300 hover:text-white text-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/8 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative">
          {category === 'video' && (
            <div className="relative bg-black">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                    <p className="text-slate-400 text-sm">Streaming from Telegram...</p>
                  </div>
                </div>
              )}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={streamUrl}
                controls
                autoPlay
                muted={isMuted}
                className="w-full max-h-[70vh] bg-black"
                onLoadStart={() => setIsLoading(true)}
                onCanPlay={() => setIsLoading(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {/* Custom controls overlay */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 pb-4 pt-12 bg-gradient-to-t from-black/60">
                <button
                  onClick={() => {
                    const v = document.querySelector('video')
                    if (v) isPlaying ? v.pause() : v.play()
                  }}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    const v = document.querySelector('video')
                    v?.requestFullscreen?.()
                  }}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {category === 'audio' && (
            <div className="p-10 flex flex-col items-center gap-6">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                <Volume2 className="w-16 h-16 text-pink-400" />
              </div>
              <p className="text-white font-semibold text-xl text-center">{file.original_name}</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio src={streamUrl} controls className="w-full max-w-md" onCanPlay={() => setIsLoading(false)} />
            </div>
          )}

          {category === 'image' && (
            <div className="flex items-center justify-center p-4 bg-black/30 min-h-[400px]">
              {isLoading && (
                <div className="absolute flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={streamUrl}
                alt={file.original_name}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                onLoad={() => setIsLoading(false)}
              />
            </div>
          )}

          {category === 'pdf' && (
            <div className="flex flex-col items-center justify-center p-10 gap-4">
              <div className="w-20 h-20 rounded-2xl bg-red-500/15 flex items-center justify-center">
                <FileText className="w-10 h-10 text-red-400" />
              </div>
              <p className="text-white font-semibold">{file.original_name}</p>
              <p className="text-slate-400 text-sm">PDF streaming coming soon</p>
              <a
                href={`/api/files/${file.id}`}
                download={file.original_name}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" /> Download to View
              </a>
            </div>
          )}

          {(category === 'file' || category === 'archive') && (
            <div className="flex flex-col items-center justify-center p-10 gap-4">
              <div className="w-20 h-20 rounded-2xl bg-blue-500/15 flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-blue-400" />
              </div>
              <p className="text-white font-semibold">{file.original_name}</p>
              <p className="text-slate-400 text-sm">{formatBytes(file.size)}</p>
              <a
                href={`/api/files/${file.id}`}
                download={file.original_name}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" /> Download
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
