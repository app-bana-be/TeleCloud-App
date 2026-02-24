'use client'

import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, FileRecord, Workspace, SidebarView, UploadJob } from '@/lib/types'

interface AppContextValue {
  user: User | null
  files: FileRecord[]
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  sidebarView: SidebarView
  selectedFiles: Set<string>
  uploadJobs: UploadJob[]
  isLoading: boolean
  searchQuery: string
  setSidebarView: (v: SidebarView) => void
  setCurrentWorkspace: (w: Workspace | null) => void
  setSelectedFiles: (s: Set<string>) => void
  setSearchQuery: (q: string) => void
  refreshFiles: () => Promise<void>
  refreshWorkspaces: () => Promise<void>
  addUploadJob: (job: UploadJob) => void
  updateUploadJob: (id: string, updates: Partial<UploadJob>) => void
  logout: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [files, setFiles] = useState<FileRecord[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [sidebarView, setSidebarView] = useState<SidebarView>('all')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then(({ user }) => {
        if (!user) {
          router.push('/login')
          return
        }
        setUser(user)
      })
      .catch(() => router.push('/login'))
  }, [router])

  const refreshFiles = useCallback(async () => {
    const params = new URLSearchParams()
    if (currentWorkspace) params.set('workspaceId', currentWorkspace.id)
    if (sidebarView === 'recent') params.set('view', 'recent')
    if (sidebarView === 'trash') params.set('view', 'trash')

    const res = await fetch(`/api/files?${params}`)
    const data = await res.json()
    setFiles(data.files || [])
    setIsLoading(false)
  }, [currentWorkspace, sidebarView])

  const refreshWorkspaces = useCallback(async () => {
    const res = await fetch('/api/workspaces')
    const data = await res.json()
    setWorkspaces(data.workspaces || [])
  }, [])

  useEffect(() => {
    if (user) {
      refreshFiles()
      refreshWorkspaces()
    }
  }, [user, refreshFiles, refreshWorkspaces])

  const addUploadJob = useCallback((job: UploadJob) => {
    setUploadJobs((prev) => [...prev, job])
  }, [])

  const updateUploadJob = useCallback((id: string, updates: Partial<UploadJob>) => {
    setUploadJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)))
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }, [router])

  return (
    <AppContext.Provider
      value={{
        user,
        files,
        workspaces,
        currentWorkspace,
        sidebarView,
        selectedFiles,
        uploadJobs,
        isLoading,
        searchQuery,
        setSidebarView,
        setCurrentWorkspace,
        setSelectedFiles,
        setSearchQuery,
        refreshFiles,
        refreshWorkspaces,
        addUploadJob,
        updateUploadJob,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
