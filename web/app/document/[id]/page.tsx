'use client'

import { useEffect } from 'react'
import { YjsProvider } from '@/hooks/useYjs'
import { Canvas } from '@/components/Canvas'
import { Cursors } from '@/components/Cursors'
import { AuthGuard } from '@/components/AuthGuard'
import { useAppPresence } from '@/hooks/useAppPresence'

function DocumentContent({ documentName }: { documentName: string }) {
  const { setCurrentDocumentId } = useAppPresence()

  useEffect(() => {
    // Broadcast that we're viewing this document
    setCurrentDocumentId(documentName)

    // Clean up when leaving the document
    return () => {
      setCurrentDocumentId(null)
    }
  }, [documentName, setCurrentDocumentId])

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 relative">
        <Canvas documentName={documentName} />
        {/* Initialize cursors hook (manages awareness state) */}
        <Cursors />
      </div>
    </div>
  )
}

export default function DocumentPage({ params }: { params: { id: string } }) {
  const { id } = params
  
  return (
    <AuthGuard>
      <YjsProvider documentName={id}>
        <DocumentContent documentName={id} />
      </YjsProvider>
    </AuthGuard>
  )
}

