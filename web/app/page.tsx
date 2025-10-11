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
  const [documentName, setDocumentName] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  
  const otherUsers = onlineUsers.filter(u => u.clientId !== localClientId)

  // Set currentDocumentId to null when on home page
  useEffect(() => {
    setCurrentDocumentId(null)
  }, [setCurrentDocumentId])

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments()
  }, [])
  
  const fetchDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error: fetchError } = await supabase
        .from('documents')
        .select('id, name, metadata, created_at, updated_at')
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
  
  const handleCreate = () => {
    // Replace spaces with underscores
    const newDocName = documentName.trim()
      ? documentName.trim().replace(/\s+/g, '_')
      : `doc_${Date.now()}`
    
    router.push(`/document/${newDocName}`)
  }
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate()
    }
  }
  
  const handleDocumentClick = (name: string) => {
    router.push(`/document/${name}`)
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
        .from('documents')
        .delete()
        .eq('id', deleteConfirmId)
      
      if (deleteError) throw deleteError
      
      // Remove from local state
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

  // Filter documents based on search query and hide documents starting with _
  const filteredDocuments = documents.filter(doc =>
    !doc.name.startsWith('_') && (
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.metadata?.title?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )
  
  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header - Full Width */}
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
                  {getShortName(user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User').toUpperCase()}
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
                    {getShortName(user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User').toUpperCase()}
                  </span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown Menu */}
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
          {/* Search Bar */}
          <div className="px-8 py-4 border-b border-gray-100">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg border border-gray-200 focus:border-gray-300 focus:bg-white focus:ring-0 focus:outline-none transition"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mx-8 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          {/* Documents List - Scrollable */}
          <div className="flex-1 overflow-y-auto px-8">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200"></div>
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-gray-900 absolute top-0 left-0"></div>
                </div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-gray-100 rounded-lg mx-auto flex items-center justify-center mb-4">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  {searchQuery ? 'No documents found' : 'No documents yet'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery ? 'Try a different search term' : 'Create your first document to get started'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredDocuments.map((doc, index) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    index={index}
                    onlineUsers={onlineUsers}
                    onDocumentClick={handleDocumentClick}
                    onDeleteClick={handleDeleteClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Document Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Create Document
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setDocumentName('')
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="docName" className="block text-sm font-medium text-gray-700 mb-2">
                  Document Name
                </label>
                <input
                  id="docName"
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="my awesome doc"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none transition"
                  autoFocus
                />
                {documentName.trim() && (
                  <p className="mt-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                    Will be saved as: <code className="font-mono font-medium text-gray-900">
                      {documentName.trim().replace(/\s+/g, '_')}
                    </code>
                  </p>
                )}
              </div>
              
              <button
                onClick={handleCreate}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
              >
                Create Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Delete Document?
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                This action cannot be undone
              </p>
            </div>
            
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to delete this document? All content will be permanently removed.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close user menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
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

