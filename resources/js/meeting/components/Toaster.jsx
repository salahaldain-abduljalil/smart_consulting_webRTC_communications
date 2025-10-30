import React, { useEffect, useState } from 'react'

function Toast({ id, type = 'error', title, message, action, onAction, onClose }) {
  return (
    <div className={`max-w-sm w-full bg-white text-gray-900 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden`} role="alert" aria-live="assertive">
      <div className="p-3">
        <div className="flex">
          <div className="flex-shrink-0">
            {type === 'error' && <span className="text-red-600">❌</span>}
            {type === 'success' && <span className="text-green-600">✅</span>}
            {type === 'info' && <span className="text-blue-600">ℹ️</span>}
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-medium">{title}</p>
            {message && <p className="mt-1 text-sm text-gray-500">{message}</p>}
          </div>
          <div className="ml-4 flex-shrink-0 flex items-start">
            <button onClick={() => onClose(id)} className="inline-flex text-gray-400 hover:text-gray-600">✖</button>
          </div>
        </div>
        {action && (
          <div className="mt-3 flex">
            <button onClick={() => onAction && onAction(id)} className="ml-auto inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded text-sm">{action.label}</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Toaster({ position = 'top-right', duration = 6000 }) {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    function onError(e) {
      const d = e.detail || {}
      // If this error is retryable, add an action button
      const retryable = ['SFU_AUTH_FAILED', 'TURN_FETCH_FAILED']
      const action = retryable.includes(d.code) ? { label: 'Retry', event: 'meeting:retry' } : null
      pushToast({ type: 'error', title: d.code || 'Error', message: d.message || 'An error occurred', action, code: d.code })
    }

    function onToast(e) {
      const d = e.detail || {}
      pushToast({ type: d.type || 'info', title: d.title || '', message: d.message || '', action: d.action || null })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('meeting:error', onError)
      window.addEventListener('meeting:toast', onToast)
      return () => {
        window.removeEventListener('meeting:error', onError)
        window.removeEventListener('meeting:toast', onToast)
      }
    }
    return () => {}
  }, [])

  useEffect(() => {
    // auto-dismiss
    const timers = toasts.map(t => {
      if (t.timeout) return null
      const id = setTimeout(() => removeToast(t.id), duration)
      return id
    }).filter(Boolean)
    return () => timers.forEach(id => clearTimeout(id))
  }, [toasts])

  function pushToast({ type, title, message, action = null, code = null }) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2,8)
    setToasts(prev => [...prev, { id, type, title, message, action, code }])
  }

  function removeToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const containerStyle = {
    top: position.includes('top') ? '1rem' : 'auto',
    bottom: position.includes('bottom') ? '1rem' : 'auto',
    right: position.includes('right') ? '1rem' : 'auto',
    left: position.includes('left') ? '1rem' : 'auto',
  }

  return (
    <div style={containerStyle} className="fixed z-50 space-y-2">
      {toasts.map(t => (
        <Toast
          key={t.id}
          id={t.id}
          type={t.type}
          title={t.title}
          message={t.message}
          action={t.action}
          onAction={(id) => {
            const toast = toasts.find(x => x.id === id)
            if (toast?.action?.event) {
              try { window.dispatchEvent(new CustomEvent(toast.action.event)) } catch (e) { console.warn('failed to dispatch retry event', e) }
            }
            removeToast(id)
          }}
          onClose={removeToast}
        />
      ))}
    </div>
  )
}
