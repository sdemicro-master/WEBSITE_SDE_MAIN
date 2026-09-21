import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
  ADMIN_PASSWORD: string
  ADMIN_SESSION_SECRET: string
}

type Product = {
  id: number
  name: string
  slug: string
  description: string
  price: number
  category: string
  image_blob: ArrayBuffer | null
  image_mime: string
  active: number
  featured: number
  sort_order: number
  created_at: string
  updated_at: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  credentials: true,
}))

function b64url(input: ArrayBuffer | string) {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input)
  let binary = ''
  bytes.forEach((b) => binary += String.fromCharCode(b))
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromB64url(input: string) {
  const padded = input.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - input.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
}

async function createSession(secret: string) {
  const payload = JSON.stringify({ role: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 })
  const encoded = b64url(payload)
  const signature = b64url(await hmac(secret, encoded))
  return `${encoded}.${signature}`
}

async function verifySession(secret: string, token?: string) {
  if (!token || !secret) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [encoded, signature] = parts
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromB64url(signature),
      new TextEncoder().encode(encoded)
    )
    if (!valid) return false
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(encoded)))
    return payload.role === 'admin' && payload.exp > Date.now()
  } catch {
    return false
  }
}

async function requireAdmin(c: any) {
  const token = getCookie(c, 'sde_admin')
  if (!(await verifySession(c.env.ADMIN_SESSION_SECRET, token))) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return null
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function productView(c: any, p: Product) {
  return {
    ...p,
    price: Number(p.price),
    active: Boolean(p.active),
    featured: Boolean(p.featured),
    image_url: p.image_blob ? `/api/images/${p.id}` : ''
  }
}

// Health
app.get('/api/health', (c) => c.json({ ok: true, service: 'sde-cloudflare-store' }))

// Public products
app.get('/api/products', async (c) => {
  const featured = c.req.query('featured')
  const q = c.req.query('q')?.trim()
  const category = c.req.query('category')?.trim()

  let sql = `SELECT * FROM products WHERE active = 1`
  const params: unknown[] = []

  if (featured === '1') sql += ` AND featured = 1`
  if (q) {
    sql += ` AND (name LIKE ? OR description LIKE ? OR category LIKE ?)`
    const like = `%${q}%`
    params.push(like, like, like)
  }
  if (category) {
    sql += ` AND category = ?`
    params.push(category)
  }

  sql += ` ORDER BY sort_order ASC, id DESC`

  const result = await c.env.DB.prepare(sql).bind(...params).all<Product>()
  return c.json(result.results.map(p => productView(c, p)))
})

app.get('/api/products/:slug', async (c) => {
  const product = await c.env.DB.prepare(
    `SELECT * FROM products WHERE slug = ? AND active = 1 LIMIT 1`
  ).bind(c.req.param('slug')).first<Product>()

  if (!product) return c.json({ error: 'Product not found' }, 404)
  return c.json(productView(c, product))
})

// Admin login
app.post('/api/admin/login', async (c) => {
  const body = await c.req.json<{ password?: string }>()
  if (!c.env.ADMIN_PASSWORD || !c.env.ADMIN_SESSION_SECRET) {
    return c.json({ error: 'Admin secrets belum dikonfigurasi di Cloudflare.' }, 500)
  }
  if (!body.password || body.password !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Password salah.' }, 401)
  }

  const token = await createSession(c.env.ADMIN_SESSION_SECRET)
  setCookie(c, 'sde_admin', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 60 * 60 * 12
  })
  return c.json({ ok: true })
})

app.post('/api/admin/logout', async (c) => {
  deleteCookie(c, 'sde_admin', { path: '/' })
  return c.json({ ok: true })
})

app.get('/api/admin/me', async (c) => {
  const token = getCookie(c, 'sde_admin')
  const valid = await verifySession(c.env.ADMIN_SESSION_SECRET, token)
  return c.json({ authenticated: valid })
})

// Admin list
app.get('/api/admin/products', async (c) => {
  const denied = await requireAdmin(c)
  if (denied) return denied
  const result = await c.env.DB.prepare(
    `SELECT * FROM products ORDER BY sort_order ASC, id DESC`
  ).all<Product>()
  return c.json(result.results.map(p => productView(c, p)))
})

