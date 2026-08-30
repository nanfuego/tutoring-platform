import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './CreateInvoice.css'

function CreateInvoice() {
  const navigate = useNavigate()

  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(true)

  const [studentId, setStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    async function fetchStudents() {
      const { data } = await supabase
        .from('students')
        .select('id, name, active')
        .order('name')
      setStudents(data || [])
      setLoadingStudents(false)
    }
    fetchStudents()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!studentId) {
      setError('Please select a student.')
      return
    }
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount.')
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
      // paypal_ref stays empty until PayPal integration is wired in —
      // this is where the PayPal invoice ID will be saved once that's connected
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSuccessMsg('Invoice created.')
    setStudentId('')
    setAmount('')
    setDescription('')
    setDueDate('')
  }

  return (
    <div className="invoice-page">
      <button className="back-link" onClick={() => navigate('/admin')}>
        ← Back to students
      </button>

      <h1 className="admin-welcome">Create Invoice</h1>
      <p className="invoice-subtext">
        This logs the invoice in your payment tracker. PayPal sending isn't connected yet —
        for now, statuses are updated manually until that's wired in.
      </p>

      <form className="invoice-form" onSubmit={handleSubmit}>
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

        {error && <p className="login-error">{error}</p>}
        {successMsg && (
          <p className="invoice-success">
            {successMsg} <Link to="/admin/payments">View in Payment Tracker →</Link>
          </p>
        )}

        <div className="invoice-actions">
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateInvoice
