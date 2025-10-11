'use client'

import React, { useState } from 'react'
import { ReactZoomPanPinchState } from 'react-zoom-pan-pinch'

interface ZoomControlsAndStatusProps {
  transformState: ReactZoomPanPinchState
  zoomIn: (step: number, duration?: number, ease?: string) => void
  zoomOut: (step: number, duration?: number, ease?: string) => void
  resetTransform: (duration?: number, ease?: string) => void
  isCreateRectangleMode: boolean
  setIsCreateRectangleMode: (value: boolean) => void
}

export function ZoomControlsAndStatus({
  transformState,
  zoomIn,
  zoomOut,
  resetTransform,
  isCreateRectangleMode,
  setIsCreateRectangleMode,
}: ZoomControlsAndStatusProps) {
  const [showInfoPopup, setShowInfoPopup] = useState(false)

  const handleResetView = () => {
    resetTransform(300, 'easeOut')
  }

  const handleToggleCreateMode = () => {
    setIsCreateRectangleMode(!isCreateRectangleMode)
    setShowInfoPopup(false)
  }

  const handleInfoToggle = () => {
    setShowInfoPopup(!showInfoPopup)
    if (!showInfoPopup) {
      setIsCreateRectangleMode(false)
    }
  }

  return (
    <>
      {/* Zoom Controls - Bottom Left */}
      <div className="fixed bottom-6 left-6 z-20 flex items-center gap-3 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-lg border border-gray-200/50">
        {/* Zoom Out */}
        <button
          onClick={() => zoomOut(0.2, 300, 'easeOut')}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        {/* Zoom Percentage - Clickable to Reset */}
        <button
          onClick={handleResetView}
          className="min-w-[3rem] text-center hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors"
          title="Reset zoom and pan"
        >
          <span className="text-sm font-medium text-gray-700">{Math.round(transformState.scale * 100)}%</span>
        </button>

        {/* Zoom In */}
        <button
          onClick={() => zoomIn(0.2, 300, 'easeOut')}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          title="Zoom In"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-300" />

        {/* Info Button */}
        <button
          onClick={handleInfoToggle}
          className={`p-1.5 rounded-lg transition-all duration-200 ${
            showInfoPopup
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          title="Show help and commands"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-300" />

        {/* Create Rectangle Mode */}
        <button
          onClick={handleToggleCreateMode}
          className={`p-1.5 rounded-lg transition-all duration-200 ${
            isCreateRectangleMode
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          title={isCreateRectangleMode ? 'Exit Create Rectangle Mode (Esc)' : 'Create Rectangle Mode'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" />
          </svg>
        </button>
      </div>

      {/* Info Popup */}
      {showInfoPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowInfoPopup(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">How to Use the Document</h3>
              <button
                onClick={() => setShowInfoPopup(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Navigation</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Scroll</kbd> to zoom in/out</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Space + Drag</kbd> to pan around</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Click zoom %</kbd> to reset view</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2">Creating Shapes</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Click the <span className="inline-flex items-center px-1 py-0.5 bg-gray-100 rounded text-xs">□</span> button to enter rectangle mode</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Click & Drag</kbd> to create rectangles</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd> to exit rectangle mode</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2">Selecting & Editing</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Click</kbd> rectangles to select them</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Shift + Click</kbd> to select multiple</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Drag</kbd> selected rectangles to move them</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Delete</kbd> or <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Backspace</kbd> to remove selected</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2">Collaboration</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• See other users' cursors in real-time</li>
                  <li>• Changes sync automatically across all users</li>
                  <li>• Green indicator shows when fully synced</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
