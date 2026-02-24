'use client'

import {
  Cloud,
  Files,
  Clock,
  Trash2,
  Users,
  Plus,
  ChevronRight,
  LogOut,
  Settings,
  HardDrive,
} from 'lucide-react'
import { useApp } from './app-provider'
import { cn } from '@/lib/utils-telecloud'

export function Sidebar({ onCreateWorkspace }: { onCreateWorkspace: () => void }) {
  const {
    user,
    workspaces,
    sidebarView,
    currentWorkspace,
    setSidebarView,
    setCurrentWorkspace,
    logout,
  } = useApp()

  const navItems = [
    { id: 'all', label: 'All Files', icon: Files },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ] as const

  const displayName =
    user?.firstName ||
    user?.username ||
    user?.phone?.slice(-4) ||
    'User'

  return (
    <aside className="w-64 h-screen flex flex-col bg-white/3 border-r border-white/8 backdrop-blur-xl">
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-white/8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
          <Cloud className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-white font-bold text-lg tracking-tight">TeleCloud</span>
          <p className="text-slate-500 text-xs">Unlimited storage</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
          Storage
        </p>
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setSidebarView(id)
              setCurrentWorkspace(null)
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
              sidebarView === id && !currentWorkspace
                ? 'bg-blue-600/20 text-blue-400 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        ))}

        {/* Workspaces */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Workspaces
            </p>
            <button
              onClick={onCreateWorkspace}
              className="w-5 h-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              title="New workspace"
            >
              <Plus className="w-3 h-3 text-slate-300" />
            </button>
          </div>

          {workspaces.length === 0 ? (
            <button
              onClick={onCreateWorkspace}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all border border-dashed border-white/10"
            >
              <Plus className="w-3 h-3" />
              Create workspace
            </button>
          ) : (
            workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setCurrentWorkspace(ws)
                  setSidebarView('workspace')
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                  currentWorkspace?.id === ws.id
                    ? 'bg-purple-600/20 text-purple-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3 h-3 text-white" />
                </div>
                <span className="truncate flex-1 text-left">{ws.name}</span>
                {ws.role === 'admin' && (
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                    Admin
                  </span>
                )}
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))
          )}
        </div>
      </nav>

      {/* Storage indicator */}
      <div className="p-4 border-t border-white/8">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Unlimited via Telegram</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
        </div>

        {/* User */}
        <div className="mt-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">
              {displayName[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{displayName}</p>
            <p className="text-xs text-slate-500 truncate">{user?.phone}</p>
          </div>
          <div className="flex gap-1">
            <button className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
