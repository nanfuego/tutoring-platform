import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './PaymentTracker.css'

const filters = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
]

function isOverdue(payment) {
  if (payment.status === 'paid' || !payment.due_date) return false
  return new Date(payment.due_date) < new Date(new Date().toDateString())
}

function formatMoney(amount, currency) {
  const symbol = currency === 'PHP' ? '₱' : '$'
  return `${symbol}${Number(amount).toFixed(2)}`
}

function PaymentTracker() {
  const navigate = useNavigate()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState(null)

  // Create Invoice modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [studentId, setStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function fetchPayments() {
    setLoading(true)
    const { data } = await supabase
      .from('payments')
      .select('*, students(name)')
      .order('due_date', { ascending: true })
    setPayments(data || [])
    setLoading(false)
  }

  async function fetchStudentsForModal() {
    setLoadingStudents(true)
    const { data } = await supabase
      .from('students')
      .select('id, name, active')
      .order('name')
    setStudents(data || [])
    setLoadingStudents(false)
  }

  useEffect(() => {
    fetchPayments()
  }, [])

  function openCreateModal() {
    setFormError('')
    setStudentId('')
    setAmount('')
    setCurrency('USD')
    setDescription('')
    setDueDate('')
    setShowCreateModal(true)
    fetchStudentsForModal()
  }

  function closeCreateModal() {
    if (saving) return
    setShowCreateModal(false)
  }

  async function handleCreateInvoice(e) {
    e.preventDefault()
    setFormError('')

    if (!studentId) {
      setFormError('Please select a student.')
      return
    }
    if (!amount || Number(amount) <= 0) {
      setFormError('Please enter a valid amount.')
      return
    }

    setSaving(true)

    const { error: insertError } = await supabase.from('payments').insert({
      student_id: studentId,
      amount: Number(amount),
      currency,
      description: description.trim() || null,
      due_date: dueDate || null,
      invoice_date: new Date().toISOString().slice(0, 10),
      status: 'pending',
    })

    setSaving(false)

    if (insertError) {
      setFormError(insertError.message)
      return
    }

    setShowCreateModal(false)
    fetchPayments()
  }

  async function toggleStatus(payment) {
    setUpdatingId(payment.id)
    const newStatus = payment.status === 'paid' ? 'pending' : 'paid'
    const { error } = await supabase
      .from('payments')
      .update({ status: newStatus })
      .eq('id', payment.id)
    setUpdatingId(null)
    if (!error) {
      setPayments((current) =>
        current.map((p) => (p.id === payment.id ? { ...p, status: newStatus } : p))
      )
    }
  }

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return payments
    if (activeFilter === 'overdue') return payments.filter(isOverdue)
    return payments.filter((p) => p.status === activeFilter)
  }, [payments, activeFilter])

  const totals = useMemo(() => {
    const pendingTotal = payments
      .filter((p) => p.status !== 'paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const paidTotal = payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    return { pendingTotal, paidTotal }
  }, [payments])

  return (
    <div className="tracker-page">
      <button className="back-link" onClick={() => navigate('/admin')}>
        ← Back to students
      </button>

      <div className="tracker-header">
        <h1 className="admin-welcome">Payments</h1>
        <button className="create-invoice-button" onClick={openCreateModal}>
          + Create Invoice
        </button>
      </div>

      <div className="tracker-summary">
        <div className="summary-card">
          <p className="summary-label">Outstanding</p>
          <p className="summary-value">{formatMoney(totals.pendingTotal, 'USD')}</p>
        </div>
        <div className="summary-card">
          <p className="summary-label">Collected</p>
          <p className="summary-value paid">{formatMoney(totals.paidTotal, 'USD')}</p>
        </div>
      </div>

      <div className="tracker-filters">
        {filters.map((f) => (
          <button
            key={f.key}
            className={activeFilter === f.key ? 'filter-pill active' : 'filter-pill'}
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="empty-table">No invoices in this view.</p>
      ) : (
        <div className="tracker-table-wrapper">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Due</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const overdue = isOverdue(p)
                return (
                  <tr key={p.id}>
                    <td>{p.students?.name || '—'}</td>
                    <td className="desc-cell">{p.description || '—'}</td>
                    <td>{formatMoney(p.amount, p.currency)}</td>
                    <td className={overdue ? 'overdue-date' : ''}>
                      {p.due_date || '—'}
                    </td>
                    <td>
                      <span
                        className={
                          p.status === 'paid'
                            ? 'status-badge active'
                            : overdue
                            ? 'status-badge overdue'
                            : 'status-badge inactive'
                        }
                      >
                        {p.status === 'paid' ? 'Paid' : overdue ? 'Overdue' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="mark-paid-button"
                        onClick={() => toggleStatus(p)}
                        disabled={updatingId === p.id}
                      >
                        {updatingId === p.id
                          ? 'Updating...'
                          : p.status === 'paid'
                          ? 'Mark unpaid'
                          : 'Mark paid'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCreateModal()
          }}
        >
          <div className="invoice-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Create Invoice</h2>
                <p>Logs the invoice here. PayPal sending isn't connected yet.</p>
              </div>
              <button
                type="button"
                className="modal-close-button"
                onClick={closeCreateModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form className="invoice-form" onSubmit={handleCreateInvoice}>
              <label>
                Student
                {loadingStudents ? (
                  <p className="loading-text">Loading students...</p>
                ) : (
                  <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                    <option value="">Select a student</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{!s.active ? ' (inactive)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <div className="invoice-row">
                <label>
                  Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>

                <label>
                  Currency
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="USD">USD</option>
                    <option value="PHP">PHP</option>
                  </select>
                </label>
              </div>

              <label>
                Description
                <input
                  type="text"
                  placeholder="e.g. Tutoring — August sessions"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <label>
                Due date
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>

              {formError && <p className="login-error">{formError}</p>}

              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={closeCreateModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentTracker
