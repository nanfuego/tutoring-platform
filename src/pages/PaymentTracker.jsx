import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import PageHeader from '../components/PageHeader'
import './PaymentTracker.css'

const filters = [
  {
    key: 'all',
    label: 'All',
  },
  {
    key: 'pending',
    label: 'Pending',
  },
  {
    key: 'paid',
    label: 'Paid',
  },
  {
    key: 'overdue',
    label: 'Overdue',
  },
]

function isOverdue(payment) {
  if (
    payment.status === 'paid' ||
    !payment.due_date
  ) {
    return false
  }

  return (
    new Date(payment.due_date) <
    new Date(
      new Date().toDateString()
    )
  )
}

function formatMoney(amount, currency) {
  const symbol =
    currency === 'PHP'
      ? '₱'
      : '$'

  return `${symbol}${Number(
    amount || 0
  ).toFixed(2)}`
}

function getMonthKey(dateString) {
  if (!dateString) {
    return null
  }

  const date =
    new Date(dateString)

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, '0')}`
}

function getLastDayOfMonth(
  year,
  month
) {
  const lastDay =
    new Date(
      year,
      month + 1,
      0
    )

  return lastDay
    .toISOString()
    .slice(0, 10)
}

function getMonthOptions(payments) {
  const options = [
    {
      value: 'all',
      label: 'All Months',
    },
  ]

  const monthSet = new Set()

  payments.forEach((payment) => {
    const date =
      payment.due_date ||
      payment.invoice_date

    if (date) {
      const key =
        getMonthKey(date)

      if (key) {
        monthSet.add(key)
      }
    }
  })

  Array.from(monthSet)
    .sort((a, b) =>
      b.localeCompare(a)
    )
    .forEach((key) => {
      const [year, month] =
        key.split('-').map(Number)

      const label =
        new Date(
          year,
          month - 1
        ).toLocaleString(
          'default',
          {
            month: 'long',
            year: 'numeric',
          }
        )

      options.push({
        value: key,
        label,
      })
    })

  return options
}

function PaymentTracker() {
  const [payments, setPayments] =
    useState([])

  const [students, setStudents] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [loadingStudents, setLoadingStudents] =
    useState(false)

  const [activeFilter, setActiveFilter] =
    useState('all')

  const [search, setSearch] =
    useState('')

  const [schoolFilter, setSchoolFilter] =
    useState('all')

  const [monthFilter, setMonthFilter] =
    useState('all')

  const [updatingId, setUpdatingId] =
    useState(null)

  const [deletingId, setDeletingId] =
    useState(null)

  const [showCreateModal, setShowCreateModal] =
    useState(false)

  const [studentId, setStudentId] =
    useState('')

  const [amount, setAmount] =
    useState('')

  const [currency, setCurrency] =
    useState('USD')

  const [description, setDescription] =
    useState('')

  const [dueDate, setDueDate] =
    useState('')

  const [saving, setSaving] =
    useState(false)

  const [formError, setFormError] =
    useState('')

  const [historyStudent, setHistoryStudent] =
    useState(null)


  async function fetchPayments() {
    setLoading(true)

    const {
      data,
      error,
    } = await supabase
      .from('payments')
      .select(
        '*, students(name, university)'
      )
      .order(
        'due_date',
        {
          ascending: true,
        }
      )

    if (error) {
      console.error(
        'Error loading payments:',
        error
      )
    }

    setPayments(data || [])
    setLoading(false)
  }


  async function fetchStudentsForModal() {
    setLoadingStudents(true)

    const {
      data,
      error,
    } = await supabase
      .from('students')
      .select(
        'id, name, active, university'
      )
      .order('name')

    if (error) {
      console.error(
        'Error loading students:',
        error
      )
    }

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

    if (monthFilter !== 'all') {
      const [
        year,
        month,
      ] = monthFilter
        .split('-')
        .map(Number)

      setDueDate(
        getLastDayOfMonth(
          year,
          month - 1
        )
      )
    } else {
      const now =
        new Date()

      setDueDate(
        getLastDayOfMonth(
          now.getFullYear(),
          now.getMonth()
        )
      )
    }

    setShowCreateModal(true)

    fetchStudentsForModal()
  }


  function closeCreateModal() {
    if (saving) {
      return
    }

    setShowCreateModal(false)
  }


  function openHistoryModal(payment) {
    if (!payment.student_id) {
      return
    }

    setHistoryStudent({
      id: payment.student_id,
      name: payment.students?.name || 'Student',
      university: payment.students?.university || '',
    })
  }


  function closeHistoryModal() {
    setHistoryStudent(null)
  }


  async function handleCreateInvoice(
    event
  ) {
    event.preventDefault()

    setFormError('')

    if (!studentId) {
      setFormError(
        'Please select a student.'
      )
      return
    }

    if (
      !amount ||
      Number(amount) <= 0
    ) {
      setFormError(
        'Please enter a valid amount.'
      )
      return
    }

    setSaving(true)

    const {
      error,
    } = await supabase
      .from('payments')
      .insert({
        student_id:
          studentId,

        amount:
          Number(amount),

        currency,

        description:
          description.trim() ||
          null,

        due_date:
          dueDate || null,

        invoice_date:
          new Date()
            .toISOString()
            .slice(0, 10),

        status:
          'pending',
      })

    setSaving(false)

    if (error) {
      setFormError(
        error.message
      )
      return
    }

    setShowCreateModal(false)

    fetchPayments()
  }


  async function toggleStatus(
    payment
  ) {
    setUpdatingId(
      payment.id
    )

    const newStatus =
      payment.status === 'paid'
        ? 'pending'
        : 'paid'

    const {
      error,
    } = await supabase
      .from('payments')
      .update({
        status: newStatus,
      })
      .eq(
        'id',
        payment.id
      )

    setUpdatingId(null)

    if (!error) {
      setPayments(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              payment.id
                ? {
                    ...item,
                    status:
                      newStatus,
                  }
                : item
          )
      )
    }
  }


  async function handleDelete(
    payment
  ) {
    const confirmed =
      window.confirm(
        `Delete invoice for ${
          payment.students?.name ||
          'this student'
        }?`
      )

    if (!confirmed) {
      return
    }

    setDeletingId(
      payment.id
    )

    const {
      error,
    } = await supabase
      .from('payments')
      .delete()
      .eq(
        'id',
        payment.id
      )

    setDeletingId(null)

    if (!error) {
      setPayments(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              payment.id
          )
      )
    }
  }


  const monthPayments =
    useMemo(() => {
      if (
        monthFilter ===
        'all'
      ) {
        return payments
      }

      return payments.filter(
        (payment) => {
          const date =
            payment.due_date ||
            payment.invoice_date

          return (
            getMonthKey(date) ===
            monthFilter
          )
        }
      )
    }, [
      payments,
      monthFilter,
    ])


  const filtered =
    useMemo(() => {
      let list =
        monthPayments

      if (
        schoolFilter !==
        'all'
      ) {
        list =
          list.filter(
            (payment) =>
              payment.students
                ?.university ===
              schoolFilter
          )
      }

      if (
        activeFilter ===
        'overdue'
      ) {
        list =
          list.filter(
            isOverdue
          )
      } else if (
        activeFilter !==
        'all'
      ) {
        list =
          list.filter(
            (payment) =>
              payment.status ===
              activeFilter
          )
      }

      if (search.trim()) {
        const query =
          search.toLowerCase()

        list =
          list.filter(
            (payment) =>
              payment.students?.name
                ?.toLowerCase()
                .includes(query) ||
              payment.description
                ?.toLowerCase()
                .includes(query)
          )
      }

      return list
    }, [
      monthPayments,
      activeFilter,
      search,
      schoolFilter,
    ])


  const totals =
    useMemo(() => {
      let base =
        monthPayments

      if (
        schoolFilter !==
        'all'
      ) {
        base =
          base.filter(
            (payment) =>
              payment.students
                ?.university ===
              schoolFilter
          )
      }

      const pending =
        base
          .filter(
            (payment) =>
              payment.status !==
              'paid'
          )
          .reduce(
            (sum, payment) =>
              sum +
              Number(
                payment.amount ||
                  0
              ),
            0
          )

      const paid =
        base
          .filter(
            (payment) =>
              payment.status ===
              'paid'
          )
          .reduce(
            (sum, payment) =>
              sum +
              Number(
                payment.amount ||
                  0
              ),
            0
          )

      const overdue =
        base
          .filter(
            isOverdue
          )
          .reduce(
            (sum, payment) =>
              sum +
              Number(
                payment.amount ||
                  0
              ),
            0
          )

      return {
        pending,
        paid,
        overdue,
      }
    }, [
      monthPayments,
      schoolFilter,
    ])


  const studentHistory =
    useMemo(() => {
      if (!historyStudent) {
        return []
      }

      return payments
        .filter(
          (payment) =>
            payment.student_id ===
            historyStudent.id
        )
        .sort((a, b) => {
          const dateA =
            a.due_date ||
            a.invoice_date ||
            ''

          const dateB =
            b.due_date ||
            b.invoice_date ||
            ''

          return dateB.localeCompare(dateA)
        })
    }, [
      payments,
      historyStudent,
    ])


  const monthOptions =
    getMonthOptions(
      payments
    )

  const selectedMonthLabel =
    monthFilter === 'all'
      ? 'All Months'
      : monthOptions.find(
          (option) =>
            option.value ===
            monthFilter
        )?.label || ''


  const selectedStudent =
    students.find(
      (student) =>
        student.id ===
        studentId
    )


  return (
    <div className="payment-tracker-page">

      <PageHeader
        eyebrow="FINANCIAL MANAGEMENT"
        title="Payment Management"
        description="Track student payments, invoices, and payment status."
        actions={
          <button
            type="button"
            className="create-invoice-button activity-primary-button"
            onClick={
              openCreateModal
            }
          >
            + Create Invoice
          </button>
        }
      />


      {/* SUMMARY */}

      <div className="tracker-summary">

        <div className="summary-card">

          <p className="summary-label">
            Outstanding
          </p>

          <p className="summary-value">
            {formatMoney(
              totals.pending,
              'USD'
            )}
          </p>

        </div>


        <div className="summary-card">

          <p className="summary-label">
            Collected
          </p>

          <p className="summary-value paid">
            {formatMoney(
              totals.paid,
              'USD'
            )}
          </p>

        </div>


        <div className="summary-card">

          <p className="summary-label">
            Overdue
          </p>

          <p className="summary-value overdue">
            {formatMoney(
              totals.overdue,
              'USD'
            )}
          </p>

        </div>

      </div>


      {/* FILTERS — single card matching ActivityTracker */}

      <section className="tracker-filter-card">

        <div className="tracker-filter-search">
          <span className="tracker-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search student or description..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
          {search && (
            <button
              type="button"
              className="tracker-clear-search"
              onClick={() => setSearch('')}
            >
              ×
            </button>
          )}
        </div>

        <select
          className="tracker-filter-select"
          value={monthFilter}
          onChange={(event) =>
            setMonthFilter(event.target.value)
          }
        >
          {monthOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>

        <select
          className="tracker-filter-select"
          value={schoolFilter}
          onChange={(event) =>
            setSchoolFilter(event.target.value)
          }
        >
          <option value="all">All Schools</option>
          <option value="AUHS">AUHS</option>
          <option value="PACIFIC">PACIFIC</option>
        </select>

        <div className="tracker-filter-pills">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={
                activeFilter === filter.key
                  ? 'tracker-filter-pill active'
                  : 'tracker-filter-pill'
              }
              onClick={() =>
                setActiveFilter(filter.key)
              }
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="tracker-filter-count">
          Showing{' '}
          <strong>{filtered.length}</strong>
          {' '}of{' '}
          <strong>{payments.length}</strong>
        </div>

      </section>


      {/* PAYMENT TABLE */}

      {loading ? (

        <div className="tracker-state-card">
          <div className="tracker-spinner" />
          <strong>Loading payments</strong>
          <span>Please wait while invoices are loaded.</span>
        </div>

      ) : filtered.length === 0 ? (

        <div className="tracker-state-card">
          <strong>No invoices found</strong>
          <span>
            No invoices
            {monthFilter !== 'all' &&
              ` for ${selectedMonthLabel}`}
            {schoolFilter !== 'all' &&
              ` (${schoolFilter})`}
            . Try changing your filters.
          </span>
        </div>

      ) : (

        <div className="tracker-table-card">

          <div className="tracker-table-wrapper">

            <table className="tracker-table">

              <thead>
                <tr>
                  <th>Student</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>

                {filtered.map((payment) => {
                  const overdue = isOverdue(payment)

                  return (
                    <tr key={payment.id}>

                      <td>
                        <button
                          type="button"
                          className="tracker-student-cell tracker-student-cell-clickable"
                          onClick={() =>
                            openHistoryModal(payment)
                          }
                          title={`View payment history for ${
                            payment.students?.name || 'this student'
                          }`}
                        >
                          <strong>
                            {payment.students?.name || '—'}
                          </strong>
                          <span>
                            {payment.students?.university ||
                              '—'}
                          </span>
                        </button>
                      </td>

                      <td
                        className="desc-cell"
                        title={payment.description || undefined}
                      >
                        {payment.description || '—'}
                      </td>

                      <td className="tracker-amount">
                        {formatMoney(
                          payment.amount,
                          payment.currency
                        )}
                      </td>

                      <td>
                        <div className="tracker-dates-cell">
                          <span>
                            Inv{' '}
                            {payment.invoice_date || '—'}
                          </span>
                          <span
                            className={
                              overdue ? 'overdue-date' : ''
                            }
                          >
                            Due{' '}
                            {payment.due_date || '—'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            payment.status === 'paid'
                              ? 'status-badge active'
                              : overdue
                                ? 'status-badge overdue'
                                : 'status-badge inactive'
                          }
                        >
                          {payment.status === 'paid'
                            ? 'Paid'
                            : overdue
                              ? 'Overdue'
                              : 'Pending'}
                        </span>
                      </td>

                      <td>
                        <div className="tracker-actions">
                          <button
                            type="button"
                            className="mark-paid-button"
                            onClick={() =>
                              toggleStatus(payment)
                            }
                            disabled={
                              updatingId === payment.id
                            }
                          >
                            {updatingId === payment.id
                              ? '...'
                              : payment.status === 'paid'
                                ? 'Unpaid'
                                : 'Paid'}
                          </button>

                          <button
                            type="button"
                            className="delete-button"
                            onClick={() =>
                              handleDelete(payment)
                            }
                            disabled={
                              deletingId === payment.id
                            }
                          >
                            {deletingId === payment.id
                              ? '...'
                              : 'Delete'}
                          </button>
                        </div>
                      </td>

                    </tr>
                  )
                })}

              </tbody>

            </table>

          </div>

        </div>

      )}


      {/* CREATE INVOICE MODAL */}

      {showCreateModal && (

        <div
          className="invoice-modal-overlay"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal()
            }
          }}
        >

          <div
            className="invoice-modal invoice-modal-modern"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-invoice-title"
            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="invoice-modal-header">

              <div>

                <div className="invoice-modal-kicker">
                  PAYMENT TRACKER
                </div>

                <h2 id="create-invoice-title">
                  Create Invoice
                </h2>

                <p>
                  {monthFilter !==
                  'all'
                    ? `New invoice · ${selectedMonthLabel}`
                    : 'Create a new invoice for a student'}
                </p>

              </div>


              <button
                type="button"
                className="invoice-modal-close"
                onClick={
                  closeCreateModal
                }
                disabled={saving}
                aria-label="Close create invoice modal"
              >
                ×
              </button>

            </div>


            <form
              className="invoice-form-modern"
              onSubmit={
                handleCreateInvoice
              }
            >

              <section className="invoice-form-section">

                <div className="invoice-section-heading">

                  <span className="invoice-section-number">
                    01
                  </span>

                  <div>
                    <strong>
                      Student
                    </strong>

                    <span>
                      Select who this invoice belongs to
                    </span>
                  </div>

                </div>


                {loadingStudents ? (

                  <div className="invoice-select-loading">
                    <span className="invoice-spinner" />
                    Loading students...
                  </div>

                ) : (

                  <label className="invoice-field">

                    <span>
                      Student <b>*</b>
                    </span>

                    <select
                      value={studentId}
                      onChange={(
                        event
                      ) =>
                        setStudentId(
                          event.target
                            .value
                        )
                      }
                    >

                      <option value="">
                        Select a student
                      </option>

                      {students.map(
                        (student) => (
                          <option
                            key={
                              student.id
                            }
                            value={
                              student.id
                            }
                          >
                            {student.name}
                            {' '}
                            (
                            {
                              student.university
                            }
                            )
                            {!student.active &&
                              ' (inactive)'}
                          </option>
                        )
                      )}

                    </select>

                  </label>

                )}


                {selectedStudent && (

                  <div className="invoice-student-preview">

                    <div className="invoice-student-avatar">

                      {selectedStudent.name
                        ?.split(' ')
                        .map(
                          (part) =>
                            part[0]
                        )
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}

                    </div>

                    <div>

                      <strong>
                        {
                          selectedStudent.name
                        }
                      </strong>

                      <span>
                        {
                          selectedStudent.university ||
                          'School not assigned'
                        }

                        {!selectedStudent.active &&
                          ' · Inactive'}
                      </span>

                    </div>

                    <span className="invoice-status-chip">
                      PENDING
                    </span>

                  </div>

                )}

              </section>


              <section className="invoice-form-section">

                <div className="invoice-section-heading">

                  <span className="invoice-section-number">
                    02
                  </span>

                  <div>

                    <strong>
                      Invoice Details
                    </strong>

                    <span>
                      Amount, description and payment deadline
                    </span>

                  </div>

                </div>


                <div className="invoice-field-row invoice-field-row-main">

                  <label className="invoice-field invoice-field-wide">

                    <span>
                      Description
                    </span>

                    <input
                      type="text"
                      placeholder="e.g. Tutoring — August sessions"
                      value={
                        description
                      }
                      onChange={(
                        event
                      ) =>
                        setDescription(
                          event.target
                            .value
                        )
                      }
                    />

                  </label>


                  <label className="invoice-field">

                    <span>
                      Amount <b>*</b>
                    </span>

                    <div className="invoice-amount-input">

                      <span>
                        {currency ===
                        'PHP'
                          ? '₱'
                          : '$'}
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(
                          event
                        ) =>
                          setAmount(
                            event.target
                              .value
                          )
                        }
                      />

                    </div>

                  </label>

                </div>


                <div className="invoice-field-row">

                  <label className="invoice-field">

                    <span>
                      Currency
                    </span>

                    <select
                      value={currency}
                      onChange={(
                        event
                      ) =>
                        setCurrency(
                          event.target
                            .value
                        )
                      }
                    >

                      <option value="USD">
                        USD — US Dollar
                      </option>

                      <option value="PHP">
                        PHP — Philippine Peso
                      </option>

                    </select>

                  </label>


                  <label className="invoice-field">

                    <span>
                      Due date
                    </span>

                    <input
                      type="date"
                      value={dueDate}
                      onChange={(
                        event
                      ) =>
                        setDueDate(
                          event.target
                            .value
                        )
                      }
                    />

                  </label>

                </div>


                <div className="invoice-pending-note">

                  <span className="invoice-pending-dot" />

                  <div>

                    <strong>
                      Invoice starts as Pending
                    </strong>

                    <span>
                      You can mark it as paid later from the Payments table.
                    </span>

                  </div>

                </div>

              </section>


              {formError && (

                <div
                  className="invoice-form-error"
                  role="alert"
                >
                  <span>!</span>
                  <div>
                    {formError}
                  </div>
                </div>

              )}


              <div className="invoice-modal-footer">

                <button
                  type="button"
                  className="invoice-cancel-button"
                  onClick={
                    closeCreateModal
                  }
                  disabled={saving}
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="invoice-create-button"
                  disabled={
                    saving ||
                    loadingStudents
                  }
                >
                  {saving
                    ? 'Creating...'
                    : 'Create Invoice'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}


      {/* STUDENT PAYMENT HISTORY MODAL */}

      {historyStudent && (

        <div
          className="invoice-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeHistoryModal()
            }
          }}
        >

          <div
            className="invoice-modal history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-history-title"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="invoice-modal-header">

              <div>

                <div className="invoice-modal-kicker">
                  PAYMENT HISTORY
                </div>

                <h2 id="payment-history-title">
                  {historyStudent.name}
                </h2>

                <p>
                  {historyStudent.university ||
                    'Full invoice history for this student'}
                </p>

              </div>


              <button
                type="button"
                className="invoice-modal-close"
                onClick={closeHistoryModal}
                aria-label="Close payment history modal"
              >
                ×
              </button>

            </div>


            {studentHistory.length === 0 ? (

              <div className="tracker-state-card history-empty-state">
                <strong>No invoices yet</strong>
                <span>
                  This student doesn't have any payment records.
                </span>
              </div>

            ) : (

              <div className="tracker-table-wrapper history-table-wrapper">

                <table className="tracker-table history-table">

                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Invoice</th>
                      <th>Due</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>

                    {studentHistory.map((payment) => {
                      const overdue = isOverdue(payment)

                      return (
                        <tr key={payment.id}>

                          <td
                            className="desc-cell"
                            title={payment.description || undefined}
                          >
                            {payment.description || '—'}
                          </td>

                          <td className="tracker-amount">
                            {formatMoney(
                              payment.amount,
                              payment.currency
                            )}
                          </td>

                          <td>
                            {payment.invoice_date || '—'}
                          </td>

                          <td
                            className={
                              overdue ? 'overdue-date' : ''
                            }
                          >
                            {payment.due_date || '—'}
                          </td>

                          <td>
                            <span
                              className={
                                payment.status === 'paid'
                                  ? 'status-badge active'
                                  : overdue
                                    ? 'status-badge overdue'
                                    : 'status-badge inactive'
                              }
                            >
                              {payment.status === 'paid'
                                ? 'Paid'
                                : overdue
                                  ? 'Overdue'
                                  : 'Pending'}
                            </span>
                          </td>

                        </tr>
                      )
                    })}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </div>

      )}

    </div>
  )
}

export default PaymentTracker