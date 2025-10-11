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
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-0 md:p-8">
      <div className="max-w-5xl mx-auto h-full">
        {/* Documents List */}
        <div className="bg-white md:rounded-3xl md:shadow-2xl overflow-hidden h-full flex flex-col">
          {/* Header with All Documents + User Menu + Plus button */}
          <div className="p-8 bg-gradient-to-r from-blue-600 to-indigo-600">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {otherUsers.length > 0 ? (
                  <div className="h-[2.25rem] mb-1 flex items-center">
                    <AppOnlineUsers onlineUsers={otherUsers} />
                  </div>
                ) : (
                  <h2 className="text-3xl font-bold text-white">
                    Documents
                  </h2>
                )}
                <p className="text-blue-100 mt-1 text-sm">
                  {filteredDocuments.length} {filteredDocuments.length === 1 ? 'document' : 'documents'} total
                </p>
              </div>
              
              {/* Center: Online Users */}
              <div className="flex-1 flex justify-center">
                {/* This is intentionally left empty as users are now shown on the left */}
              </div>
              
              <div className="flex-1 flex items-center justify-end gap-3">
                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-200 backdrop-blur-sm"
                    title={user?.email || 'User menu'}
                  >
                    <span className="text-sm font-bold">
                      {getShortName(user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User')}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Dropdown Menu */}
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl py-2 z-50 border border-gray-100">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {user?.user_metadata?.name || 'User'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
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
                  className="w-12 h-12 bg-white text-blue-600 rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 hover:rotate-90"
                  title="Create new document"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full px-5 py-3.5 pl-12 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow shadow-sm hover:shadow-md"
              />
              <svg className="absolute left-4 top-4 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          {/* Documents List - Scrollable */}
          <div className="p-6 flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 absolute top-0 left-0"></div>
                </div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-blue-100 to-indigo-100 w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-4">
                  <svg className="h-10 w-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  {searchQuery ? 'No documents found' : 'No documents yet'}
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  {searchQuery ? 'Try a different search term' : 'Create your first document to get started!'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocuments.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
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
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full transform transition-all animate-scaleIn">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Create Document
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowModal(false)
                  setDocumentName('')
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label htmlFor="docName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Document Name
                </label>
                <input
                  id="docName"
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="my awesome doc"
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow shadow-sm"
                  autoFocus
                />
                {documentName.trim() && (
                  <p className="mt-3 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                    Will be saved as: <code className="font-mono font-semibold text-blue-600">
                      {documentName.trim().replace(/\s+/g, '_')}
                    </code>
                  </p>
                )}
              </div>
              
              <button
                onClick={handleCreate}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
              >
                Create Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full transform transition-all animate-scaleIn">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Delete Document?
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  This action cannot be undone
                </p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this document? All content will be permanently removed from the database.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
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

