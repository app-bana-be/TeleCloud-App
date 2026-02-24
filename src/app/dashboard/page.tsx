'use client'

import { useState, useMemo } from 'react'
import { Search, RefreshCw, Users, Grid, List } from 'lucide-react'
import { AppProvider, useApp } from '@/components/app-provider'
import { Sidebar } from '@/components/sidebar'
import { FileGrid } from '@/components/file-grid'
import { UploadZone } from '@/components/upload-zone'
import { StreamViewer } from '@/components/stream-viewer'
import { WorkspaceModal } from '@/components/workspace-modal'
import { FileRecord, Workspace } from '@/lib/types'

function DashboardContent() {
  const {
    files,
    isLoading,
    sidebarView,
    currentWorkspace,
    workspaces,
    searchQuery,
    setSearchQuery,
    refreshFiles,
  } = useApp()

  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null)
  const [workspaceModal, setWorkspaceModal] = useState<{
    mode: 'create' | 'manage'
    workspace?: Workspace
  } | null>(null)

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files
    const q = searchQuery.toLowerCase()
    return files.filter(
      (f) =>
        f.original_name.toLowerCase().includes(q) ||
        f.mime_type.toLowerCase().includes(q)
    )
  }, [files, searchQuery])

  const viewTitle = () => {
    if (currentWorkspace) return currentWorkspace.name
    switch (sidebarView) {
      case 'all': return 'All Files'
      case 'recent': return 'Recent'
      case 'trash': return 'Trash'
      default: return 'Files'
    }
  }

  return (
    <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-64 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <div className="absolute -top-40 left-1/3 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl" />
      </div>

      {/* Sidebar */}
      <Sidebar onCreateWorkspace={() => setWorkspaceModal({ mode: 'create' })} />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex-shrink-0 flex items-center gap-4 px-6 py-4 border-b border-white/8 backdrop-blur-sm bg-[#0a0a0f]/50">
          <div>
            <h1 className="text-white font-bold text-xl">{viewTitle()}</h1>
            <p className="text-slate-500 text-xs">
              {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {currentWorkspace && currentWorkspace.role === 'admin' && (
              <button
                onClick={() => setWorkspaceModal({ mode: 'manage', workspace: currentWorkspace })}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 hover:text-purple-300 text-sm font-medium transition-all"
              >
                <Users className="w-4 h-4" />
                Manage
              </button>
            )}
            <button
              onClick={refreshFiles}
              className="p-2 rounded-xl hover:bg-white/8 text-slate-400 hover:text-white transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="flex border border-white/10 rounded-xl overflow-hidden">
              <button className="p-2 bg-white/10 text-white">
                <Grid className="w-4 h-4" />
              </button>
              <button className="p-2 hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* File area with drag-and-drop */}
        <UploadZone>
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                <p className="text-slate-400 text-sm">Loading files...</p>
              </div>
            ) : (
              <FileGrid files={filteredFiles} onPreview={setPreviewFile} />
            )}
          </div>
        </UploadZone>
      </main>

      {/* Modals */}
      {previewFile && (
        <StreamViewer file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
      {workspaceModal && (
        <WorkspaceModal
          mode={workspaceModal.mode}
          workspace={workspaceModal.workspace}
          onClose={() => setWorkspaceModal(null)}
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <AppProvider>
      <DashboardContent />
    </AppProvider>
  )
}
