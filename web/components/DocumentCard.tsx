import { DocumentPresence } from '@/components/DocumentPresence'
import { Clock } from 'lucide-react'

export interface Document {
  id: string
  name: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

interface DocumentCardProps {
  document: Document
  index: number
  onlineUsers: any[]
  onDocumentClick: (name: string) => void
  onDeleteClick: (e: React.MouseEvent, docId: string) => void
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

export const DocumentCard = ({
  document,
  index,
  onlineUsers,
  onDocumentClick,
  onDeleteClick
}: DocumentCardProps) => {
  return (
    <div className="relative group">
      <div
        onClick={() => onDocumentClick(document.name)}
        className="w-full text-left py-4 transition-colors cursor-pointer hover:bg-gray-50"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-base font-medium text-gray-900 truncate">
                  {document.name}
                </h3>
                 <DocumentPresence documentName={document.name} onlineUsers={onlineUsers} showStatusText={false} />
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 pl-[52px]">
              <span className="flex items-center gap-1" title="Created">
                <Clock className="w-3 h-3" />
                {formatDate(document.created_at)}
              </span>
              <span className="flex items-center gap-1" title="Last Updated">
                <Clock className="w-3 h-3" />
                {formatDate(document.updated_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => onDeleteClick(e, document.id)}
              className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Delete document"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
