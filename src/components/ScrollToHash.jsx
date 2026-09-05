import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function getHeaderOffset() {
  const header = document.querySelector('.wp-header')

  if (!header) return 16

  return header.getBoundingClientRect().height + 16
}

function scrollToElement(id, behavior = 'smooth') {
  const element = document.getElementById(id)

  if (!element) return false

  const top =
    element.getBoundingClientRect().top +
    window.scrollY -
    getHeaderOffset()

  window.scrollTo({
    top: Math.max(0, top),
    behavior,
  })

  return true
}

export default function ScrollToHash() {
  const location = useLocation()
  const navigate = useNavigate()

  /*
    Handle links such as:
      href="#services"
      href="#contact"
      href="#home"

    Native hash links are intercepted so React Router and the
    scroll helper always stay in sync.
  */
  useEffect(() => {
    function handleAnchorClick(event) {
      const anchor = event.target.closest('a[href]')

      if (!anchor) return

      const href = anchor.getAttribute('href')

      if (!href) return

      // Same-page hash link, e.g. href="#services"
      if (href.startsWith('#')) {
        event.preventDefault()

        const nextHash = href === '#' ? '' : href

        navigate(
          `${location.pathname}${location.search}${nextHash}`,
        )

        return
      }

      /*
        Links such as /#services are normally React Router <Link>
        elements. React Router handles the route change; the
        location effect below performs the actual scrolling.
      */
    }

    document.addEventListener('click', handleAnchorClick)

    return () => {
      document.removeEventListener('click', handleAnchorClick)
    }
  }, [location.pathname, location.search, navigate])

  /*
    Scroll whenever the route/hash changes.

    Retrying briefly is important when navigating from /about to
    /#services or /#contact because the Home component must render
    before its target section exists in the DOM.
  */
  useEffect(() => {
    const rawHash = location.hash

    if (!rawHash) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })

      return undefined
    }

    const id = decodeURIComponent(
      rawHash.replace(/^#/, ''),
    )

    let cancelled = false
    let attempts = 0
    let timer

    function tryScroll() {
      if (cancelled) return

      attempts += 1

      if (scrollToElement(id, 'smooth')) {
        return
      }

      if (attempts < 20) {
        timer = window.setTimeout(tryScroll, 50)
      }
    }

    /*
      Let React paint the destination route first before looking
      for the target element.
    */
    timer = window.setTimeout(tryScroll, 0)

    return () => {
      cancelled = true

      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [location.pathname, location.hash])

  return null
}
