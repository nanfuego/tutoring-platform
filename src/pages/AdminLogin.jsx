import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import logo from '../assets/westpacific-logo.png'
import hero from '../assets/westpacific-hero.jpg'
import './AdminLogin.css'

function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (signInError) {
      setError('Incorrect email or password.')
      return
    }

    navigate('/admin')
  }

  return (
    <main className="wp-login-page">
      <section className="wp-login-shell">
        <div className="wp-login-left">
          <div className="wp-login-brand">
            <Link to="/" aria-label="WestPacific Desk home">
              <img
                src={logo}
                alt="WestPacific Desk"
                className="wp-login-logo"
              />
            </Link>
          </div>

          <div className="wp-login-form-wrap">
            <div className="wp-login-heading">
              <span className="wp-login-eyebrow">ADMIN PORTAL</span>
              <h1>Welcome back</h1>
              <p>Please enter your details to access the dashboard.</p>
            </div>

            <form className="wp-login-form" onSubmit={handleSubmit}>
              <label>
                <span>Email address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label>
                <span>Password</span>

                <div className="wp-password-row">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                  />

                  <button
                    type="button"
                    className="wp-password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              {error && (
                <div className="wp-login-error" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="wp-login-submit"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="wp-login-footer-row">
              <Link to="/" className="wp-back-home">
                ← Back to website
              </Link>

              <span>Secure admin access</span>
            </div>
          </div>
        </div>

        <aside
          className="wp-login-visual"
          style={{ '--login-hero': `url(${hero})` }}
          aria-label="WestPacific Desk"
        >
          <div className="wp-login-visual-overlay" />

          <div className="wp-login-visual-copy">
            <span className="wp-login-visual-kicker">
              WESTPACIFIC DESK
            </span>

            <h2>
              Reliable support.
              <br />
              Organized work.
              <br />
              Better outcomes.
            </h2>

            <p>
              Your secure workspace for managing students, payments,
              activity, and client inquiries.
            </p>

            <div className="wp-login-visual-tags" aria-hidden="true">
              <span>Student Support</span>
              <span>Admin Operations</span>
              <span>Client Inquiries</span>
            </div>
          </div>

          <div className="wp-login-decor wp-login-decor-one" />
          <div className="wp-login-decor wp-login-decor-two" />
          <div className="wp-login-decor wp-login-decor-three" />
        </aside>
      </section>
    </main>
  )
}

export default AdminLogin
