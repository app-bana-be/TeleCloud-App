'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle, AlertCircle, Loader2, CloudUpload } from 'lucide-react'
import { useApp } from './app-provider'
import { formatBytes, cn } from '@/lib/utils-telecloud'
import { UploadJob } from '@/lib/types'

export function UploadZone({ children }: { children: React.ReactNode }) {
  const { currentWorkspace, addUploadJob, updateUploadJob, refreshFiles } = useApp()
  const [isDragOver, setIsDragOver] = useState(false)

  const uploadFile = useCallback(
    async (file: File) => {
      const jobId = `${Date.now()}-${Math.random()}`
      const job: UploadJob = {
        id: jobId,
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'pending',
      }
      addUploadJob(job)

      try {
        updateUploadJob(jobId, { status: 'uploading', progress: 0 })

        const formData = new FormData()
        formData.append('file', file)
        if (currentWorkspace) {
          formData.append('workspaceId', currentWorkspace.id)
        }

        // Simulate progress (real progress would need chunked upload with SSE)
        const progressInterval = setInterval(() => {
          updateUploadJob(jobId, {
            progress: Math.min(
              90,
              (job.progress || 0) + Math.random() * 15
            ),
          })
        }, 500)

        const res = await fetch('/api/files', { method: 'POST', body: formData })
        clearInterval(progressInterval)

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Upload failed')
        }

        updateUploadJob(jobId, { status: 'done', progress: 100 })
        await refreshFiles()
      } catch (e: unknown) {
        updateUploadJob(jobId, {
          status: 'error',
          error: e instanceof Error ? e.message : 'Upload failed',
        })
      }
    },
    [currentWorkspace, addUploadJob, updateUploadJob, refreshFiles]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setIsDragOver(false)
      acceptedFiles.forEach(uploadFile)
    },
    [uploadFile]
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
    noClick: true,
    noKeyboard: true,
  })

  return (
    <div {...getRootProps()} className="relative flex-1 min-h-0">
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-50 bg-blue-600/20 backdrop-blur-sm border-2 border-dashed border-blue-500/60 rounded-2xl flex flex-col items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-4 animate-bounce">
            <CloudUpload className="w-10 h-10 text-blue-400" />
          </div>
          <p className="text-blue-300 font-semibold text-xl">Drop files to upload</p>
          <p className="text-blue-400/70 text-sm mt-1">Files will be stored on Telegram</p>
        </div>
      )}

      {children}

      {/* Upload button */}
      <UploadButton onOpen={open} isDragOver={isDragOver} />
    </div>
  )
}

function UploadButton({ onOpen, isDragOver }: { onOpen: () => void; isDragOver: boolean }) {
  const { uploadJobs } = useApp()
  const activeJobs = uploadJobs.filter((j) => j.status === 'uploading' || j.status === 'pending')
  const [showJobs, setShowJobs] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {/* Upload jobs panel */}
      {showJobs && uploadJobs.length > 0 && (
        <div className="bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-80 shadow-2xl max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">Transfers</h3>
            <button
              onClick={() => setShowJobs(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {uploadJobs.slice(-10).map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {activeJobs.length > 0 && (
          <button
            onClick={() => setShowJobs(!showJobs)}
            className="flex items-center gap-2 bg-[#1a1a2e]/90 border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-medium backdrop-blur-xl hover:bg-white/10 transition-all"
          >
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            {activeJobs.length} uploading
          </button>
        )}
        <button
          onClick={onOpen}
          className={cn(
            'flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white shadow-2xl transition-all duration-200',
            isDragOver
              ? 'bg-blue-500 shadow-blue-500/40 scale-105'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-blue-500/20 hover:scale-105'
          )}
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>
    </div>
  )
}

function JobRow({ job }: { job: UploadJob }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">
        {job.status === 'done' && <CheckCircle className="w-4 h-4 text-green-400" />}
        {job.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
        {(job.status === 'uploading' || job.status === 'pending') && (
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{job.name}</p>
        <div className="flex items-center gap-2 mt-1">
          {job.status === 'uploading' && (
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          )}
          <span className="text-xs text-slate-500">
            {job.status === 'error' ? job.error : formatBytes(job.size)}
          </span>
        </div>
      </div>
    </div>
  )
}
