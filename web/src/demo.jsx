import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

function Demo() {
  return (
    <main className="min-h-screen max-w-6xl mx-auto px-6 py-6">
      {/* Intentionally left blank for now */}
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>
)
