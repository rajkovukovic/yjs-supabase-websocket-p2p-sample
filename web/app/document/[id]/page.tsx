'use client'

import { useEffect, useState } from 'react'
import { YjsProvider } from '@/hooks/useYjs'
import KonvaCanvas from '@/components/KonvaCanvas'
import { Cursors } from '@/components/Cursors'
import { AuthGuard } from '@/components/AuthGuard'
import { supabase } from '@/lib/supabase'

function DocumentContent({ documentId }: { documentId: string }) {
  const [title, setTitle] = useState(documentId)

  useEffect(() => {
    const fetchTitle = async () => {
      const { data, error } = await supabase
        .from('yjs_entities')
        .select('metadata')
        .eq('id', documentId)
        .single()
      
      if (data?.metadata?.title) {
        setTitle(data.metadata.title)
      }
    }
    fetchTitle()
  }, [documentId])

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 relative">
        <KonvaCanvas documentId={documentId} documentTitle={title} />
        <Cursors />
      </div>
    </div>
  )
}

export default function DocumentPage({ params }: { params: { id: string } }) {
  const { id } = params
  
  return (
    <AuthGuard>
      <YjsProvider entityType="document" entityId={id}>
        <DocumentContent documentId={id} />
      </YjsProvider>
    </AuthGuard>
  )
}