// Create product
app.post('/api/admin/products', async (c) => {
  const denied = await requireAdmin(c)
  if (denied) return denied

  const body = await c.req.json<Partial<Product>>()
  const name = String(body.name || '').trim()
  if (!name) return c.json({ error: 'Nama produk wajib diisi.' }, 400)

  let slug = slugify(String(body.slug || name))
  const duplicate = await c.env.DB.prepare(`SELECT id FROM products WHERE slug = ?`).bind(slug).first()
  if (duplicate) slug = `${slug}-${Date.now().toString().slice(-6)}`

  const result = await c.env.DB.prepare(`
    INSERT INTO products
      (name, slug, description, price, category, image_blob, image_mime, shopee_url, tokopedia_url, contact_url, active, featured, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    RETURNING *
  `).bind(
    name,
    slug,
    String(body.description || ''),
    Math.max(0, Number(body.price || 0)),
    String(body.category || 'Produk'),
    null,
    '',
    String((body as any).shopee_url || ''),
    String((body as any).tokopedia_url || ''),
    String((body as any).contact_url || ''),
    body.active === false ? 0 : 1,
    body.featured ? 1 : 0,
    Number(body.sort_order || 0)
  ).first<Product>()

  return c.json(productView(c, result!), 201)
})

// Update product
app.put('/api/admin/products/:id', async (c) => {
  const denied = await requireAdmin(c)
  if (denied) return denied

  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<Product>>()
  const current = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(id).first<Product>()
  if (!current) return c.json({ error: 'Product not found' }, 404)

  const name = String(body.name ?? current.name).trim()
  const slug = slugify(String(body.slug ?? current.slug)) || current.slug

  const result = await c.env.DB.prepare(`
    UPDATE products SET
      name = ?, slug = ?, description = ?, price = ?, category = ?,
      image_blob = COALESCE(?, image_blob), image_mime = COALESCE(?, image_mime),
      shopee_url = ?, tokopedia_url = ?, contact_url = ?,
      active = ?, featured = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    RETURNING *
  `).bind(
    name,
    slug,
    String(body.description ?? current.description),
    Math.max(0, Number(body.price ?? current.price)),
    String(body.category ?? current.category),
    null,
    '',
    String((body as any).shopee_url ?? (current as any).shopee_url ?? ''),
    String((body as any).tokopedia_url ?? (current as any).tokopedia_url ?? ''),
    String((body as any).contact_url ?? (current as any).contact_url ?? ''),
    body.active === undefined ? current.active : (body.active ? 1 : 0),
    body.featured === undefined ? current.featured : (body.featured ? 1 : 0),
    Number(body.sort_order ?? current.sort_order),
    id
  ).first<Product>()

  return c.json(productView(c, result!))
})

// Delete product and image
app.delete('/api/admin/products/:id', async (c) => {
  const denied = await requireAdmin(c)
  if (denied) return denied

  const id = Number(c.req.param('id'))
  const current = await c.env.DB.prepare(`SELECT id FROM products WHERE id = ?`).bind(id).first<{id: number}>()
  if (!current) return c.json({ error: 'Product not found' }, 404)

  await c.env.DB.prepare(`DELETE FROM products WHERE id = ?`).bind(id).run()
  return c.json({ ok: true })
})

// Upload a photo temporarily to the browser, then save it as a D1 BLOB.
app.post('/api/admin/upload', async (c) => {
  const denied = await requireAdmin(c)
  if (denied) return denied

  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return c.json({ error: 'File foto tidak ditemukan.' }, 400)

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  if (!allowed.includes(file.type)) return c.json({ error: 'Format harus JPG, PNG, WEBP, atau AVIF.' }, 400)
  if (file.size > 1024 * 1024) return c.json({ error: 'Ukuran maksimum 1 MB.' }, 400)

  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return c.json({ ok: true, image_base64: btoa(binary), mime: file.type, size: file.size })
})

app.put('/api/admin/products/:id/image', async (c) => {
  const denied = await requireAdmin(c)
  if (denied) return denied

  const id = Number(c.req.param('id'))
  const body = await c.req.json<{image_base64?: string, mime?: string}>()
  if (!body.image_base64 || !body.mime) return c.json({ error: 'Data foto tidak lengkap.' }, 400)

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  if (!allowed.includes(body.mime)) return c.json({ error: 'Format gambar tidak didukung.' }, 400)

  const binary = Uint8Array.from(atob(body.image_base64), ch => ch.charCodeAt(0))
  if (binary.byteLength > 1024 * 1024) return c.json({ error: 'Ukuran maksimum 1 MB.' }, 400)

  await c.env.DB.prepare(
    `UPDATE products SET image_blob = ?, image_mime = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(binary, body.mime, id).run()

  return c.json({ ok: true, image_url: `/api/images/${id}` })
})

app.get('/api/images/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const row = await c.env.DB.prepare(
    `SELECT image_blob, image_mime FROM products WHERE id = ?`
  ).bind(id).first<{image_blob: ArrayBuffer | null, image_mime: string}>()

  if (!row?.image_blob) return c.notFound()
  const headers = new Headers()
  headers.set('Content-Type', row.image_mime || 'image/jpeg')
  headers.set('Cache-Control', 'public, max-age=86400')
  return new Response(row.image_blob, { headers })
})

// Serve SPA/static assets
export default app
