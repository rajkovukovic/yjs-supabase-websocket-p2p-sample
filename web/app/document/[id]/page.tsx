'use client'

import { YjsProvider } from '@/hooks/useYjs'
import { Canvas } from '@/components/Canvas'
import { StatusBar } from '@/components/StatusBar'
import { Cursors } from '@/components/Cursors'
import { use } from 'react'

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  
  return (
    <YjsProvider documentName={id}>
      <div className="h-screen flex flex-col">
        <StatusBar />
        <div className="flex-1 relative">
          <Canvas />
          <Cursors />
        </div>
      </div>
    </YjsProvider>
  )
}

