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

function getMonthKey(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getLastDayOfMonth(year, month) {
  // month is 0-based
  const lastDay = new Date(year, month + 1, 0)
  return lastDay.toISOString().slice(0, 10)
}

function getMonthOptions(payments) {
  const options = [{ value: 'all', label: 'All Months' }]

  // Collect unique months from the payments
  const monthSet = new Set()

  payments.forEach((p) => {
    const dateToUse = p.due_date || p.invoice_date
    if (dateToUse) {
      const key = getMonthKey(dateToUse)
      if (key) monthSet.add(key)
    }
  })

  // Convert to array and sort (newest first)
  const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a))

  sortedMonths.forEach((key) => {
    const [year, month] = key.split('-').map(Number)
    const label = new Date(year, month - 1).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    })
    options.push({ value: key, label })
  })

  return options
}

function PaymentTracker() {
  const navigate = useNavigate()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all') // default = All Months
  const [updatingId, setUpdatingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

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
      .select('*, students(name, university)')
      .order('due_date', { ascending: true })
    setPayments(data || [])
    setLoading(false)
  }

  async function fetchStudentsForModal() {
    setLoadingStudents(true)
    const { data } = await supabase
      .from('students')
      .select('id, name, active, university')
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

    // Pre-fill due date
    if (monthFilter !== 'all') {
      const [y, m] = monthFilter.split('-').map(Number)
      setDueDate(getLastDayOfMonth(y, m - 1))
    } else {
      const now = new Date()
      setDueDate(getLastDayOfMonth(now.getFullYear(), now.getMonth()))
    }

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

  async function handleDelete(payment) {
    if (!window.confirm(`Delete invoice for ${payment.students?.name || 'this student'}?`)) return

    setDeletingId(payment.id)
    const { error } = await supabase.from('payments').delete().eq('id', payment.id)
    setDeletingId(null)

    if (!error) {
      setPayments((current) => current.filter((p) => p.id !== payment.id))
    }
  }

  // Filter by month
  const monthPayments = useMemo(() => {
    if (monthFilter === 'all') return payments

    return payments.filter((p) => {
      const dateToUse = p.due_date || p.invoice_date
      return getMonthKey(dateToUse) === monthFilter
    })
  }, [payments, monthFilter])

  // Apply school + status + search
  const filtered = useMemo(() => {
    let list = monthPayments

    if (schoolFilter !== 'all') {
      list = list.filter((p) => p.students?.university === schoolFilter)
    }

    if (activeFilter === 'overdue') {
      list = list.filter(isOverdue)
    } else if (activeFilter !== 'all') {
      list = list.filter((p) => p.status === activeFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.students?.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      )
    }

    return list
  }, [monthPayments, activeFilter, search, schoolFilter])

  const totals = useMemo(() => {
    let base = monthPayments
    if (schoolFilter !== 'all') {
      base = base.filter((p) => p.students?.university === schoolFilter)
    }

    const pendingTotal = base
      .filter((p) => p.status !== 'paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    const paidTotal = base
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    const overdueTotal = base
      .filter(isOverdue)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    return { pendingTotal, paidTotal, overdueTotal }
  }, [monthPayments, schoolFilter])

  const monthOptions = getMonthOptions(payments)
  const selectedMonthLabel =
    monthFilter === 'all'
      ? 'All Months'
      : monthOptions.find((o) => o.value === monthFilter)?.label || ''

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

 
      {/* Summary Cards */}
      <div className="tracker-summary">
        <div className="summary-card">
          <p className="summary-label">Outstanding</p>
          <p className="summary-value">{formatMoney(totals.pendingTotal, 'USD')}</p>
        </div>
        <div className="summary-card">
          <p className="summary-label">Collected</p>
          <p className="summary-value paid">{formatMoney(totals.paidTotal, 'USD')}</p>
        </div>
        <div className="summary-card">
          <p className="summary-label">Overdue</p>
          <p className="summary-value overdue">{formatMoney(totals.overdueTotal, 'USD')}</p>
        </div>
      </div>

  {/* Search + Month + School Filters */}
<div className="tracker-controls">
  <input
    type="text"
    className="tracker-search"
    placeholder="Search student or description..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />

  <select
    className="month-filter"
    value={monthFilter}
    onChange={(e) => setMonthFilter(e.target.value)}
  >
    {monthOptions.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>

  <select
    className="school-filter"
    value={schoolFilter}
    onChange={(e) => setSchoolFilter(e.target.value)}
  >
    <option value="all">All Schools</option>
    <option value="AUHS">AUHS</option>
    <option value="PACIFIC">PACIFIC</option>
  </select>
</div>

      {/* Status Filters */}
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
        <p className="empty-table">
          No invoices
          {monthFilter !== 'all' ? ` for ${selectedMonthLabel}` : ''}
          {schoolFilter !== 'all' ? ` (${schoolFilter})` : ''}.
        </p>
      ) : (
        <div className="tracker-table-wrapper">
          <table className="tracker-table">
            <thead>
  <tr>
    <th>Student</th>
    <th>School</th>
    <th>Description</th>
    <th>Amount</th>
    <th>Invoice Date</th>
    <th>Due</th>
    <th>Status</th>
    <th>Action</th>
    <th></th>
  </tr>
</thead>
            <tbody>
              {filtered.map((p) => {
                const overdue = isOverdue(p)
                return (
                  <tr key={p.id}>
                    <td>{p.students?.name || '—'}</td>
                    <td>{p.students?.university || '—'}</td>
                    <td className="desc-cell">{p.description || '—'}</td>
                    <td>{formatMoney(p.amount, p.currency)}</td>
                    <td>{p.invoice_date || '—'}</td>
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
<td>
  <button
    className="delete-button"
    onClick={() => handleDelete(p)}
    disabled={deletingId === p.id}
  >
    {deletingId === p.id ? '...' : 'Delete'}
  </button>
</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Invoice Modal */}
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
                <p>
                  {monthFilter !== 'all'
                    ? `Will appear under ${selectedMonthLabel}`
                    : 'Select a due date for this invoice'}
                </p>
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
                        {s.name} ({s.university}){!s.active ? ' (inactive)' : ''}
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
                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeCreateModal}
                  disabled={saving}
                >
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