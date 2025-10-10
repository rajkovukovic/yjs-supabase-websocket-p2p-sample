'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function HomePage() {
  const router = useRouter()
  const [documentName, setDocumentName] = useState('')
  
  const handleCreate = () => {
    const newDocName = documentName.trim() || `doc-${Date.now()}`
    router.push(`/document/${newDocName}`)
  }
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate()
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Collaborative Editor
          </h1>
          <p className="text-gray-600">
            Real-time graphic editing with Yjs
          </p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="docName" className="block text-sm font-medium text-gray-700 mb-2">
              Document Name (optional)
            </label>
            <input
              id="docName"
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="my-awesome-doc"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          
          <button
            onClick={handleCreate}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-105"
          >
            Create / Open Document
          </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Start:</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Click anywhere on canvas to add rectangles</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Drag rectangles to move them</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Cmd+Click to pan, scroll to zoom</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Open same document in multiple tabs to collaborate!</span>
            </li>
          </ul>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Make sure the Hocuspocus server is running on port 1234 and the signaling server on port 4444
          </p>
        </div>
      </div>
    </div>
  )
}

