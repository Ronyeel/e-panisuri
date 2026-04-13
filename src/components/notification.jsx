import { useEffect, useState } from 'react'
import './notification.css'

export default function Notification({ message, type = 'success', duration = 3500, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) return
    setVisible(true)
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onClose?.(), 400) // wait for fade-out
    }, duration)
    return () => clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div className={`notif notif--${type} ${visible ? 'notif--show' : 'notif--hide'}`}>
      <span className="notif-icon">
        {type === 'success' ? <CheckCircleIcon /> : <ErrorCircleIcon />}
      </span>
      <span className="notif-text">{message}</span>
      <button className="notif-close" onClick={() => { setVisible(false); setTimeout(() => onClose?.(), 400) }}>✕</button>
    </div>
  )
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M7 12l3 3 7-7" />
    </svg>
  )
}
function ErrorCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  )
}