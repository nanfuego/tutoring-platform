import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
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

  const numberValue = Number(amount || 0)
  
  // Format with thousands separators
  const formattedAmount = numberValue
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  return `${symbol}${formattedAmount}`
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

  // Main payment table pagination
  const PAYMENTS_PER_PAGE = 10
  const [currentPage, setCurrentPage] =
    useState(1)

  const [updatingId, setUpdatingId] =
    useState(null)

  const [deletingId, setDeletingId] =
    useState(null)

  const [showCreateModal, setShowCreateModal] =
    useState(false)

  const [studentId, setStudentId] =
    useState('')

  const [selectedStudentIds, setSelectedStudentIds] =
    useState([])

  const [studentSearch, setStudentSearch] =
    useState('')

  const [showStudentDropdown, setShowStudentDropdown] =
    useState(false)

  const [amount, setAmount] =
    useState('')

  const [currency, setCurrency] =
    useState('USD')

  const [paymentMethod, setPaymentMethod] =
    useState('PayPal')

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

  const [usdPhpRate, setUsdPhpRate] =
    useState(null)

  const [fxLoading, setFxLoading] =
    useState(true)

  const [fxUpdated, setFxUpdated] =
    useState('')


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

  useEffect(() => {
    if (!showStudentDropdown) {
      return undefined
    }

    function handleStudentPickerOutsideClick(event) {
      if (!event.target.closest('.invoice-student-picker')) {
        setShowStudentDropdown(false)
      }
    }

    document.addEventListener(
      'pointerdown',
      handleStudentPickerOutsideClick
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleStudentPickerOutsideClick
      )
    }
  }, [showStudentDropdown])

  useEffect(() => {
    let cancelled = false

    async function fetchUsdPhpRate() {
      setFxLoading(true)

      try {
        const response = await fetch(
          'https://open.er-api.com/v6/latest/USD'
        )

        if (!response.ok) {
          throw new Error('Unable to load exchange rate')
        }

        const data = await response.json()
        const rate = Number(data?.rates?.PHP)

        if (!Number.isFinite(rate) || rate <= 0) {
          throw new Error('Invalid exchange rate')
        }

        if (!cancelled) {
          setUsdPhpRate(rate)
          setFxUpdated(data?.time_last_update_utc || '')
        }
      } catch (error) {
        console.error('Error loading USD/PHP exchange rate:', error)
      } finally {
        if (!cancelled) setFxLoading(false)
      }
    }

    fetchUsdPhpRate()

    return () => {
      cancelled = true
    }
  }, [])


  function openCreateModal() {
    setFormError('')
    setStudentId('')
    setSelectedStudentIds([])
    setStudentSearch('')
    setShowStudentDropdown(false)
    setAmount('')
    setCurrency('USD')
    setPaymentMethod('PayPal')
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

    if (!selectedStudentIds.length) {
      setFormError(
        'Please select at least one student.'
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

    try {
      const invoicesToCreate = selectedStudentIds.map((studentId) => ({
        student_id: studentId,
        amount: Number(amount),
        currency,
        payment_method: paymentMethod,
        description: description.trim() || null,
        due_date: dueDate || null,
        invoice_date: new Date().toISOString().slice(0, 10),
        status: 'pending',
      }))

      const { error } = await supabase
        .from('payments')
        .insert(invoicesToCreate)

      if (error) {
        throw error
      }

      setShowCreateModal(false)
      fetchPayments()
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSaving(false)
    }
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


  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAYMENTS_PER_PAGE)
  )

  const paginatedPayments = useMemo(() => {
    const startIndex =
      (currentPage - 1) * PAYMENTS_PER_PAGE

    return filtered.slice(
      startIndex,
      startIndex + PAYMENTS_PER_PAGE
    )
  }, [filtered, currentPage])

  const pageStart = filtered.length
    ? (currentPage - 1) * PAYMENTS_PER_PAGE + 1
    : 0

  const pageEnd = Math.min(
    currentPage * PAYMENTS_PER_PAGE,
    filtered.length
  )

  // Start from page 1 whenever the visible payment set changes by filter.
  useEffect(() => {
    setCurrentPage(1)
  }, [search, schoolFilter, monthFilter, activeFilter])

  // Keep the page valid after cancelling/deleting invoices.
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])


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


  const historySummary =
    useMemo(() => {
      const totalBilled = studentHistory.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0
      )

      const totalPaid = studentHistory
        .filter((payment) => payment.status === 'paid')
        .reduce(
          (sum, payment) => sum + Number(payment.amount || 0),
          0
        )

      const outstanding = Math.max(0, totalBilled - totalPaid)

      return {
        invoiceCount: studentHistory.length,
        totalBilled,
        totalPaid,
        outstanding,
      }
    }, [studentHistory])


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


  const selectedStudentsForInvoice =
    students.filter((student) =>
      selectedStudentIds.includes(student.id)
    )

  const filteredStudentsForPicker =
    students.filter((student) => {
      const query =
        studentSearch.trim().toLowerCase()

      if (!query) return true

      const name =
        String(student.name || '').toLowerCase()
      const university =
        String(student.university || '').toLowerCase()

      return (
        name.includes(query) ||
        university.includes(query)
      )
    })


  return (
    <div className="payment-tracker-page">

      <section className="activity-page-header">
        <div className="activity-page-header-copy">
          <span className="activity-eyebrow">
            FINANCIAL MANAGEMENT
          </span>
          <h1>Payment Management</h1>
          <p>
            Track student payments, invoices, and payment status.
          </p>
        </div>
        <div className="activity-page-actions">
          <button
            type="button"
            className="activity-primary-button"
            onClick={openCreateModal}
          >
            <span className="button-plus">+</span>
            Create Invoice
          </button>
        </div>
      </section>


  

    {/* SUMMARY */}

{/* SUMMARY */}

<div className="tracker-summary">

  <div className="summary-card summary-card-fx">

    <p className="summary-label">
      USD → PHP
    </p>

    <p className="summary-value fx-value">
      {fxLoading
        ? 'Loading...'
        : usdPhpRate
          ? `₱${usdPhpRate.toFixed(2)}`
          : '—'}
    </p>

    <span className="fx-caption">
      {fxUpdated
        ? `1 USD · Updated ${new Date(fxUpdated).toLocaleDateString()}`
        : 'Daily reference rate'}
      <span className="fx-live-dot" />
    </span>

  </div>

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

    {usdPhpRate && (
      <p className="summary-conversion">
        ≈ {formatMoney(
          totals.pending * usdPhpRate,
          'PHP'
        )}
      </p>
    )}

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

    {usdPhpRate && (
      <p className="summary-conversion">
        ≈ {formatMoney(
          totals.paid * usdPhpRate,
          'PHP'
        )}
      </p>
    )}

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

    {usdPhpRate && (
      <p className="summary-conversion">
        ≈ {formatMoney(
          totals.overdue * usdPhpRate,
          'PHP'
        )}
      </p>
    )}

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

          <div className="tracker-table-wrapper payment-main-table-wrapper">

            <table className="tracker-table payment-main-table">

              <thead>
                <tr>
                  <th>Student</th>
                  <th>Dates</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th className="payment-actions-header">Actions</th>
                </tr>
              </thead>

              <tbody>

                {paginatedPayments.map((payment) => {
                  const overdue = isOverdue(payment)

                  return (
                    <tr key={payment.id}>

                      <td>
                        <button
                          type="button"
                          className="tracker-student-cell tracker-student-cell-clickable student-person"
                          onClick={() =>
                            openHistoryModal(payment)
                          }
                          title={`View payment history for ${
                            payment.students?.name || 'this student'
                          }`}
                        >
                          <div className="student-avatar">
                            {payment.students?.name
                              ?.charAt(0)
                              ?.toUpperCase() || '?'}
                          </div>
                          <div className="student-person-info">
                            <strong>
                              {payment.students?.name || '—'}
                            </strong>
                            <span>
                              {payment.students?.university ||
                                '—'}
                            </span>
                          </div>
                        </button>
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
                        <span className="payment-method-badge">
                          {payment.payment_method || '—'}
                        </span>
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

                      <td className="tracker-amount">
                        {formatMoney(
                          payment.amount,
                          payment.currency
                        )}
                      </td>

                      <td
                        className="desc-cell"
                        title={payment.description || undefined}
                      >
                        {payment.description || '—'}
                      </td>

                      <td className="payment-actions-cell">
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
                              : 'Cancel'}
                          </button>
                        </div>
                      </td>

                    </tr>
                  )
                })}

              </tbody>

            </table>

          </div>

          <div className="tracker-pagination">
            <div className="tracker-pagination-info">
              Showing <strong>{pageStart}–{pageEnd}</strong> of{' '}
              <strong>{filtered.length}</strong> invoices
            </div>

            <div className="tracker-pagination-controls">
              <button
                type="button"
                className="tracker-pagination-button"
                onClick={() =>
                  setCurrentPage((page) => Math.max(1, page - 1))
                }
                disabled={currentPage === 1}
              >
                ← Previous
              </button>

              <span className="tracker-pagination-page">
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </span>

              <button
                type="button"
                className="tracker-pagination-button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
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
            className="invoice-modal invoice-modal-modern invoice-modal-wide"
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
                    : 'Create a new invoice for multiple students'}
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
                      Students
                    </strong>

                    <span>
                      Select one or more students for this invoice
                    </span>
                  </div>

                </div>


                {loadingStudents ? (

                  <div className="invoice-select-loading">
                    <span className="invoice-spinner" />
                    Loading students...
                  </div>

                ) : (

                  <div className="invoice-field invoice-student-picker-field">

                    <span>
                      Students <b>*</b>
                    </span>

                    <div
                      className={
                        showStudentDropdown
                          ? 'invoice-student-picker open'
                          : 'invoice-student-picker'
                      }
                      onMouseDown={() =>
                        setShowStudentDropdown(true)
                      }
                    >

                      <div className="invoice-student-search-wrap">

                        <span className="invoice-student-search-icon">
                          ⌕
                        </span>

                        <input
                          type="text"
                          className="invoice-student-search"
                          placeholder={
                            selectedStudentIds.length > 0
                              ? `${selectedStudentIds.length} student${selectedStudentIds.length > 1 ? 's' : ''} selected`
                              : 'Search students...'
                          }
                          value={studentSearch}
                          onFocus={() => setShowStudentDropdown(true)}
                          onChange={(event) => {
                            setStudentSearch(event.target.value)
                            setShowStudentDropdown(true)
                          }}
                          autoComplete="off"
                          aria-label="Search students"
                        />

                        {studentSearch && (
                          <button
                            type="button"
                            className="invoice-student-search-clear"
                            onClick={() => setStudentSearch('')}
                            aria-label="Clear student search"
                          >
                            ×
                          </button>
                        )}

                        <span className="invoice-student-chevron">
                          {showStudentDropdown ? '' : ''}
                        </span>

                      </div>

                      {showStudentDropdown && (

                        <div className="invoice-student-dropdown">

                          {filteredStudentsForPicker.length === 0 ? (

                            <div className="invoice-student-empty">
                              No students found
                            </div>

                          ) : (

                            <div className="invoice-student-card-grid">
                              {filteredStudentsForPicker.map((student) => (

                                <button
                                  type="button"
                                  key={student.id}
                                  className={
                                    selectedStudentIds.includes(student.id)
                                      ? 'invoice-student-card selected'
                                      : 'invoice-student-card'
                                  }
                                  onClick={() => {
                                    setSelectedStudentIds((current) => {
                                      if (current.includes(student.id)) {
                                        return current.filter(
                                          (id) => id !== student.id
                                        )
                                      }

                                      return [...current, student.id]
                                    })

                                    setStudentSearch('')
                                  }}
                                >

                                  <span className="invoice-student-card-avatar">
                                    {student.name
                                      ?.split(' ')
                                      .map((part) => part[0])
                                      .join('')
                                      .slice(0, 2)
                                      .toUpperCase() || '?'}
                                  </span>

                                  <span className="invoice-student-card-info">
                                    <strong>{student.name}</strong>
                                    <span>
                                      {student.university || 'School not assigned'}
                                      {!student.active && ' · Inactive'}
                                    </span>
                                  </span>

                                  {selectedStudentIds.includes(student.id) && (
                                    <span className="invoice-student-card-check">✓</span>
                                  )}

                                </button>

                              ))}
                            </div>

                          )}

                        </div>

                      )}

                    </div>

                  </div>

                )}

                {selectedStudentsForInvoice.length > 0 && (
                  <div className="invoice-selected-students-section">
                    <div className="invoice-selected-students-header">
                      <span className="invoice-selected-count">
                        {selectedStudentsForInvoice.length} student{selectedStudentsForInvoice.length > 1 ? 's' : ''} selected
                      </span>
                    </div>
                    <div className="invoice-selected-students-bubbles">
                      {selectedStudentsForInvoice.map((student) => (
                        <div key={student.id} className="invoice-selected-student-bubble">
                          <div className="invoice-selected-student-avatar">
                            {student.name
                              ?.split(' ')
                              .map((part) => part[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="invoice-selected-student-name">
                            {student.name}
                          </div>
                          <button
                            type="button"
                            className="invoice-selected-student-remove"
                            onClick={() => {
                              setSelectedStudentIds((current) =>
                                current.filter((id) => id !== student.id)
                              )
                            }}
                            aria-label={`Remove ${student.name}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
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
                      Amount, payment method, description and payment deadline
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
                      Payment Method
                    </span>

                    <select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value)
                      }
                    >
                      <option value="PayPal">
                        PayPal
                      </option>
                      <option value="G-Cash">
                        G-Cash
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
                    loadingStudents ||
                    selectedStudentIds.length === 0
                  }
                >
                  {saving
                    ? 'Creating...'
                    : `Create Invoice${selectedStudentIds.length > 1 ? ` (${selectedStudentIds.length})` : ''}`}
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

              <>
                <div className="history-summary-grid">
                  <div className="history-summary-card">
                    <span>Invoices</span>
                    <strong>{historySummary.invoiceCount}</strong>
                  </div>

                  <div className="history-summary-card">
                    <span>Total billed</span>
                    <strong>{formatMoney(historySummary.totalBilled, 'USD')}</strong>
                  </div>

                  <div className="history-summary-card history-summary-card-paid">
                    <span>Paid</span>
                    <strong>{formatMoney(historySummary.totalPaid, 'USD')}</strong>
                  </div>

                  <div className="history-summary-card history-summary-card-outstanding">
                    <span>Outstanding</span>
                    <strong>{formatMoney(historySummary.outstanding, 'USD')}</strong>
                  </div>
                </div>

                <div className="history-section-heading">
                  <div>
                    <strong>Invoice history</strong>
                    <span>Most recent invoice first</span>
                  </div>
                </div>

                <div className="tracker-table-wrapper history-table-wrapper">

                  <table className="tracker-table history-table">

                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Method</th>
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
                            <span className="payment-method-badge">
                              {payment.payment_method || '—'}
                            </span>
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
              </>

            )}

          </div>

        </div>

      )}

    </div>
  )
}

export default PaymentTracker