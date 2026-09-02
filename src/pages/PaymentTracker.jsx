import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import './PaymentTracker.css'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'partial', label: 'Partially Paid' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
]

const PAYMENTS_PER_PAGE = 10

function formatMoney(amount, currency = 'USD') {
  const symbol = currency === 'PHP' ? '₱' : '$'
  const value = Number(amount || 0)
  return `${symbol}${value
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getMonthKey(dateString) {
  if (!dateString) return null
  const raw = String(dateString).slice(0, 10)
  const [year, month] = raw.split('-')
  return year && month ? `${year}-${month}` : null
}

function getLastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0).toISOString().slice(0, 10)
}

function getMonthOptions(payments) {
  const months = new Set()

  payments.forEach((payment) => {
    const key = getMonthKey(payment.due_date || payment.invoice_date)
    if (key) months.add(key)
  })

  return [
    { value: 'all', label: 'All Months' },
    ...Array.from(months)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const [year, month] = key.split('-').map(Number)
        return {
          value: key,
          label: new Date(year, month - 1).toLocaleString('default', {
            month: 'long',
            year: 'numeric',
          }),
        }
      }),
  ]
}

function getPayerName(payment) {
  return payment.students?.name || payment.payer_name || 'Other payer'
}

function getPayerSubtitle(payment) {
  if (payment.student_id) {
    return payment.students?.university || 'Student'
  }
  return payment.payer_email || payment.payer_phone || 'External payer'
}

function getPaidAmount(payment) {
  const invoiceAmount = Math.max(0, Number(payment.amount || 0))
  const recordedPaid = Math.max(0, Number(payment.amount_paid || 0))

  // amount_paid is the source of truth for money actually received.
  // Never infer a collected amount from the invoice status alone.
  return Math.min(recordedPaid, invoiceAmount)
}

function getBalance(payment) {
  const invoiceAmount = Math.max(0, Number(payment.amount || 0))
  return Math.max(0, invoiceAmount - getPaidAmount(payment))
}

function isOverdue(payment) {
  if (!payment.due_date || getBalance(payment) <= 0) return false
  const due = new Date(`${String(payment.due_date).slice(0, 10)}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

function getDisplayStatus(payment) {
  const total = Number(payment.amount || 0)
  const paid = getPaidAmount(payment)
  const balance = getBalance(payment)

  if (balance <= 0 && total > 0) return 'paid'
  if (isOverdue(payment)) return 'overdue'
  if (paid > 0 && paid < total) return 'partial'
  return 'pending'
}

function statusLabel(status) {
  if (status === 'paid') return 'Paid'
  if (status === 'partial') return 'Partially Paid'
  if (status === 'overdue') return 'Overdue'
  return 'Pending'
}

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function PaymentTracker() {
  const [payments, setPayments] = useState([])
  const [transactions, setTransactions] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)

  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  const [updatingId, setUpdatingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // Create invoice
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [payerType, setPayerType] = useState('student')
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [showStudentDropdown, setShowStudentDropdown] = useState(false)
  const [payerName, setPayerName] = useState('')
  const [payerEmail, setPayerEmail] = useState('')
  const [payerPhone, setPayerPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [paymentMethod, setPaymentMethod] = useState('PayPal')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Edit invoice
  const [editingPayment, setEditingPayment] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [editCurrency, setEditCurrency] = useState('USD')
  const [editPaymentMethod, setEditPaymentMethod] = useState('PayPal')
  const [editDescription, setEditDescription] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editStatus, setEditStatus] = useState('pending')
  const [editNotes, setEditNotes] = useState('')
  const [editPayerName, setEditPayerName] = useState('')
  const [editPayerEmail, setEditPayerEmail] = useState('')
  const [editPayerPhone, setEditPayerPhone] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Record payment
  const [recordingPayment, setRecordingPayment] = useState(null)
  const [receivedAmount, setReceivedAmount] = useState('')
  const [receivedMethod, setReceivedMethod] = useState('PayPal')
  const [receivedReference, setReceivedReference] = useState('')
  const [receivedDate, setReceivedDate] = useState('')
  const [receivedNotes, setReceivedNotes] = useState('')
  const [recordSaving, setRecordSaving] = useState(false)
  const [recordError, setRecordError] = useState('')

  // History
  const [historyPayer, setHistoryPayer] = useState(null)

  // FX
  const [usdPhpRate, setUsdPhpRate] = useState(null)
  const [fxLoading, setFxLoading] = useState(true)
  const [fxUpdated, setFxUpdated] = useState('')

  async function fetchPayments() {
    setLoading(true)

    const [paymentRes, transactionRes] = await Promise.all([
      supabase
        .from('payments')
        .select('*, students(name, university)')
        .order('due_date', { ascending: true }),
      supabase
        .from('payment_transactions')
        .select('*')
        .order('paid_at', { ascending: false }),
    ])

    if (paymentRes.error) {
      console.error('Error loading payments:', paymentRes.error)
    }

    if (transactionRes.error) {
      console.error('Error loading payment transactions:', transactionRes.error)
    }

    const paymentRows = paymentRes.data || []
    const transactionRows = transactionRes.data || []

    // Normalize the paid amount from real payment transactions.
    // A plain Pending invoice with no recorded transaction must display $0.00 paid,
    // even if an older/stale amount_paid value exists in the payments table.
    const paidByPaymentId = new Map()

    transactionRows.forEach((transaction) => {
      const paymentId = transaction.payment_id
      const amountReceived = Math.max(0, Number(transaction.amount || 0))

      paidByPaymentId.set(
        paymentId,
        (paidByPaymentId.get(paymentId) || 0) + amountReceived
      )
    })

    const normalizedPayments = paymentRows.map((payment) => {
      const invoiceAmount = Math.max(0, Number(payment.amount || 0))
      const hasRecordedTransactions = paidByPaymentId.has(payment.id)

      let effectivePaid = 0

      if (hasRecordedTransactions) {
        // Real recorded payments are the strongest source of truth.
        effectivePaid = paidByPaymentId.get(payment.id) || 0
      } else if (payment.status === 'paid') {
        // Preserve legacy paid invoices that existed before transaction logging.
        effectivePaid = Math.max(0, Number(payment.amount_paid || invoiceAmount))
      } else {
        // Pending with no transaction means nothing has actually been collected.
        effectivePaid = 0
      }

      return {
        ...payment,
        amount_paid: Math.min(effectivePaid, invoiceAmount),
      }
    })

    setPayments(normalizedPayments)
    setTransactions(transactionRows)
    setLoading(false)
  }

  async function fetchStudentsForModal() {
    setLoadingStudents(true)

    const { data, error } = await supabase
      .from('students')
      .select('id, name, active, university')
      .order('name')

    if (error) {
      console.error('Error loading students:', error)
    }

    setStudents(data || [])
    setLoadingStudents(false)
  }

  useEffect(() => {
    fetchPayments()
  }, [])

  useEffect(() => {
    if (!showStudentDropdown) return undefined

    function closeStudentPicker(event) {
      if (!event.target.closest('.invoice-student-picker')) {
        setShowStudentDropdown(false)
      }
    }

    document.addEventListener('pointerdown', closeStudentPicker)
    return () => document.removeEventListener('pointerdown', closeStudentPicker)
  }, [showStudentDropdown])

  useEffect(() => {
    let cancelled = false

    async function fetchRate() {
      setFxLoading(true)
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD')
        if (!response.ok) throw new Error('Unable to load exchange rate')
        const data = await response.json()
        const rate = Number(data?.rates?.PHP)
        if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid exchange rate')
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

    fetchRate()
    return () => {
      cancelled = true
    }
  }, [])

  function openCreateModal() {
    const now = new Date()
    let defaultDue = getLastDayOfMonth(now.getFullYear(), now.getMonth())

    if (monthFilter !== 'all') {
      const [year, month] = monthFilter.split('-').map(Number)
      defaultDue = getLastDayOfMonth(year, month - 1)
    }

    setFormError('')
    setPayerType('student')
    setSelectedStudentIds([])
    setStudentSearch('')
    setShowStudentDropdown(false)
    setPayerName('')
    setPayerEmail('')
    setPayerPhone('')
    setAmount('')
    setCurrency('USD')
    setPaymentMethod('PayPal')
    setDescription('')
    setDueDate(defaultDue)
    setPaymentNotes('')
    setShowCreateModal(true)
    fetchStudentsForModal()
  }

  function closeCreateModal() {
    if (!saving) setShowCreateModal(false)
  }

  async function handleCreateInvoice(event) {
    event.preventDefault()
    setFormError('')

    if (payerType === 'student' && !selectedStudentIds.length) {
      setFormError('Please select at least one student.')
      return
    }

    if (payerType === 'other' && !payerName.trim()) {
      setFormError('Please enter a payer or client name.')
      return
    }

    if (!amount || Number(amount) <= 0) {
      setFormError('Please enter a valid amount.')
      return
    }

    setSaving(true)

    try {
      const common = {
        amount: Number(amount),
        currency,
        payment_method: paymentMethod,
        description: description.trim() || null,
        due_date: dueDate || null,
        invoice_date: new Date().toISOString().slice(0, 10),
        status: 'pending',
        amount_paid: 0,
        paid_at: null,
        transaction_reference: null,
        payment_notes: paymentNotes.trim() || null,
      }

      const rows = payerType === 'student'
        ? selectedStudentIds.map((selectedId) => ({
            ...common,
            payer_type: 'student',
            student_id: selectedId,
            payer_name: null,
            payer_email: null,
            payer_phone: null,
          }))
        : [
            {
              ...common,
              payer_type: 'other',
              student_id: null,
              payer_name: payerName.trim(),
              payer_email: payerEmail.trim() || null,
              payer_phone: payerPhone.trim() || null,
            },
          ]

      const { error } = await supabase.from('payments').insert(rows)
      if (error) throw error

      setShowCreateModal(false)
      await fetchPayments()
    } catch (error) {
      setFormError(error.message || 'Unable to create invoice.')
    } finally {
      setSaving(false)
    }
  }

  async function markAsPaid(payment) {
    const balance = getBalance(payment)
    if (balance <= 0) return

    setUpdatingId(payment.id)

    try {
      const now = new Date().toISOString()

      const { error: transactionError } = await supabase
        .from('payment_transactions')
        .insert({
          payment_id: payment.id,
          amount: balance,
          payment_method: payment.payment_method || null,
          transaction_reference: null,
          payment_notes: 'Marked as paid from Payment Tracker',
          paid_at: now,
        })

      if (transactionError) throw transactionError

      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          amount_paid: Number(payment.amount || 0),
          paid_at: now,
        })
        .eq('id', payment.id)

      if (updateError) throw updateError

      await fetchPayments()
    } catch (error) {
      console.error('Error marking invoice as paid:', error)
      window.alert(error.message || 'Unable to mark invoice as paid.')
    } finally {
      setUpdatingId(null)
    }
  }

  function openRecordPayment(payment) {
    const balance = getBalance(payment)
    setRecordingPayment(payment)
    setReceivedAmount(balance > 0 ? String(balance) : '')
    setReceivedMethod(payment.payment_method || 'PayPal')
    setReceivedReference('')
    setReceivedDate(new Date().toISOString().slice(0, 10))
    setReceivedNotes('')
    setRecordError('')
  }

  function closeRecordPayment() {
    if (!recordSaving) setRecordingPayment(null)
  }

  async function handleRecordPayment(event) {
    event.preventDefault()
    if (!recordingPayment) return

    setRecordError('')
    const received = Number(receivedAmount)
    const balance = getBalance(recordingPayment)

    if (!received || received <= 0) {
      setRecordError('Please enter a valid amount received.')
      return
    }

    if (received > balance + 0.00001) {
      setRecordError(`Amount received cannot be more than the remaining balance of ${formatMoney(balance, recordingPayment.currency)}.`)
      return
    }

    setRecordSaving(true)

    try {
      const paidAt = receivedDate
        ? new Date(`${receivedDate}T12:00:00`).toISOString()
        : new Date().toISOString()

      const { data: transaction, error: transactionError } = await supabase
        .from('payment_transactions')
        .insert({
          payment_id: recordingPayment.id,
          amount: received,
          payment_method: receivedMethod || null,
          transaction_reference: receivedReference.trim() || null,
          payment_notes: receivedNotes.trim() || null,
          paid_at: paidAt,
        })
        .select()
        .single()

      if (transactionError) throw transactionError

      const newPaid = Math.min(
        Number(recordingPayment.amount || 0),
        getPaidAmount(recordingPayment) + received
      )
      const fullyPaid = newPaid >= Number(recordingPayment.amount || 0)

      const { error: updateError } = await supabase
        .from('payments')
        .update({
          amount_paid: newPaid,
          status: fullyPaid ? 'paid' : 'pending',
          paid_at: fullyPaid ? paidAt : recordingPayment.paid_at || null,
          transaction_reference:
            transaction?.transaction_reference ||
            receivedReference.trim() ||
            recordingPayment.transaction_reference ||
            null,
        })
        .eq('id', recordingPayment.id)

      if (updateError) throw updateError

      setRecordingPayment(null)
      await fetchPayments()
    } catch (error) {
      setRecordError(error.message || 'Unable to record payment.')
    } finally {
      setRecordSaving(false)
    }
  }

  function openEditModal(payment) {
    setEditingPayment(payment)
    setEditAmount(String(payment.amount ?? ''))
    setEditCurrency(payment.currency || 'USD')
    setEditPaymentMethod(payment.payment_method || 'PayPal')
    setEditDescription(payment.description || '')
    setEditDueDate(payment.due_date || '')
    setEditStatus(getBalance(payment) <= 0 ? 'paid' : 'pending')
    setEditNotes(payment.payment_notes || '')
    setEditPayerName(payment.payer_name || '')
    setEditPayerEmail(payment.payer_email || '')
    setEditPayerPhone(payment.payer_phone || '')
    setEditError('')
  }

  function closeEditModal() {
    if (!editSaving) setEditingPayment(null)
  }

  async function handleEditInvoice(event) {
    event.preventDefault()
    if (!editingPayment) return

    setEditError('')
    const newAmount = Number(editAmount)

    if (!newAmount || newAmount <= 0) {
      setEditError('Please enter a valid amount.')
      return
    }

    if (newAmount < getPaidAmount(editingPayment)) {
      setEditError('Invoice amount cannot be lower than the amount already paid.')
      return
    }

    const changingPaidToPending =
      getBalance(editingPayment) <= 0 && editStatus === 'pending'

    if (
      changingPaidToPending &&
      !window.confirm(
        'Mark this invoice as pending again? This will reset its recorded payment transactions and paid amount.'
      )
    ) {
      return
    }

    setEditSaving(true)

    try {
      let amountPaid = getPaidAmount(editingPayment)
      let paidAt = editingPayment.paid_at || null

      if (editStatus === 'paid') {
        const previouslyPaid = getPaidAmount(editingPayment)
        const remainingToRecord = Math.max(0, newAmount - previouslyPaid)
        paidAt = paidAt || new Date().toISOString()

        if (remainingToRecord > 0) {
          const { error: txError } = await supabase
            .from('payment_transactions')
            .insert({
              payment_id: editingPayment.id,
              amount: remainingToRecord,
              payment_method: editPaymentMethod || null,
              transaction_reference: null,
              payment_notes: 'Marked paid while editing invoice',
              paid_at: paidAt,
            })
          if (txError) throw txError
        }

        amountPaid = newAmount
      }

      if (changingPaidToPending) {
        const { error: deleteTxError } = await supabase
          .from('payment_transactions')
          .delete()
          .eq('payment_id', editingPayment.id)
        if (deleteTxError) throw deleteTxError
        amountPaid = 0
        paidAt = null
      }

      const updates = {
        amount: newAmount,
        currency: editCurrency,
        payment_method: editPaymentMethod,
        description: editDescription.trim() || null,
        due_date: editDueDate || null,
        payment_notes: editNotes.trim() || null,
        amount_paid: amountPaid,
        status: editStatus === 'paid' ? 'paid' : 'pending',
        paid_at: paidAt,
      }

      if (!editingPayment.student_id) {
        if (!editPayerName.trim()) {
          setEditError('Payer name is required.')
          setEditSaving(false)
          return
        }
        updates.payer_name = editPayerName.trim()
        updates.payer_email = editPayerEmail.trim() || null
        updates.payer_phone = editPayerPhone.trim() || null
      }

      const { error } = await supabase
        .from('payments')
        .update(updates)
        .eq('id', editingPayment.id)

      if (error) throw error

      setEditingPayment(null)
      await fetchPayments()
    } catch (error) {
      setEditError(error.message || 'Unable to update invoice.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(payment) {
    const confirmed = window.confirm(
      `Cancel and remove invoice for ${getPayerName(payment)}?`
    )
    if (!confirmed) return

    setDeletingId(payment.id)

    try {
      const { error } = await supabase.from('payments').delete().eq('id', payment.id)
      if (error) throw error
      setPayments((current) => current.filter((item) => item.id !== payment.id))
      setTransactions((current) => current.filter((item) => item.payment_id !== payment.id))
    } catch (error) {
      window.alert(error.message || 'Unable to cancel invoice.')
    } finally {
      setDeletingId(null)
    }
  }

  function openHistoryModal(payment) {
    if (payment.student_id) {
      setHistoryPayer({
        type: 'student',
        key: payment.student_id,
        name: payment.students?.name || 'Student',
        subtitle: payment.students?.university || 'Student',
      })
      return
    }

    const email = String(payment.payer_email || '').trim().toLowerCase()
    const name = String(payment.payer_name || '').trim().toLowerCase()

    setHistoryPayer({
      type: 'other',
      key: email || name || payment.id,
      name: payment.payer_name || 'Other payer',
      subtitle: payment.payer_email || payment.payer_phone || 'External payer',
      email,
      normalizedName: name,
      invoiceId: payment.id,
    })
  }

  const monthPayments = useMemo(() => {
    if (monthFilter === 'all') return payments
    return payments.filter(
      (payment) => getMonthKey(payment.due_date || payment.invoice_date) === monthFilter
    )
  }, [payments, monthFilter])

  const filtered = useMemo(() => {
    let list = monthPayments

    if (schoolFilter !== 'all') {
      list = list.filter((payment) => {
        if (!payment.student_id) return schoolFilter === 'other'
        return payment.students?.university === schoolFilter
      })
    }

    if (activeFilter !== 'all') {
      list = list.filter((payment) => getDisplayStatus(payment) === activeFilter)
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase()
      list = list.filter((payment) =>
        [
          getPayerName(payment),
          getPayerSubtitle(payment),
          payment.description,
          payment.transaction_reference,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    }

    return list
  }, [monthPayments, schoolFilter, activeFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAYMENTS_PER_PAGE))
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * PAYMENTS_PER_PAGE
    return filtered.slice(start, start + PAYMENTS_PER_PAGE)
  }, [filtered, currentPage])

  const pageStart = filtered.length ? (currentPage - 1) * PAYMENTS_PER_PAGE + 1 : 0
  const pageEnd = Math.min(currentPage * PAYMENTS_PER_PAGE, filtered.length)

  useEffect(() => {
    setCurrentPage(1)
  }, [search, schoolFilter, monthFilter, activeFilter])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const totals = useMemo(() => {
    let base = monthPayments

    if (schoolFilter !== 'all') {
      base = base.filter((payment) => {
        if (!payment.student_id) return schoolFilter === 'other'
        return payment.students?.university === schoolFilter
      })
    }

    return base.reduce(
      (acc, payment) => {
        const balance = getBalance(payment)
        const paid = getPaidAmount(payment)
        acc.outstanding += balance
        acc.paid += paid
        if (isOverdue(payment)) acc.overdue += balance
        return acc
      },
      { outstanding: 0, paid: 0, overdue: 0 }
    )
  }, [monthPayments, schoolFilter])

  const monthOptions = getMonthOptions(payments)
  const selectedMonthLabel =
    monthFilter === 'all'
      ? 'All Months'
      : monthOptions.find((option) => option.value === monthFilter)?.label || ''

  const selectedStudentsForInvoice = students.filter((student) =>
    selectedStudentIds.includes(student.id)
  )

  const filteredStudentsForPicker = students.filter((student) => {
    const query = studentSearch.trim().toLowerCase()
    if (!query) return true
    return `${student.name || ''} ${student.university || ''}`.toLowerCase().includes(query)
  })

  const historyPayments = useMemo(() => {
    if (!historyPayer) return []

    return payments
      .filter((payment) => {
        if (historyPayer.type === 'student') {
          return payment.student_id === historyPayer.key
        }

        const email = String(payment.payer_email || '').trim().toLowerCase()
        const name = String(payment.payer_name || '').trim().toLowerCase()
        if (historyPayer.email) return email === historyPayer.email
        if (historyPayer.normalizedName) return name === historyPayer.normalizedName
        return payment.id === historyPayer.invoiceId
      })
      .sort((a, b) =>
        String(b.invoice_date || b.due_date || '').localeCompare(
          String(a.invoice_date || a.due_date || '')
        )
      )
  }, [payments, historyPayer])

  const historySummary = useMemo(() => {
    return historyPayments.reduce(
      (acc, payment) => {
        acc.invoiceCount += 1
        acc.totalBilled += Number(payment.amount || 0)
        acc.totalPaid += getPaidAmount(payment)
        acc.outstanding += getBalance(payment)
        if (isOverdue(payment)) acc.overdue += getBalance(payment)
        if (getDisplayStatus(payment) === 'partial') acc.partialCount += 1
        return acc
      },
      {
        invoiceCount: 0,
        totalBilled: 0,
        totalPaid: 0,
        outstanding: 0,
        overdue: 0,
        partialCount: 0,
      }
    )
  }, [historyPayments])

  const historyTransactions = useMemo(() => {
    if (!historyPayments.length) return []
    const paymentIds = new Set(historyPayments.map((payment) => payment.id))
    return transactions
      .filter((transaction) => paymentIds.has(transaction.payment_id))
      .sort((a, b) =>
        String(b.paid_at || '').localeCompare(String(a.paid_at || ''))
      )
  }, [transactions, historyPayments])

  const historyCollectionRate = useMemo(() => {
    if (!historySummary.totalBilled) return 0
    return Math.min(
      100,
      Math.round((historySummary.totalPaid / historySummary.totalBilled) * 100)
    )
  }, [historySummary])

  const selectedPaymentTransactions = useMemo(() => {
    if (!recordingPayment && !editingPayment) return []
    const id = recordingPayment?.id || editingPayment?.id
    return transactions.filter((transaction) => transaction.payment_id === id)
  }, [transactions, recordingPayment, editingPayment])

  return (
    <div className="payment-tracker-page">
      <section className="activity-page-header">
        <div className="activity-page-header-copy">
          <span className="activity-eyebrow">FINANCIAL MANAGEMENT</span>
          <h1>Payment Management</h1>
          <p>Track invoices, student payments, external clients, balances, and payment history.</p>
        </div>

        <div className="activity-page-actions">
          <button type="button" className="activity-primary-button" onClick={openCreateModal}>
            <span className="button-plus">+</span>
            Create Invoice
          </button>
        </div>
      </section>

      <div className="tracker-summary">
        <div className="summary-card summary-card-fx">
          <p className="summary-label">USD → PHP</p>
          <span className="summary-conversion-label">Conversion Rate</span>
          <p className="summary-value fx-value">
            {fxLoading ? 'Loading...' : usdPhpRate ? `₱${usdPhpRate.toFixed(2)}` : '—'}
          </p>
          <span className="summary-subtext">
            {fxUpdated ? 'Live reference rate' : 'Exchange rate reference'}
          </span>
        </div>

        <div className="summary-card summary-card-outstanding">
          <p className="summary-label">Outstanding</p>
          <p className="summary-value">{formatMoney(totals.outstanding, 'USD')}</p>
          <span className="summary-php-conversion">
            {usdPhpRate
              ? `≈ ₱${(Number(totals.outstanding || 0) * usdPhpRate).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'PHP conversion unavailable'}
          </span>
          <span className="summary-subtext">Remaining balance</span>
        </div>

        <div className="summary-card summary-card-collected">
          <p className="summary-label">Collected</p>
          <p className="summary-value">{formatMoney(totals.paid, 'USD')}</p>
          <span className="summary-php-conversion">
            {usdPhpRate
              ? `≈ ₱${(Number(totals.paid || 0) * usdPhpRate).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'PHP conversion unavailable'}
          </span>
          <span className="summary-subtext">Payments received</span>
        </div>

        <div className="summary-card summary-card-overdue">
          <p className="summary-label">Overdue</p>
          <p className="summary-value">{formatMoney(totals.overdue, 'USD')}</p>
          <span className="summary-php-conversion">
            {usdPhpRate
              ? `≈ ₱${(Number(totals.overdue || 0) * usdPhpRate).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'PHP conversion unavailable'}
          </span>
          <span className="summary-subtext">Past due balance</span>
        </div>
      </div>

      <div className="tracker-toolbar">
        <div className="tracker-filter-tabs">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={activeFilter === filter.key ? 'tracker-filter active' : 'tracker-filter'}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="tracker-toolbar-controls">
          <input
            type="search"
            className="tracker-search"
            placeholder="Search payer or description..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}>
            <option value="all">All Payers</option>
            <option value="AUHS">AUHS</option>
            <option value="PACIFIC">PACIFIC</option>
            <option value="other">Other Clients</option>
          </select>

          <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="tracker-state-card">
          <strong>Loading payments...</strong>
        </div>
      ) : filtered.length === 0 ? (
        <div className="tracker-state-card">
          <strong>No invoices found</strong>
          <span>Try changing your filters or create a new invoice.</span>
        </div>
      ) : (
        <div className="tracker-table-card">
          <div className="tracker-table-wrapper payment-main-table-wrapper">
            <table className="tracker-table payment-main-table">
              <thead>
                <tr>
                  <th>Payer</th>
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
                  const displayStatus = getDisplayStatus(payment)
                  const balance = getBalance(payment)
                  const paid = getPaidAmount(payment)
                  const payer = getPayerName(payment)

                  return (
                    <tr key={payment.id}>
                      <td>
                        <button
                          type="button"
                          className="tracker-student-cell tracker-student-cell-clickable student-person"
                          onClick={() => openHistoryModal(payment)}
                          title={`View payment history for ${payer}`}
                        >
                          <div className="student-avatar">{initials(payer)}</div>
                          <div className="student-person-info">
                            <strong>{payer}</strong>
                            <span>{getPayerSubtitle(payment)}</span>
                          </div>
                        </button>
                      </td>

                      <td>
                        <div className="tracker-dates-cell">
                          <span>Inv {formatDate(payment.invoice_date)}</span>
                          <span className={displayStatus === 'overdue' ? 'overdue-date' : ''}>
                            Due {formatDate(payment.due_date)}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="payment-method-badge">{payment.payment_method || '—'}</span>
                      </td>

                      <td>
                        <span
                          className={
                            displayStatus === 'paid'
                              ? 'status-badge active'
                              : displayStatus === 'overdue'
                                ? 'status-badge overdue'
                                : displayStatus === 'partial'
                                  ? 'status-badge partial'
                                  : 'status-badge inactive'
                          }
                        >
                          {statusLabel(displayStatus)}
                        </span>
                      </td>

                      <td className="tracker-amount">
                        <div className="payment-amount-stack">
                          <strong>{formatMoney(payment.amount, payment.currency)}</strong>
                          {paid > 0 && displayStatus !== 'paid' && (
                            <span>{formatMoney(paid, payment.currency)} paid</span>
                          )}
                          {balance > 0 && (
                            <span>{formatMoney(balance, payment.currency)} balance</span>
                          )}
                        </div>
                      </td>

                      <td className="desc-cell" title={payment.description || undefined}>
                        {payment.description || '—'}
                      </td>

                      <td className="payment-actions-cell">
                        <div className="tracker-actions payment-row-actions payment-row-actions-v2">
                          {displayStatus === 'paid' ? (
                            <span className="paid-action-indicator">✓ Paid</span>
                          ) : (
                            <button
                              type="button"
                              className="payment-action-primary"
                              disabled={updatingId === payment.id}
                              onClick={() => markAsPaid(payment)}
                            >
                              {updatingId === payment.id ? 'Saving...' : 'Mark as Paid'}
                            </button>
                          )}

                          {displayStatus !== 'paid' && (
                            <button
                              type="button"
                              className="payment-action-secondary"
                              onClick={() => openRecordPayment(payment)}
                            >
                              Record
                            </button>
                          )}

                          <button
                            type="button"
                            className="payment-action-edit"
                            onClick={() => openEditModal(payment)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="payment-action-cancel"
                            disabled={deletingId === payment.id}
                            onClick={() => handleDelete(payment)}
                          >
                            {deletingId === payment.id ? '...' : 'Cancel'}
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
            <span>Showing {pageStart}–{pageEnd} of {filtered.length} invoices</span>
            <div className="tracker-pagination-actions">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE INVOICE */}
      {showCreateModal && (
        <div
          className="invoice-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateModal()
          }}
        >
          <div
            className="invoice-modal invoice-modal-modern invoice-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-invoice-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="invoice-modal-header">
              <div>
                <div className="invoice-modal-kicker">PAYMENT TRACKER</div>
                <h2 id="create-invoice-title">Create Invoice</h2>
                <p>
                  {monthFilter !== 'all'
                    ? `New invoice · ${selectedMonthLabel}`
                    : 'Create an invoice for a student or another client'}
                </p>
              </div>
              <button
                type="button"
                className="invoice-modal-close"
                onClick={closeCreateModal}
                disabled={saving}
                aria-label="Close create invoice modal"
              >
                ×
              </button>
            </div>

            <form className="invoice-form-modern" onSubmit={handleCreateInvoice}>
              <section className="invoice-form-section">
                <div className="invoice-section-heading">
                  <span className="invoice-section-number">01</span>
                  <div>
                    <strong>Bill To</strong>
                    <span>Choose whether this invoice belongs to a student or another payer.</span>
                  </div>
                </div>

                <div className="payer-type-switch">
                  <button
                    type="button"
                    className={payerType === 'student' ? 'is-active' : ''}
                    onClick={() => {
                      setPayerType('student')
                      setFormError('')
                    }}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    className={payerType === 'other' ? 'is-active' : ''}
                    onClick={() => {
                      setPayerType('other')
                      setSelectedStudentIds([])
                      setShowStudentDropdown(false)
                      setFormError('')
                    }}
                  >
                    Other / Client
                  </button>
                </div>

                {payerType === 'student' ? (
                  <>
                    {loadingStudents ? (
                      <div className="invoice-select-loading">
                        <span className="invoice-spinner" /> Loading students...
                      </div>
                    ) : (
                      <div className="invoice-field invoice-student-picker-field">
                        <span>Students <b>*</b></span>
                        <div
                          className={showStudentDropdown ? 'invoice-student-picker open' : 'invoice-student-picker'}
                          onMouseDown={() => setShowStudentDropdown(true)}
                        >
                          <div className="invoice-student-search-wrap">
                            <span className="invoice-student-search-icon">⌕</span>
                            <input
                              type="text"
                              className="invoice-student-search"
                              placeholder={
                                selectedStudentIds.length
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
                            />
                            {studentSearch && (
                              <button
                                type="button"
                                className="invoice-student-search-clear"
                                onClick={() => setStudentSearch('')}
                              >
                                ×
                              </button>
                            )}
                          </div>

                          {showStudentDropdown && (
                            <div className="invoice-student-dropdown">
                              {filteredStudentsForPicker.length === 0 ? (
                                <div className="invoice-student-empty">No students found</div>
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
                                        setSelectedStudentIds((current) =>
                                          current.includes(student.id)
                                            ? current.filter((id) => id !== student.id)
                                            : [...current, student.id]
                                        )
                                        setStudentSearch('')
                                      }}
                                    >
                                      <span className="invoice-student-card-avatar">{initials(student.name)}</span>
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
                              <div className="invoice-selected-student-avatar">{initials(student.name)}</div>
                              <div className="invoice-selected-student-name">{student.name}</div>
                              <button
                                type="button"
                                className="invoice-selected-student-remove"
                                onClick={() =>
                                  setSelectedStudentIds((current) =>
                                    current.filter((id) => id !== student.id)
                                  )
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="external-payer-grid">
                    <label className="invoice-field invoice-field-wide">
                      <span>Name / Client <b>*</b></span>
                      <input
                        type="text"
                        placeholder="e.g. ABC Consulting"
                        value={payerName}
                        onChange={(event) => setPayerName(event.target.value)}
                      />
                    </label>
                    <label className="invoice-field">
                      <span>Email</span>
                      <input
                        type="email"
                        placeholder="client@example.com"
                        value={payerEmail}
                        onChange={(event) => setPayerEmail(event.target.value)}
                      />
                    </label>
                    <label className="invoice-field">
                      <span>Phone</span>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={payerPhone}
                        onChange={(event) => setPayerPhone(event.target.value)}
                      />
                    </label>
                  </div>
                )}
              </section>

              <section className="invoice-form-section">
                <div className="invoice-section-heading">
                  <span className="invoice-section-number">02</span>
                  <div>
                    <strong>Invoice Details</strong>
                    <span>Amount, payment method, description, notes, and deadline.</span>
                  </div>
                </div>

                <div className="invoice-field-row invoice-field-row-main">
                  <label className="invoice-field invoice-field-wide">
                    <span>Description</span>
                    <input
                      type="text"
                      placeholder="e.g. Tutoring — September sessions"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </label>

                  <label className="invoice-field">
                    <span>Amount <b>*</b></span>
                    <div className="invoice-amount-input">
                      <span>{currency === 'PHP' ? '₱' : '$'}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                      />
                    </div>
                  </label>
                </div>

                <div className="invoice-field-row">
                  <label className="invoice-field">
                    <span>Currency</span>
                    <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                      <option value="USD">USD — US Dollar</option>
                      <option value="PHP">PHP — Philippine Peso</option>
                    </select>
                  </label>

                  <label className="invoice-field">
                    <span>Payment Method</span>
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                      <option value="PayPal">PayPal</option>
                      <option value="G-Cash">G-Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label className="invoice-field">
                    <span>Due date</span>
                    <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                  </label>
                </div>

                <label className="invoice-field invoice-field-full">
                  <span>Payment notes</span>
                  <textarea
                    rows="3"
                    placeholder="Internal note, special arrangement, payment instructions..."
                    value={paymentNotes}
                    onChange={(event) => setPaymentNotes(event.target.value)}
                  />
                </label>

                <div className="invoice-pending-note">
                  <span className="invoice-pending-dot" />
                  <div>
                    <strong>Invoice starts as Pending</strong>
                    <span>Use Record Payment for partial payments or Mark as Paid when the full amount is received.</span>
                  </div>
                </div>
              </section>

              {formError && (
                <div className="invoice-form-error" role="alert">
                  <span>!</span><div>{formError}</div>
                </div>
              )}

              <div className="invoice-modal-footer">
                <button type="button" className="invoice-cancel-button" onClick={closeCreateModal} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="invoice-create-button"
                  disabled={
                    saving ||
                    (payerType === 'student' && (loadingStudents || selectedStudentIds.length === 0)) ||
                    (payerType === 'other' && !payerName.trim())
                  }
                >
                  {saving
                    ? 'Creating...'
                    : payerType === 'student' && selectedStudentIds.length > 1
                      ? `Create Invoices (${selectedStudentIds.length})`
                      : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT */}
      {recordingPayment && (
        <div
          className="invoice-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRecordPayment()
          }}
        >
          <div
            className="invoice-modal invoice-modal-modern record-payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-payment-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="invoice-modal-header">
              <div>
                <div className="invoice-modal-kicker">PAYMENT RECEIVED</div>
                <h2 id="record-payment-title">Record Payment</h2>
                <p>
                  {getPayerName(recordingPayment)} · Remaining balance{' '}
                  <strong>{formatMoney(getBalance(recordingPayment), recordingPayment.currency)}</strong>
                </p>
              </div>
              <button
                type="button"
                className="invoice-modal-close"
                onClick={closeRecordPayment}
                disabled={recordSaving}
              >
                ×
              </button>
            </div>

            <form className="invoice-form" onSubmit={handleRecordPayment}>
              <section className="invoice-form-section">
                <div className="record-payment-balance-card">
                  <div className="record-payment-balance-item">
                    <span>Invoice</span>
                    <strong>
                      {formatMoney(
                        recordingPayment.amount,
                        recordingPayment.currency
                      )}
                    </strong>
                  </div>

                  <div className="record-payment-balance-item">
                    <span>Already paid</span>
                    <strong>
                      {formatMoney(
                        getPaidAmount(recordingPayment),
                        recordingPayment.currency
                      )}
                    </strong>
                  </div>

                  <div className="record-payment-balance-item">
                    <span>Balance</span>
                    <strong>
                      {formatMoney(
                        getBalance(recordingPayment),
                        recordingPayment.currency
                      )}
                    </strong>
                  </div>
                </div>

                <div className="invoice-field-row">
                  <label className="invoice-field">
                    <span>Amount received <b>*</b></span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={receivedAmount}
                      onChange={(event) => setReceivedAmount(event.target.value)}
                    />
                  </label>

                  <label className="invoice-field">
                    <span>Payment method</span>
                    <select value={receivedMethod} onChange={(event) => setReceivedMethod(event.target.value)}>
                      <option value="PayPal">PayPal</option>
                      <option value="G-Cash">G-Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label className="invoice-field">
                    <span>Date received</span>
                    <input type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} />
                  </label>
                </div>

                <label className="invoice-field">
                  <span>Transaction / Reference</span>
                  <input
                    type="text"
                    placeholder="PayPal transaction ID, G-Cash reference, etc."
                    value={receivedReference}
                    onChange={(event) => setReceivedReference(event.target.value)}
                  />
                </label>

                <label className="invoice-field invoice-field-full">
                  <span>Payment notes</span>
                  <textarea
                    rows="3"
                    placeholder="Optional note about this payment"
                    value={receivedNotes}
                    onChange={(event) => setReceivedNotes(event.target.value)}
                  />
                </label>

                {selectedPaymentTransactions.length > 0 && (
                  <div className="transaction-mini-history">
                    <strong>Previous payments</strong>
                    {selectedPaymentTransactions.slice(0, 4).map((transaction) => (
                      <div key={transaction.id}>
                        <span>{formatDate(transaction.paid_at)}</span>
                        <span>{transaction.payment_method || '—'}</span>
                        <strong>{formatMoney(transaction.amount, recordingPayment.currency)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {recordError && (
                <div className="invoice-form-error" role="alert">
                  <span>!</span><div>{recordError}</div>
                </div>
              )}

              <div className="invoice-modal-footer">
                <button type="button" className="invoice-cancel-button" onClick={closeRecordPayment} disabled={recordSaving}>
                  Cancel
                </button>
                <button type="submit" className="invoice-create-button" disabled={recordSaving}>
                  {recordSaving ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT INVOICE */}
      {editingPayment && (
        <div
          className="invoice-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditModal()
          }}
        >
          <div
            className="invoice-modal invoice-modal-modern edit-invoice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-invoice-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="invoice-modal-header">
              <div>
                <div className="invoice-modal-kicker">PAYMENT TRACKER</div>
                <h2 id="edit-invoice-title">Edit Invoice</h2>
                <p>Update invoice details for <strong>{getPayerName(editingPayment)}</strong>.</p>
              </div>
              <button
                type="button"
                className="invoice-modal-close"
                onClick={closeEditModal}
                disabled={editSaving}
              >
                ×
              </button>
            </div>

            <form className="invoice-form" onSubmit={handleEditInvoice}>
              <section className="invoice-form-section">
                <div className="edit-invoice-student-card">
                  <div className="student-avatar">{initials(getPayerName(editingPayment))}</div>
                  <div>
                    <strong>{getPayerName(editingPayment)}</strong>
                    <span>{getPayerSubtitle(editingPayment)}</span>
                  </div>
                  <span className="edit-invoice-locked-label">
                    {editingPayment.student_id ? 'Student locked' : 'External payer'}
                  </span>
                </div>

                {!editingPayment.student_id && (
                  <div className="external-payer-grid edit-external-payer-grid">
                    <label className="invoice-field invoice-field-wide">
                      <span>Name / Client <b>*</b></span>
                      <input value={editPayerName} onChange={(event) => setEditPayerName(event.target.value)} />
                    </label>
                    <label className="invoice-field">
                      <span>Email</span>
                      <input type="email" value={editPayerEmail} onChange={(event) => setEditPayerEmail(event.target.value)} />
                    </label>
                    <label className="invoice-field">
                      <span>Phone</span>
                      <input value={editPayerPhone} onChange={(event) => setEditPayerPhone(event.target.value)} />
                    </label>
                  </div>
                )}

                <div className="invoice-field-row invoice-field-row-main">
                  <label className="invoice-field invoice-field-wide">
                    <span>Description</span>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                    />
                  </label>

                  <label className="invoice-field">
                    <span>Amount <b>*</b></span>
                    <div className="invoice-amount-input">
                      <span>{editCurrency === 'PHP' ? '₱' : '$'}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editAmount}
                        onChange={(event) => setEditAmount(event.target.value)}
                      />
                    </div>
                  </label>
                </div>

                <div className="invoice-field-row edit-invoice-grid">
                  <label className="invoice-field">
                    <span>Currency</span>
                    <select value={editCurrency} onChange={(event) => setEditCurrency(event.target.value)}>
                      <option value="USD">USD — US Dollar</option>
                      <option value="PHP">PHP — Philippine Peso</option>
                    </select>
                  </label>

                  <label className="invoice-field">
                    <span>Payment Method</span>
                    <select value={editPaymentMethod} onChange={(event) => setEditPaymentMethod(event.target.value)}>
                      <option value="PayPal">PayPal</option>
                      <option value="G-Cash">G-Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label className="invoice-field">
                    <span>Due date</span>
                    <input type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} />
                  </label>

                  <label className="invoice-field">
                    <span>Status</span>
                    <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>
                </div>

                <label className="invoice-field invoice-field-full">
                  <span>Payment notes</span>
                  <textarea rows="3" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
                </label>

                <div className="edit-payment-summary">
                  <div>
                    <span>Paid</span>
                    <strong>{formatMoney(getPaidAmount(editingPayment), editingPayment.currency)}</strong>
                  </div>
                  <div>
                    <span>Balance</span>
                    <strong>{formatMoney(getBalance(editingPayment), editingPayment.currency)}</strong>
                  </div>
                  <div>
                    <span>Last reference</span>
                    <strong>{editingPayment.transaction_reference || '—'}</strong>
                  </div>
                </div>
              </section>

              {editError && (
                <div className="invoice-form-error" role="alert">
                  <span>!</span><div>{editError}</div>
                </div>
              )}

              <div className="invoice-modal-footer">
                <button type="button" className="invoice-cancel-button" onClick={closeEditModal} disabled={editSaving}>
                  Cancel
                </button>
                <button type="submit" className="invoice-create-button" disabled={editSaving}>
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYER PAYMENT HISTORY */}
      {historyPayer && (
        <div
          className="invoice-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHistoryPayer(null)
          }}
        >
          <div
            className="invoice-modal history-modal history-modal-v3"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-history-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="invoice-modal-header history-v3-header">
              <div className="history-v3-identity">
                <div className="history-v3-avatar" aria-hidden="true">
                  {initials(historyPayer.name)}
                </div>
                <div>
                  <div className="invoice-modal-kicker">PAYMENT HISTORY</div>
                  <h2 id="payment-history-title">{historyPayer.name}</h2>
                  <p>{historyPayer.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                className="invoice-modal-close"
                onClick={() => setHistoryPayer(null)}
                aria-label="Close payment history"
              >
                ×
              </button>
            </div>

            {historyPayments.length === 0 ? (
              <div className="tracker-state-card history-empty-state">
                <strong>No invoices yet</strong>
                <span>This payer does not have any payment records.</span>
              </div>
            ) : (
              <div className="history-v3-body">
                <section className="history-v3-overview" aria-label="Payment account summary">
                  <div className="history-v3-summary-card">
                    <span className="history-v3-summary-label">TOTAL BILLED</span>
                    <strong>{formatMoney(historySummary.totalBilled, 'USD')}</strong>
                    {usdPhpRate && (
                      <small>≈ {formatMoney(historySummary.totalBilled * usdPhpRate, 'PHP')}</small>
                    )}
                    <span>{historySummary.invoiceCount} invoice{historySummary.invoiceCount === 1 ? '' : 's'}</span>
                  </div>

                  <div className="history-v3-summary-card history-v3-summary-paid">
                    <span className="history-v3-summary-label">COLLECTED</span>
                    <strong>{formatMoney(historySummary.totalPaid, 'USD')}</strong>
                    {usdPhpRate && (
                      <small>≈ {formatMoney(historySummary.totalPaid * usdPhpRate, 'PHP')}</small>
                    )}
                    <span>{historyCollectionRate}% collection rate</span>
                  </div>

                  <div className="history-v3-summary-card">
                    <span className="history-v3-summary-label">OUTSTANDING</span>
                    <strong>{formatMoney(historySummary.outstanding, 'USD')}</strong>
                    {usdPhpRate && (
                      <small>≈ {formatMoney(historySummary.outstanding * usdPhpRate, 'PHP')}</small>
                    )}
                    <span>{historySummary.partialCount} partially paid</span>
                  </div>

                  <div className={`history-v3-summary-card ${historySummary.overdue > 0 ? 'history-v3-summary-overdue' : ''}`}>
                    <span className="history-v3-summary-label">OVERDUE</span>
                    <strong>{formatMoney(historySummary.overdue, 'USD')}</strong>
                    {usdPhpRate && (
                      <small>≈ {formatMoney(historySummary.overdue * usdPhpRate, 'PHP')}</small>
                    )}
                    <span>{historySummary.overdue > 0 ? 'Past due balance' : 'No past due balance'}</span>
                  </div>
                </section>

                <section className="history-v3-progress-card">
                  <div className="history-v3-progress-copy">
                    <div>
                      <span>Collection progress</span>
                      <strong>{historyCollectionRate}%</strong>
                    </div>
                    <span>
                      {formatMoney(historySummary.totalPaid, 'USD')} received of{' '}
                      {formatMoney(historySummary.totalBilled, 'USD')} billed
                    </span>
                  </div>
                  <div className="history-v3-progress-track" aria-hidden="true">
                    <span style={{ width: `${historyCollectionRate}%` }} />
                  </div>
                </section>

                <section className="history-v3-section history-v3-invoices-section">
                  <div className="history-v3-section-heading">
                    <div>
                      <span className="history-v3-section-eyebrow">BILLING</span>
                      <strong>Invoice history</strong>
                    </div>
                    <span>Most recent first</span>
                  </div>

                  <div className="history-v3-invoice-list">
                    {historyPayments.map((payment) => {
                      const displayStatus = getDisplayStatus(payment)
                      const paid = getPaidAmount(payment)
                      const balance = getBalance(payment)
                      const invoiceTransactions = historyTransactions.filter(
                        (transaction) => transaction.payment_id === payment.id
                      )

                      return (
                        <article className="history-v3-invoice-card" key={payment.id}>
                          <div className="history-v3-invoice-top">
                            <div className="history-v3-invoice-title">
                              <strong>{payment.description || 'Invoice'}</strong>
                              <span>
                                Issued {formatDate(payment.invoice_date)} · Due {formatDate(payment.due_date)}
                              </span>
                            </div>
                            <span
                              className={
                                displayStatus === 'paid'
                                  ? 'status-badge active'
                                  : displayStatus === 'overdue'
                                    ? 'status-badge overdue'
                                    : displayStatus === 'partial'
                                      ? 'status-badge partial'
                                      : 'status-badge inactive'
                              }
                            >
                              {statusLabel(displayStatus)}
                            </span>
                          </div>

                          <div className="history-v3-invoice-money">
                            <div>
                              <span>Billed</span>
                              <strong>{formatMoney(payment.amount, payment.currency)}</strong>
                            </div>
                            <div>
                              <span>Paid</span>
                              <strong>{formatMoney(paid, payment.currency)}</strong>
                            </div>
                            <div className={balance > 0 ? 'has-balance' : ''}>
                              <span>Balance</span>
                              <strong>{formatMoney(balance, payment.currency)}</strong>
                            </div>
                            <div>
                              <span>Method</span>
                              <strong className="history-v3-method">{payment.payment_method || '—'}</strong>
                            </div>
                          </div>

                          {(payment.transaction_reference || payment.payment_notes || invoiceTransactions.length > 0) && (
                            <div className="history-v3-invoice-footer">
                              <span>{invoiceTransactions.length} payment{invoiceTransactions.length === 1 ? '' : 's'} recorded</span>
                              {payment.transaction_reference && <span>Latest ref: {payment.transaction_reference}</span>}
                              {payment.payment_notes && <span className="history-v3-note">{payment.payment_notes}</span>}
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentTracker
