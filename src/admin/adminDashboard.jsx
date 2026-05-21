// AdminDashboard.jsx
import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '../API/firebase'
import { useUI } from '../context/UIContext'
import { MdSearch, MdGroup, MdAdminPanelSettings, MdPerson, MdMoreVert } from 'react-icons/md'

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
  const { notify, confirm } = useUI()
  const [users,    setUsers]   = useState([])
  const [search,   setSearch]  = useState('')
  const [loading,  setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [activeMenuId, setActiveMenuId] = useState(null)

  const [error,   setError]   = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), 
      (snap) => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[AdminDashboard] Error loading users:', err)
        setError(err.message || 'Missing or insufficient permissions.')
        setLoading(false)
        notify(`Hindi ma-load ang mga user: ${err.message}`, 'error')
      }
    )
    return () => unsub()
  }, [])

  const toggleRole = async (uid, current) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: current === 'admin' ? 'user' : 'admin',
      })
      notify('Role updated successfully.', 'success')
    } catch (err) {
      notify(`Failed to update role: ${err.message}`, 'error')
    }
  }

  const deleteUser = async (uid, username) => {
    const ok = await confirm({
      title:        `Tanggalin si "${username}"?`,
      body:         'Matatanggal ang account sa website nang permanente. Hindi ito maibabalik.',
      confirmLabel: 'Tanggalin',
      danger:       true,
    })
    if (!ok) return
    setDeleting(uid)
    try {
      await deleteDoc(doc(db, 'users', uid))
      notify(`Si "${username}" ay matagumpay na natanggal.`, 'success')
    } catch (err) {
      notify(`Hindi ma-delete: ${err.message}`, 'error')
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
          { label: 'Total Users',   val: users.length, icon: <MdGroup />, accent: '#6c63ff' },
          { label: 'Admins',        val: admins,        icon: <MdAdminPanelSettings />, accent: '#a89cff' },
          { label: 'Regular Users', val: regular,       icon: <MdPerson />, accent: '#22d3a5' },
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
            <MdSearch size={16} className="ep-search-icon" />
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
        ) : error ? (
          <div className="ep-loading" style={{ flexDirection: 'column', gap: '16px', padding: '40px 20px', color: '#ff5f6d' }}>
            <span style={{ fontSize: '32px' }}>⚠️</span>
            <strong style={{ fontSize: '18px', color: '#fff' }}>Access Denied / Permission Error</strong>
            <p style={{ color: '#aaa', fontSize: '13.5px', maxWidth: '480px', margin: '0 auto', lineHeight: '1.6', textAlign: 'center' }}>
              Hindi ma-load ang listahan ng mga users: {error}
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'left',
              fontSize: '13px',
              color: '#bbb',
              maxWidth: '520px',
              marginTop: '10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
              <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#f5b942', fontSize: '14px' }}>Paano ito Ayusin:</p>
              <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                <li>Pumunta sa iyong <strong>Firebase Console</strong>.</li>
                <li>Magtungo sa <strong>Firestore Database</strong> ➔ <strong>users</strong> collection.</li>
                <li>Hanapin ang user document na may ID: <br/>
                  <code style={{ 
                    background: 'rgba(0,0,0,0.4)', 
                    padding: '4px 8px', 
                    borderRadius: '6px', 
                    color: '#f5b942', 
                    fontFamily: 'monospace',
                    display: 'inline-block',
                    marginTop: '4px',
                    marginBottom: '4px',
                    wordBreak: 'break-all',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    {auth.currentUser?.uid}
                  </code> <br/>
                  (Ito ang ID ng iyong <code>{auth.currentUser?.email}</code> account).
                </li>
                <li>Siguraduhing ang field na <strong><code>role</code></strong> ay may value na <strong><code>"admin"</code></strong> (kung ito ay <code>"user"</code>, palitan ito ng <code>"admin"</code>).</li>
              </ol>
            </div>
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
                      {/* Actions (Kebab Menu for All Screens) */}
                      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                        <button
                          className="ep-kebab-btn"
                          onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                        >
                          <MdMoreVert size={20} />
                        </button>
                        {activeMenuId === u.id && (
                          <div className="ep-kebab-menu" style={{ right: '50%', transform: 'translateX(50%)' }}>
                            <button
                              className="ep-kebab-item"
                              onClick={() => { toggleRole(u.id, u.role); setActiveMenuId(null); }}
                              disabled={u.id === auth.currentUser?.uid}
                            >
                              {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                            </button>
                            <button
                              className="ep-kebab-item ep-kebab-item--danger"
                              onClick={() => { deleteUser(u.id, u.username); setActiveMenuId(null); }}
                              disabled={u.id === auth.currentUser?.uid || deleting === u.id}
                            >
                              {deleting === u.id ? 'Tinatanggal…' : 'Delete'}
                            </button>
                          </div>
                        )}
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