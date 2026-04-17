/**
 * UIContext — single source of truth for app-wide UI primitives:
 *
 *   notify(message, type?)  — shows a toast notification (type: 'success' | 'error' | 'info')
 *   confirm(opts)           — shows a styled confirm dialog, returns Promise<boolean>
 *
 * Usage anywhere in the tree:
 *   const { notify, confirm } = useUI()
 */

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import './UIContext.css'

// ─── Context ──────────────────────────────────────────────────────────────────

const UIContext = createContext(null)

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>')
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UIProvider({ children }) {
  const [toasts,  setToasts]  = useState([])   // [{ id, message, type, visible }]
  const [dialog,  setDialog]  = useState(null)  // { title, body, confirmLabel, danger, resolve }
  const toastId = useRef(0)

  // ── Toast ──────────────────────────────────────────────────────────────────
  const notify = useCallback((message, type = 'success') => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, message, type, visible: true }])

    // auto-dismiss after 3.5 s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 400)
    }, 3500)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 400)
  }, [])

  // ── Confirm dialog ─────────────────────────────────────────────────────────
  /**
   * confirm({ title, body, confirmLabel, cancelLabel, danger })
   * Returns a Promise<boolean> — true if confirmed, false if cancelled.
   */
  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      setDialog({
        title:        opts.title        ?? 'Kumpirmahin',
        body:         opts.body         ?? '',
        confirmLabel: opts.confirmLabel ?? 'OK',
        cancelLabel:  opts.cancelLabel  ?? 'Kanselahin',
        danger:       opts.danger       ?? false,
        resolve,
      })
    })
  }, [])

  const handleDialogClose = (result) => {
    dialog?.resolve(result)
    setDialog(null)
  }

  // ── Compat shim: accept onNotify-style object notation ────────────────────
  // Lets pages still call notify({ message, type }) in addition to notify(msg, type)
  const notifyShim = useCallback((msgOrObj, type) => {
    if (msgOrObj && typeof msgOrObj === 'object') {
      notify(msgOrObj.message, msgOrObj.type ?? type ?? 'success')
    } else {
      notify(msgOrObj, type ?? 'success')
    }
  }, [notify])

  return (
    <UIContext.Provider value={{ notify: notifyShim, confirm }}>
      {children}

      {/* ── Toast Stack ───────────────────────────────────────── */}
      <div className="ui-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`ui-toast ui-toast--${t.type} ${t.visible ? 'ui-toast--show' : 'ui-toast--hide'}`}
            role="alert"
          >
            <span className="ui-toast-icon">
              {t.type === 'success' && <CheckIcon />}
              {t.type === 'error'   && <ErrorIcon />}
              {t.type === 'info'    && <InfoIcon  />}
            </span>
            <span className="ui-toast-text">{t.message}</span>
            <button
              className="ui-toast-close"
              onClick={() => dismissToast(t.id)}
              aria-label="Isara"
            >✕</button>
          </div>
        ))}
      </div>

      {/* ── Confirm Dialog ────────────────────────────────────── */}
      {dialog && (
        <div
          className="ui-dialog-backdrop"
          onClick={e => { if (e.target === e.currentTarget) handleDialogClose(false) }}
        >
          <div className="ui-dialog" role="alertdialog" aria-modal="true">
            <div className="ui-dialog-header">
              <h2 className="ui-dialog-title">{dialog.title}</h2>
            </div>
            {dialog.body && (
              <p className="ui-dialog-body">{dialog.body}</p>
            )}
            <div className="ui-dialog-footer">
              <button
                className="ui-dialog-btn ui-dialog-btn--cancel"
                onClick={() => handleDialogClose(false)}
              >
                {dialog.cancelLabel}
              </button>
              <button
                className={`ui-dialog-btn ${dialog.danger ? 'ui-dialog-btn--danger' : 'ui-dialog-btn--confirm'}`}
                onClick={() => handleDialogClose(true)}
                autoFocus
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M7 12l3 3 7-7" />
    </svg>
  )
}
function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  )
}
function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}
