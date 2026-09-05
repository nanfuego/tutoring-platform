import { useCallback, useState } from 'react'
import TurnstileWidget from './TurnstileWidget'
import './ContactForm.css'

const INITIAL_STATUS = {
  type: '',
  message: '',
}

export default function ContactForm() {
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState(INITIAL_STATUS)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [resetKey, setResetKey] = useState(0)

  const handleToken = useCallback((token) => {
    setTurnstileToken(token || '')
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()

    if (submitting) return

    const formElement = event.currentTarget
    const form = new FormData(formElement)

    const payload = {
      name: form.get('name') || '',
      email: form.get('email') || '',
      service: form.get('service') || '',
      message: form.get('message') || '',
      companyWebsite: form.get('companyWebsite') || '',
      turnstileToken,
    }

    if (!turnstileToken) {
      setStatus({
        type: 'error',
        message: 'Please complete the security check before sending.',
      })
      return
    }

    setSubmitting(true)
    setStatus(INITIAL_STATUS)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Unable to send your message.')
      }

      formElement.reset()
      setTurnstileToken('')
      setResetKey((value) => value + 1)
      setStatus({
        type: 'success',
        message:
          'Thank you. Your message has been received and we’ll get back to you as soon as possible.',
      })
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error?.message ||
          'Something went wrong while sending your message. Please try again.',
      })
      setTurnstileToken('')
      setResetKey((value) => value + 1)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="wp-honeypot" aria-hidden="true">
        <label>
          Company website
          <input
            type="text"
            name="companyWebsite"
            tabIndex="-1"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="wp-form-row">
        <label>
          <span>Name</span>
          <input
            type="text"
            name="name"
            placeholder="Your name"
            minLength="2"
            maxLength="80"
            autoComplete="name"
            required
          />
        </label>

        <label>
          <span>Email</span>
          <input
            type="email"
            name="email"
            placeholder="Your email address"
            maxLength="254"
            autoComplete="email"
            required
          />
        </label>
      </div>

      <label>
        <span>What do you need help with?</span>
        <select name="service" defaultValue="" required>
          <option value="" disabled>
            Select a service
          </option>
          <option>Student Assistance</option>
          <option>Administrative Support</option>
          <option>Web App Development</option>
          <option>Website Building & Management</option>
          <option>Virtual Office Assistance</option>
          <option>Data Management & Reporting</option>
          <option>Something Else</option>
        </select>
      </label>

      <label>
        <span>Message</span>
        <textarea
          name="message"
          rows="6"
          minLength="10"
          maxLength="3000"
          placeholder="Tell us briefly about the support you need, your timeline, and any important details."
          required
        />
      </label>

      <TurnstileWidget
        onToken={handleToken}
        resetKey={resetKey}
      />

      {status.message && (
        <div
          className={`wp-form-status ${status.type}`}
          role={status.type === 'error' ? 'alert' : 'status'}
        >
          {status.message}
        </div>
      )}

      <button
        className="wp-button wp-button-primary wp-contact-submit"
        type="submit"
        disabled={submitting}
      >
        {submitting ? 'Sending...' : 'Send Message'}
        {!submitting && <span aria-hidden="true">→</span>}
      </button>

      <p className="wp-form-note">
        Prefer WhatsApp?{' '}
        <a
          href="https://wa.me/639776324096"
          target="_blank"
          rel="noreferrer"
        >
          Send us a message directly
        </a>{' '}
        and we’ll get back to you as soon as possible.
      </p>
    </form>
  )
}
