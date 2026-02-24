export interface User {
  id: string
  phone: string
  username?: string
  firstName?: string
  lastName?: string
  telegram_user_id?: number
}

export interface FileRecord {
  id: string
  name: string
  original_name: string
  mime_type: string
  size: number
  folder_id: string | null
  owner_id: string
  workspace_id: string | null
  telegram_message_ids: number[]
  telegram_file_ids: string[]
  is_chunked: boolean
  total_chunks: number
  status: 'uploading' | 'ready' | 'error' | 'deleted'
  thumbnail_url?: string
  created_at: string
  updated_at: string
  file_chunks?: ChunkRecord[]
}

export interface ChunkRecord {
  id: string
  file_id: string
  chunk_index: number
  telegram_message_id: number
  telegram_file_id: string
  sha256_hash: string
  size: number
  status: string
}

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  owner_id: string
  workspace_id: string | null
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  description?: string
  admin_id: string
  telegram_channel_id?: number
  invite_code: string
  created_at: string
  role?: 'admin' | 'member'
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  users?: User
}

export type SidebarView = 'all' | 'recent' | 'trash' | 'workspace'

export interface UploadJob {
  id: string
  file: File
  name: string
  size: number
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}
