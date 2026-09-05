import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import logo from '../assets/westpacific-logo.png'
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
      <section className="wp-login-card">
        <img
          src={logo}
          alt="WestPacific Desk"
          className="wp-login-logo"
        />

        <div className="wp-login-form-card">
          <h1>Admin Login</h1>
          <p>Sign in to access the dashboard</p>

          <form onSubmit={handleSubmit}>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
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
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {error && <div className="wp-login-error">{error}</div>}

            <button type="submit" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <Link to="/" className="wp-back-home">
            ← Back to Home
          </Link>
        </div>
      </section>
    </main>
  )
}

export default AdminLogin
