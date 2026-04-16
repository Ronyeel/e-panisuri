import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../API/firebase'

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const [status, setStatus] = useState('checking') // 'checking' | 'ok' | 'deleted' | 'unauth'

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus('unauth')
        return
      }

      // Check if Firestore doc still exists
      const userDoc = await getDoc(doc(db, 'users', user.uid))

      if (!userDoc.exists()) {
        await signOut(auth)
        setStatus('deleted')
        return
      }

      const role = userDoc.data()?.role ?? 'user'

      if (requireAdmin && role !== 'admin') {
        setStatus('unauth')
        return
      }

      setStatus('ok')
    })

    return () => unsub()
  }, [requireAdmin])

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <span>Loading…</span>
      </div>
    )
  }

  if (status === 'deleted') {
    return <Navigate to="/login?reason=deleted" replace />
  }

  if (status === 'unauth') {
    return <Navigate to="/login" replace />
  }

  return children
}