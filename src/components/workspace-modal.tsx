'use client'

import { useState } from 'react'
import { X, Users, Plus, Mail, Crown, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Workspace, WorkspaceMember } from '@/lib/types'
import { useApp } from './app-provider'

interface WorkspaceModalProps {
  mode: 'create' | 'manage'
  workspace?: Workspace
  onClose: () => void
}

export function WorkspaceModal({ mode, workspace, onClose }: WorkspaceModalProps) {
  const { refreshWorkspaces } = useApp()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [membersLoaded, setMembersLoaded] = useState(false)

  const loadMembers = async () => {
    if (!workspace || membersLoaded) return
    const res = await fetch(`/api/workspaces/${workspace.id}/members`)
    const data = await res.json()
    setMembers(data.members || [])
    setMembersLoaded(true)
  }

  if (mode === 'manage' && workspace && !membersLoaded) {
    loadMembers()
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create')
      await refreshWorkspaces()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create workspace')
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!invitePhone.trim() || !workspace) return
    setInviteLoading(true)
    setError('')
    setInviteSuccess('')
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: invitePhone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to invite')
      setInviteSuccess(`${data.user?.first_name || invitePhone} added to workspace`)
      setInvitePhone('')
      setMembersLoaded(false)
      loadMembers()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to invite')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#0f0f1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold">
                {mode === 'create' ? 'New Workspace' : workspace?.name}
              </h2>
              <p className="text-slate-400 text-xs">
                {mode === 'create' ? 'Shared team storage' : 'Manage workspace'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {mode === 'create' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm text-slate-300 font-medium">Workspace Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Team Projects"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300 font-medium">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this workspace for?"
                  rows={2}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <button
                onClick={handleCreate}
                disabled={loading || !name.trim()}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Create Workspace</>}
              </button>
            </>
          ) : (
            <>
              {/* Invite */}
              {workspace?.role === 'admin' && (
                <div className="space-y-3">
                  <label className="text-sm text-slate-300 font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Invite by Phone Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      placeholder="+1 234 567 8900"
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                    />
                    <button
                      onClick={handleInvite}
                      disabled={inviteLoading || !invitePhone.trim()}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                    >
                      {inviteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Add
                    </button>
                  </div>
                  {inviteSuccess && (
                    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 text-sm text-green-400">
                      <CheckCircle className="w-4 h-4" /> {inviteSuccess}
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-sm text-red-400">
                      <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                  )}
                </div>
              )}

              {/* Members list */}
              <div className="space-y-2">
                <p className="text-sm text-slate-400 font-medium">Members ({members.length})</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">
                          {(m.users?.firstName || m.users?.phone || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {m.users?.firstName
                            ? `${m.users.firstName} ${m.users.lastName || ''}`
                            : m.users?.phone}
                        </p>
                        <p className="text-slate-500 text-xs truncate">{m.users?.phone}</p>
                      </div>
                      {m.role === 'admin' && (
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                          <Crown className="w-3 h-3" /> Admin
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
