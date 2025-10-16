'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthGuard } from '@/components/AuthGuard'
import { useAuth } from '@/hooks/useAuth'
import { AppOnlineUsers } from '@/components/AppOnlineUsers'
import { DocumentCard, Document } from '@/components/DocumentCard'
import { getShortName } from '@/lib/userUtils'
import { useAppPresence } from '@/hooks/useAppPresence'

function HomePageContent() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { onlineUsers, localClientId, setCurrentDocumentId } = useAppPresence()
  const [documentTitle, setDocumentTitle] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  
  const otherUsers = onlineUsers.filter(u => u.clientId !== localClientId)

  useEffect(() => {
    setCurrentDocumentId(null)
  }, [setCurrentDocumentId])

  useEffect(() => {
    fetchDocuments()
  }, [])
  
  const fetchDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error: fetchError } = await supabase
        .from('yjs_entities')
        .select('id, type, metadata, created_at, updated_at')
        .eq('type', 'document')
        .order('updated_at', { ascending: false })
      
      if (fetchError) throw fetchError
      
      setDocuments(data || [])
    } catch (err) {
      console.error('Error fetching documents:', err)
      setError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }
  
  const handleCreate = async () => {
    const title = documentTitle.trim() || `Untitled Document`
    try {
      const { data, error } = await supabase
        .from('yjs_entities')
        .insert({
          type: 'document',
          metadata: { title },
        })
        .select('id')
        .single()

      if (error) throw error
      if (!data) throw new Error('Failed to create document.')

      router.push(`/document/${data.id}`)
    } catch (err) {
      console.error('Error creating document:', err)
      setError('Failed to create a new document.')
    }
  }
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate()
    }
  }
  
  const handleDocumentClick = (id: string) => {
    router.push(`/document/${id}`)
  }
  
  const handleDeleteClick = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation()
    setDeleteConfirmId(docId)
  }
  
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    
    try {
      setDeleting(true)
      
      const { error: deleteError } = await supabase
        .from('yjs_entities')
        .delete()
        .eq('id', deleteConfirmId)
      
      if (deleteError) throw deleteError
      
      setDocuments(prev => prev.filter(doc => doc.id !== deleteConfirmId))
      setDeleteConfirmId(null)
    } catch (err) {
      console.error('Error deleting document:', err)
      setError('Failed to delete document')
    } finally {
      setDeleting(false)
    }
  }
  
  const handleDeleteCancel = () => {
    setDeleteConfirmId(null)
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      setShowUserMenu(false)
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  const filteredDocuments = documents.filter(doc =>
    doc.metadata?.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {otherUsers.length > 0 ? (
                <div className="h-[2.25rem] flex items-center">
                  <AppOnlineUsers onlineUsers={otherUsers} />
                </div>
              ) : (
                <h1 className="text-2xl font-semibold text-gray-900">
                  {getShortName(user?.user_metadata?.name || user?.email || 'User').toUpperCase()}
                </h1>
              )}
              <p className="text-gray-500 mt-0.5 text-sm">
                {filteredDocuments.length} {filteredDocuments.length === 1 ? 'document' : 'documents'} total
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors"
                  title={user?.email || 'User menu'}
                >
                  <span className="text-sm font-medium">
                    {getShortName(user?.user_metadata?.name || user?.email || 'User').toUpperCase()}
                  </span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg py-2 z-50 border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                      {user?.user_metadata?.avatar_url && (
                        <img
                          src={user.user_metadata.avatar_url}
                          alt="User avatar"
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user?.user_metadata?.name || 'User'}
                        </p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              {/* Create Document Button */}
              <button
                onClick={() => setShowModal(true)}
                className="w-10 h-10 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors flex items-center justify-center"
                title="Create new document"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-5xl mx-auto h-full flex flex-col">
          {/* Search and List */}
          <div className="px-8 py-4 border-b border-gray-100">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by title..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg border border-gray-200 focus:border-gray-300 focus:bg-white focus:ring-0 focus:outline-none transition"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          {error && (
            <div className="mx-8 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto px-8">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-20">
                <h3 className="text-lg font-medium text-gray-900">No documents found</h3>
                <p className="mt-1 text-sm text-gray-500">Create your first document to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredDocuments.map((doc, index) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    index={index}
                    onlineUsers={onlineUsers}
                    onDocumentClick={() => handleDocumentClick(doc.id)}
                    onDeleteClick={(e) => handleDeleteClick(e, doc.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Document</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="docTitle" className="block text-sm font-medium text-gray-700 mb-2">
                  Document Title
                </label>
                <input
                  id="docTitle"
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="My Awesome Project"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none transition"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowModal(false); setDocumentTitle(''); }}
                  className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
                >
                  Create Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
  return (
    <AuthGuard>
      <HomePageContent />
    </AuthGuard>
  )
}

