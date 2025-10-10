'use client'

import { YjsProvider } from '@/hooks/useYjs'
import { Canvas } from '@/components/Canvas'
import { StatusBar } from '@/components/StatusBar'
import { Cursors } from '@/components/Cursors'

export default function DocumentPage({ params }: { params: { id: string } }) {
  const { id } = params
  
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

