'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Document {
  id: string
  name: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export default function HomePage() {
  const router = useRouter()
  const [documentName, setDocumentName] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
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
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Filter documents based on search query
  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.metadata?.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-0 md:p-8">
      <div className="max-w-4xl mx-auto h-screen md:h-auto">
        {/* Documents List */}
        <div className="bg-white md:rounded-2xl md:shadow-xl overflow-hidden h-full md:h-auto">
          {/* Header with All Documents + Plus button */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                All Documents
              </h2>
              <button
                onClick={() => setShowModal(true)}
                className="w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition duration-200 flex items-center justify-center transform hover:scale-105"
                title="Create new document"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-6 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="p-6 max-h-[calc(100vh-280px)] md:max-h-[calc(100vh-320px)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  {searchQuery ? 'No documents found' : 'No documents yet'}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {searchQuery ? 'Try a different search term' : 'Create your first document to get started!'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleDocumentClick(doc.name)}
                    className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition">
                          {doc.name}
                        </h3>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <span title="Created">
                            Created: {formatDate(doc.created_at)}
                          </span>
                          <span title="Last Updated">
                            Updated: {formatDate(doc.updated_at)}
                          </span>
                        </div>
                        {doc.metadata?.title && (
                          <p className="mt-2 text-sm text-gray-600">
                            {doc.metadata.title}
                          </p>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Server Status - Hidden on mobile */}
        <div className="hidden md:block mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Server Requirements:</strong> Hocuspocus (port 1234) • Signaling (port 4444) • Supabase
          </p>
        </div>
      </div>

      {/* Create Document Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Create Document
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setDocumentName('')
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  autoFocus
                />
                {documentName.trim() && (
                  <p className="mt-2 text-xs text-gray-500">
                    Will be saved as: <code className="bg-gray-100 px-1 py-0.5 rounded">
                      {documentName.trim().replace(/\s+/g, '_')}
                    </code>
                  </p>
                )}
              </div>
              
              <button
                onClick={handleCreate}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-105"
              >
                Create Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

