import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_SERVICES = new Set([
  'Student Assistance',
  'Administrative Support',
  'Web App Development',
  'Website Building & Management',
  'Virtual Office Assistance',
  'Data Management & Reporting',
  'Something Else',
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')

  if (realIp) {
    return realIp.trim()
  }

  return 'unknown'
}

function hashIp(ip) {
  const salt = process.env.CONTACT_RATE_LIMIT_SALT || ''

  return createHash('sha256')
    .update(`${salt}:${ip}`)
    .digest('hex')
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY

  if (!secret) {
    return {
      success: false,
      configurationError: true,
    }
  }

  const form = new URLSearchParams()

  form.set('secret', secret)
  form.set('response', token)

  if (ip && ip !== 'unknown') {
    form.set('remoteip', ip)
  }

  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    },
  )

  if (!response.ok) {
    return {
      success: false,
      upstreamStatus: response.status,
    }
  }

  return response.json()
}

export async function POST(request) {
  try {
    const contentLength = Number(
      request.headers.get('content-length') || 0,
    )

    if (contentLength > 16384) {
      return json(
        {
          error: 'Request is too large.',
        },
        413,
      )
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        'Missing Supabase server environment variables.',
        {
          hasSupabaseUrl: Boolean(supabaseUrl),
          hasServiceRoleKey: Boolean(serviceRoleKey),
        },
      )

      return json(
        {
          error:
            'Contact service is temporarily unavailable.',
        },
        503,
      )
    }

    let body

    try {
      body = await request.json()
    } catch {
      return json(
        {
          error: 'Invalid request body.',
        },
        400,
      )
    }

    const name = cleanText(body.name)
    const email = cleanText(body.email).toLowerCase()
    const service = cleanText(body.service)
    const message = cleanText(body.message)
    const turnstileToken = cleanText(
      body.turnstileToken,
    )

    if (
      name.length < 2 ||
      name.length > 80
    ) {
      return json(
        {
          error:
            'Please enter a valid name.',
        },
        400,
      )
    }

    if (
      email.length > 254 ||
      !EMAIL_RE.test(email)
    ) {
      return json(
        {
          error:
            'Please enter a valid email address.',
        },
        400,
      )
    }

    if (!ALLOWED_SERVICES.has(service)) {
      return json(
        {
          error:
            'Please select a valid service.',
        },
        400,
      )
    }

    if (
      message.length < 10 ||
      message.length > 3000
    ) {
      return json(
        {
          error:
            'Message must be between 10 and 3000 characters.',
        },
        400,
      )
    }

    if (!turnstileToken) {
      return json(
        {
          error:
            'Please complete the security check.',
        },
        400,
      )
    }

    const ip = getClientIp(request)

    let verification

    try {
      verification = await verifyTurnstile(
        turnstileToken,
        ip,
      )
    } catch (error) {
      console.error(
        'Turnstile verification failed:',
        error,
      )

      return json(
        {
          error:
            'Security verification failed. Please try again.',
        },
        502,
      )
    }

    if (verification.configurationError) {
      console.error(
        'TURNSTILE_SECRET_KEY is not configured.',
      )

      return json(
        {
          error:
            'Contact service is temporarily unavailable.',
        },
        503,
      )
    }

    if (!verification.success) {
      console.error(
        'Turnstile rejected token:',
        verification,
      )

      return json(
        {
          error:
            'Security verification failed. Please try again.',
        },
        400,
      )
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    const ipHash = hashIp(ip)
    const now = Date.now()

    const tenMinutesAgo = new Date(
      now - 10 * 60 * 1000,
    ).toISOString()

    const oneDayAgo = new Date(
      now - 24 * 60 * 60 * 1000,
    ).toISOString()

    const [
      recentResult,
      dailyResult,
    ] = await Promise.all([
      supabase
        .from('contact_rate_limits')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('ip_hash', ipHash)
        .gte(
          'created_at',
          tenMinutesAgo,
        ),

      supabase
        .from('contact_rate_limits')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('ip_hash', ipHash)
        .gte(
          'created_at',
          oneDayAgo,
        ),
    ])

    if (
      recentResult.error ||
      dailyResult.error
    ) {
      console.error(
        'Rate limit lookup failed:',
        recentResult.error ||
          dailyResult.error,
      )

      return json(
        {
          error:
            'Contact service is temporarily unavailable.',
        },
        503,
      )
    }

    if (
      (recentResult.count || 0) >= 5 ||
      (dailyResult.count || 0) >= 20
    ) {
      return json(
        {
          error:
            'Too many messages have been sent from this connection. Please try again later.',
        },
        429,
      )
    }

    const {
      error: rateInsertError,
    } = await supabase
      .from('contact_rate_limits')
      .insert({
        ip_hash: ipHash,
      })

    if (rateInsertError) {
      console.error(
        'Rate limit insert failed:',
        rateInsertError,
      )

      return json(
        {
          error:
            'Contact service is temporarily unavailable.',
        },
        503,
      )
    }

    const userAgent =
      request.headers
        .get('user-agent')
        ?.slice(0, 500) || null

    const {
      data: insertedInquiry,
      error: insertError,
    } = await supabase
      .from('contact_inquiries')
      .insert({
        name,
        email,
        service,
        message,
        status: 'new',
        source: 'website',
        user_agent: userAgent,
      })
      .select('id, created_at')
      .single()

    if (insertError) {
      console.error(
        'Inquiry insert failed:',
        insertError,
      )

      return json(
        {
          error:
            'We could not save your message. Please try again shortly.',
        },
        500,
      )
    }

    if (!insertedInquiry?.id) {
      console.error(
        'Inquiry insert returned no row.',
      )

      return json(
        {
          error:
            'We could not confirm your message was saved. Please try again.',
        },
        500,
      )
    }

    return json(
      {
        ok: true,
        inquiryId: insertedInquiry.id,
      },
      201,
    )
  } catch (error) {
    console.error(
      'Unhandled contact API error:',
      error,
    )

    return json(
      {
        error:
          'Something went wrong while processing your message.',
      },
      500,
    )
  }
}

export async function GET() {
  return json(
    {
      error: 'Method not allowed.',
    },
    405,
  )
}