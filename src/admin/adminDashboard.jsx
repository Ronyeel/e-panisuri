// AdminDashboard.jsx
import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '../API/firebase'
import Notification from '../components/notification' // adjust path as needed

function maskEmail(email = '') {
  const [local, domain] = email.split('@')
  if (!domain) return email
  return `${local.slice(0, 3)}***@${domain}`
}

const PAPEL_LABELS = {
  guro:       'Guro',
  manunulat:  'Manunulat',
  estudyante: 'Estudyante',
  tagasuri:   'Tagasuri',
}

const PAPEL_ACCENTS = {
  guro:       '#6c63ff',
  manunulat:  '#f5b942',
  estudyante: '#4fa3e8',
  tagasuri:   '#f97316',
}

export default function AdminDashboard() {
  const [users,    setUsers]   = useState([])
  const [search,   setSearch]  = useState('')
  const [loading,  setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [notify,   setNotify]  = useState(null) // { message, type }

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const showNotif = (message, type = 'success') => {
    setNotify({ message, type })
  }

  // Called by Notification when it finishes closing
  const clearNotif = () => setNotify(null)

  const toggleRole = async (uid, current) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: current === 'admin' ? 'user' : 'admin',
      })
      showNotif('Role updated successfully.')
    } catch (err) {
      showNotif(`Failed to update role: ${err.message}`, 'error')
    }
  }

  const deleteUser = async (uid, username) => {
    if (!window.confirm(`Tanggalin si "${username}"?\n\nMatatanggal ang account sa database.`)) return
    setDeleting(uid)
    try {
      await deleteDoc(doc(db, 'users', uid))
      showNotif(`Si "${username}" ay matagumpay na natanggal.`)
    } catch (err) {
      showNotif(`Hindi ma-delete: ${err.message}`, 'error')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())    ||
    u.papel?.toLowerCase().includes(search.toLowerCase())    ||
    u.paaralan?.toLowerCase().includes(search.toLowerCase())
  )

  const admins  = users.filter(u => u.role === 'admin').length
  const regular = users.filter(u => u.role !== 'admin').length

  const papelStats = Object.entries(PAPEL_LABELS).map(([key, label]) => ({
    key, label,
    count: users.filter(u => u.papel === key).length,
    accent: PAPEL_ACCENTS[key],
  }))

  return (
    <div className="ep-page">

      {/* Notification */}
      {notify && (
        <Notification
          message={notify.message}
          type={notify.type}
          onClose={clearNotif}
        />
      )}

      {/* Header */}
      <div className="ep-page-header">
        <div>
          <p className="ep-page-eyebrow">Overview</p>
          <h1 className="ep-page-title">Dashboard</h1>
        </div>
        <div className="ep-live-badge">
          <span className="ep-live-dot" />
          Real-time
        </div>
      </div>

      {/* Core stats */}
      <div className="ep-stats-grid">
        {[
          { label: 'Total Users',   val: users.length, icon: '', accent: '#6c63ff' },
          { label: 'Admins',        val: admins,        icon: '', accent: '#a89cff' },
          { label: 'Regular Users', val: regular,       icon: '', accent: '#22d3a5' },
        ].map(s => (
          <div className="ep-stat-card" key={s.label} style={{ '--accent': s.accent }}>
            <div className="ep-stat-icon">{s.icon}</div>
            <div>
              <p className="ep-stat-label">{s.label}</p>
              <p className="ep-stat-val">{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Papel stats */}
      <div className="ep-stats-grid" style={{ marginTop: '0' }}>
        {papelStats.map(s => (
          <div className="ep-stat-card" key={s.key} style={{ '--accent': s.accent }}>
            <div>
              <p className="ep-stat-label">{s.label}</p>
              <p className="ep-stat-val">{s.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* User table */}
      <div className="ep-card">
        <div className="ep-card-header">
          <h2 className="ep-card-title">User Management</h2>
          <div className="ep-search-wrap">
            <svg className="ep-search-icon" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="ep-search"
              type="text"
              placeholder="Hanapin ang user, papel, paaralan…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="ep-loading">
            <div className="ep-spinner" />
            <span>Naglo-load…</span>
          </div>
        ) : (
          <div className="ep-table-wrap">
            <table className="ep-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Paaralan</th>
                  <th>Kurso</th>
                  <th>Papel</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="ep-empty">Walang nahanap na user.</td>
                  </tr>
                ) : filtered.map(u => (
                  <tr key={u.id} className="ep-table-row">

                    <td className="ep-td-user">
                      <div className="ep-avatar">{(u.username?.[0] ?? '?').toUpperCase()}</div>
                      <span>{u.username}</span>
                    </td>

                    <td className="ep-td-email">{maskEmail(u.email)}</td>
                    <td>{u.paaralan ?? '—'}</td>
                    <td>{u.kurso ?? '—'}</td>

                    <td>
                      <span className={`ep-pill ep-pill--papel ep-pill--${u.papel ?? 'unknown'}`}>
                        {PAPEL_LABELS[u.papel] ?? u.papel ?? '—'}
                      </span>
                    </td>

                    <td>
                      <span className={`ep-pill ep-pill--${u.role}`}>{u.role}</span>
                    </td>

                    <td>
                      <div className="ep-actions">
                        <button
                          className="ep-btn ep-btn--ghost"
                          onClick={() => toggleRole(u.id, u.role)}
                          disabled={u.id === auth.currentUser?.uid}
                          title={u.id === auth.currentUser?.uid ? 'Hindi mo mababago ang sarili mong role.' : ''}
                        >
                          {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                        </button>
                        <button
                          className="ep-btn ep-btn--danger"
                          onClick={() => deleteUser(u.id, u.username)}
                          disabled={u.id === auth.currentUser?.uid || deleting === u.id}
                          title={u.id === auth.currentUser?.uid ? 'Hindi mo matatanggal ang sarili mo.' : ''}
                        >
                          {deleting === u.id
                            ? <><span className="ep-spinner ep-spinner--sm" /> Tinatanggal…</>
                            : 'Delete'
                          }
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}