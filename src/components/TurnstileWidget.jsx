import { useEffect, useRef } from 'react'

const SCRIPT_ID = 'westpacific-turnstile-script'

function loadTurnstile() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile)
      return
    }

    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      const wait = () => {
        if (window.turnstile) resolve(window.turnstile)
        else setTimeout(wait, 50)
      }
      wait()
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => reject(new Error('Unable to load Turnstile.'))
    document.head.appendChild(script)
  })
}

export default function TurnstileWidget({ onToken, resetKey = 0 }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  useEffect(() => {
    let cancelled = false

    if (!siteKey || !containerRef.current) return undefined

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return

        if (widgetIdRef.current !== null) {
          try {
            turnstile.remove(widgetIdRef.current)
          } catch {
            // Widget may already have been removed.
          }
        }

        containerRef.current.innerHTML = ''

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          size: 'flexible',
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        })
      })
      .catch(() => onToken(''))

    return () => {
      cancelled = true
    }
  }, [siteKey, onToken, resetKey])

  if (!siteKey) {
    return (
      <p className="wp-form-security-error">
        Contact security is not configured yet.
      </p>
    )
  }

  return (
    <div className="wp-turnstile-wrap">
      <div ref={containerRef} />
    </div>
  )
}
