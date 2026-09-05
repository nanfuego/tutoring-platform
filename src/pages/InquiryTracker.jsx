import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import './InquiryTracker.css'

const STATUS_LABELS = {
  new: 'New',
  replied: 'Replied',
  closed: 'Closed',
  spam: 'Spam',
}

const PAGE_SIZE = 10

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function makeReplyHref(inquiry) {
  const subject = encodeURIComponent(
    `Re: WestPacific Desk inquiry — ${inquiry.service || 'General inquiry'}`,
  )

  const body = encodeURIComponent(
    `Hi ${inquiry.name},\n\nThank you for contacting WestPacific Desk.\n\n`,
  )

  return `mailto:${encodeURIComponent(inquiry.email)}?subject=${subject}&body=${body}`
}

export default function InquiryTracker() {
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [actionMessage, setActionMessage] = useState('')

  async function loadInquiries() {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('contact_inquiries')
      .select('id, name, email, service, message, status, source, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (loadError) {
      setError(loadError.message)
      setInquiries([])
    } else {
      setInquiries(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadInquiries()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, filter])

  const counts = useMemo(() => {
    return inquiries.reduce(
      (result, inquiry) => {
        result.all += 1
        if (result[inquiry.status] !== undefined) result[inquiry.status] += 1
        return result
      },
      { all: 0, new: 0, replied: 0, closed: 0, spam: 0 },
    )
  }, [inquiries])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return inquiries.filter((inquiry) => {
      if (filter !== 'all' && inquiry.status !== filter) return false
      if (!query) return true

      return [
        inquiry.name,
        inquiry.email,
        inquiry.service,
        inquiry.message,
      ].some((value) => value?.toLowerCase().includes(query))
    })
  }, [inquiries, search, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  async function updateStatus(inquiry, nextStatus) {
    if (!inquiry || saving) return

    setSaving(true)
    setError('')

    const { data, error: updateError } = await supabase
      .from('contact_inquiries')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inquiry.id)
      .select('id, name, email, service, message, status, source, created_at, updated_at')
      .single()

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setInquiries((current) =>
      current.map((item) => (item.id === data.id ? data : item)),
    )
    setSelected(data)
    const messages = {
  replied: 'Marked as Replied',
  closed: 'Inquiry Closed',
  spam: 'Marked as Spam',
}

setActionMessage(messages[nextStatus] || 'Status updated')

setTimeout(() => {
  setActionMessage('')
}, 2200)
    setSaving(false)
  }

  async function deleteInquiry(inquiry) {
    if (!inquiry || saving) return

    const confirmed = window.confirm(
      `Delete the inquiry from ${inquiry.name}? This cannot be undone.`,
    )
    if (!confirmed) return

    setSaving(true)
    setError('')

    const { error: deleteError } = await supabase
      .from('contact_inquiries')
      .delete()
      .eq('id', inquiry.id)

    if (deleteError) {
      setError(deleteError.message)
      setSaving(false)
      return
    }

    setInquiries((current) =>
      current.filter((item) => item.id !== inquiry.id),
    )
    setSelected(null)
    setSaving(false)
  }

  return (
    <div className="inquiry-page">
      <div className="inquiry-heading">
        <div>
          <span className="inquiry-kicker">WESTPACIFIC DESK</span>
          <h1>Client Inquiries</h1>
          <p>
            Review website messages, follow up with prospective clients,
            and keep every inquiry organized.
          </p>
        </div>

        <button
          type="button"
          className="inquiry-refresh"
          onClick={loadInquiries}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="inquiry-stats">
        {[
          ['new', 'New'],
          ['replied', 'Replied'],
          ['closed', 'Closed'],
          ['spam', 'Spam'],
        ].map(([key, label]) => (
          <button
            type="button"
            className={`inquiry-stat ${filter === key ? 'active' : ''}`}
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
          >
            <span>{label}</span>
            <strong>{counts[key]}</strong>
          </button>
        ))}
      </div>

      <div className="inquiry-toolbar">
        <input
          type="search"
          placeholder="Search name, email, service, or message..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All inquiries</option>
          <option value="new">New</option>
          <option value="replied">Replied</option>
          <option value="closed">Closed</option>
          <option value="spam">Spam</option>
        </select>
      </div>

      {error && <div className="inquiry-error">{error}</div>}

      <div className="inquiry-table-card">
        <table className="inquiry-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Service</th>
              <th>Received</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {!loading && pageRows.length === 0 && (
              <tr>
                <td colSpan="5" className="inquiry-empty">
                  No inquiries match your current filters.
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan="5" className="inquiry-empty">
                  Loading inquiries...
                </td>
              </tr>
            )}

            {!loading &&
              pageRows.map((inquiry) => (
                <tr key={inquiry.id}>
                  <td>
                    <button
                      className="inquiry-client-button"
                      type="button"
                      onClick={() => setSelected(inquiry)}
                    >
                      <strong>{inquiry.name}</strong>
                      <span>{inquiry.email}</span>
                    </button>
                  </td>
                  <td>{inquiry.service}</td>
                  <td>{formatDate(inquiry.created_at)}</td>
                  <td>
                    <span className={`inquiry-status ${inquiry.status}`}>
                      {STATUS_LABELS[inquiry.status] || inquiry.status}
                    </span>
                  </td>
                  <td className="inquiry-action-cell">
                    <button
                      type="button"
                      onClick={() => setSelected(inquiry)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="inquiry-pagination">
        <span>
          {filtered.length === 0
            ? '0 inquiries'
            : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(
                safePage * PAGE_SIZE,
                filtered.length,
              )} of ${filtered.length}`}
        </span>

        <div>
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </button>
          <span>
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() =>
              setPage((value) => Math.min(totalPages, value + 1))
            }
          >
            Next
          </button>
        </div>
      </div>

      {selected && (
        <div
          className="inquiry-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setSelected(null)
            }
          }}
        >
          <div className="inquiry-modal">
            <div className="inquiry-modal-header">
              <div>
                <span className="inquiry-kicker">CLIENT INQUIRY</span>
                <h2>{selected.name}</h2>
                <a href={`mailto:${selected.email}`}>{selected.email}</a>
              </div>

              <button
                type="button"
                className="inquiry-modal-close"
                onClick={() => setSelected(null)}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <div className="inquiry-modal-meta">
              <div>
                <span>Service</span>
                <strong>{selected.service}</strong>
              </div>
              <div>
                <span>Received</span>
                <strong>{formatDate(selected.created_at)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{STATUS_LABELS[selected.status]}</strong>
              </div>
            </div>

            <div className="inquiry-message">
              <span>Message</span>
              <p>{selected.message}</p>
            </div>
{actionMessage && (
  <div
    className={`inquiry-action-feedback ${selected.status}`}
  >
    <span>✓</span>
    {actionMessage}
  </div>
)}
            <div className="inquiry-modal-actions">
              <a
                className="inquiry-primary"
                href={makeReplyHref(selected)}
                onClick={() => {
                  if (selected.status === 'new') {
                    updateStatus(selected, 'replied')
                  }
                }}
              >
                Reply by Email
              </a>

<button
  type="button"
  className={selected.status === 'replied' ? 'status-active replied' : ''}
  onClick={() => updateStatus(selected, 'replied')}
  disabled={saving || selected.status === 'replied'}
>
  {selected.status === 'replied' ? '✓ Replied' : 'Mark Replied'}
</button>

<button
  type="button"
  className={selected.status === 'closed' ? 'status-active closed' : ''}
  onClick={() => updateStatus(selected, 'closed')}
  disabled={saving || selected.status === 'closed'}
>
  {selected.status === 'closed' ? '✓ Closed' : 'Close'}
</button>

<button
  type="button"
  className={selected.status === 'spam' ? 'status-active spam' : ''}
  onClick={() => updateStatus(selected, 'spam')}
  disabled={saving || selected.status === 'spam'}
>
  {selected.status === 'spam' ? '✓ Spam' : 'Spam'}
</button>

              <button
                type="button"
                className="danger"
                onClick={() => deleteInquiry(selected)}
                disabled={saving}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
