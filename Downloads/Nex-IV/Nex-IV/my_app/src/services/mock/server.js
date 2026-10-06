/**
 * Mock REST API dispatcher.
 * Routes `METHOD path` patterns to handler functions against the seeded DB.
 * Designed to be swapped for a real backend by setting VITE_API_URL; the UI
 * only talks to these endpoints through RTK Query.
 */
/* eslint-disable no-unused-vars */
import { getDb, computeTotals, rint, pick, fullName, daysAgoISO, futureISO, addDays } from './db.js'
import { canTransition } from '../../constants/statuses.js'

/* ---------------- fake JWT ---------------- */

function encodePayload(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
}

function decodePayload(token) {
  try {
    const parts = String(token || '').split('.')
    if (parts.length !== 3) return null
    return JSON.parse(decodeURIComponent(escape(atob(parts[1]))))
  } catch {
    return null
  }
}

function makeTokens(user, remember) {
  const expiresIn = remember ? 60 * 60 * 24 * 7 : 60 * 60 * 2
  const access = `mock.${encodePayload({
    sub: user.id,
    role: user.role,
    vendorId: user.vendorId,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  })}.sig`
  const refresh = `rf.${encodePayload({
    sub: user.id,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  })}.sig`
  return { access, refresh }
}

function currentUser(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const token = header.replace(/^Bearer\s+/i, '')
  const payload = decodePayload(token)
  if (!payload) return null
  if (payload.exp * 1000 < Date.now()) return null
  return { id: payload.sub, role: payload.role, vendorId: payload.vendorId }
}

/* ---------------- helpers ---------------- */

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function paginate(items, query) {
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.max(1, Math.min(200, Number(query.perPage) || 10))
  const total = items.length
  const totalPages = Math.ceil(total / perPage)
  return {
    items: items.slice((page - 1) * perPage, page * perPage),
    total,
    page,
    perPage,
    totalPages,
  }
}

function filterBySearch(items, keys, term) {
  const t = String(term || '').trim().toLowerCase()
  if (!t) return items
  return items.filter((it) =>
    keys.some((k) => String(it[k] ?? '').toLowerCase().includes(t))
  )
}

function filterByStatus(items, query) {
  const s = query.status
  if (!s || s === 'ALL') return items
  const list = String(s).split(',')
  return items.filter((it) => list.includes(it.status))
}

function sortItems(items, query, defaultKey = 'createdAt') {
  const { sortBy, sortDir } = query
  const key = sortBy || defaultKey
  const dir = sortDir === 'ASC' ? 1 : -1
  return [...items].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })
}

function requireUser(req) {
  const user = currentUser(req)
  if (!user) throw new ApiError(401, 'Unauthorized — session expired')
  return user
}

function requireVendor(req, vendorId) {
  const user = requireUser(req)
  const db = getDb()
  const vendor = db.vendors.find((v) => v.id === vendorId)
  if (!vendor) throw new ApiError(404, 'Vendor not found')
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_SUPPORT'
  if (!isAdmin && user.vendorId !== vendorId) {
    throw new ApiError(403, 'You do not have access to this vendor tenant')
  }
  return { user, vendor }
}

function scoped(items, ctx, vendorId) {
  const user = ctx.user
  if (user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_SUPPORT' || !vendorId) return items
  return items.filter((i) => i.vendorId === vendorId)
}

function addAudit(ctx, action, entity, entityId, detail, vendorId) {
  const db = getDb()
  const user = ctx.user
  db.auditLogs.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    vendorId: vendorId || user.vendorId || null,
    userId: user.id,
    userName: user.name || '—',
    role: user.role,
    action,
    entity,
    entityId,
    detail,
    ip: reqIp(ctx),
    device: 'Chrome / Windows',
    at: new Date().toISOString(),
  })
}

let ipCounter = 0
function reqIp() {
  ipCounter += 1
  return `172.16.${ipCounter % 250}.${(ipCounter * 7) % 254}`
}

function dates(ctx) {
  const q = ctx.query
  if (!q.from && !q.to) return null
  return {
    from: q.from ? new Date(q.from) : new Date(Date.now() - 730 * 86400000),
    to: q.to ? new Date(q.to) : new Date(),
  }
}

const nowISO = () => new Date().toISOString()

/* ---------------- route table ---------------- */

const routes = []
function on(method, pattern, handler) {
  const keys = []
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/\//g, '\\/')
        .replace(/:\w+/g, (m) => {
          keys.push(m.slice(1))
          return '([^\\/]+)'
        }) +
      '$'
  )
  routes.push({ method: method.toUpperCase(), regex, keys, handler })
}

function dispatch(method, urlPath, query, body, headers) {
  const m = method.toUpperCase()
  for (const route of routes) {
    if (route.method !== m && route.method !== '*') continue
    const match = urlPath.match(route.regex)
    if (!match) continue
    const params = {}
    route.keys.forEach((k, i) => {
      params[k] = decodeURIComponent(match[i + 1])
    })
    const ctx = { params, query, body, headers, user: currentUser({ headers }) }
    const result = route.handler(ctx)
    return { data: cloneResult(result), meta: undefined }
  }
  throw new ApiError(404, `No mock endpoint for ${m} ${urlPath}`)
}

/* RTK Query caches payloads in an Immer store, which deep-freezes any object
   held by reference. The mock returns live references into the mutable seed db,
   so freezing them would make later login/audit/write routes throw. Return a
   deep copy so the seeded db objects are never frozen. */
function cloneResult(value) {
  if (value === null || typeof value !== 'object') return value
  try {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

/* ================= AUTH ================= */

on('POST', '/auth/login', (ctx) => {
  const db = getDb()
  const { email, password, remember } = ctx.body || {}
  if (!email || !password) throw new ApiError(400, 'Email and password are required')
  const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())
  const ok = user && db.credentials[user.email] === password
  if (!ok) throw new ApiError(401, 'Invalid email or password')
  if (user.status === 'INACTIVE') throw new ApiError(403, 'This account is inactive')
  const tokens = makeTokens(user, !!remember)
  db.auditLogs.unshift({
    id: `aud-${Date.now()}-lg`,
    vendorId: user.vendorId,
    userId: user.id,
    userName: user.name,
    role: user.role,
    action: 'logged in',
    entity: 'account',
    entityId: user.id,
    detail: `${user.name} signed in to Nex-IV`,
    ip: reqIp(),
    device: 'Chrome / Windows',
    at: nowISO(),
  })
  user.lastLogin = nowISO()
  return {
    accessToken: tokens.access,
    refreshToken: tokens.refresh,
    user: sanitizeUser(user),
    vendor: user.vendorId ? db.vendors.find((v) => v.id === user.vendorId) : null,
  }
})

on('POST', '/auth/register', (ctx) => {
  const db = getDb()
  const { name, email, password, company } = ctx.body || {}
  if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required')
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new ApiError(409, 'An account with this email already exists')
  }
  const vendor = db.vendors.find((v) => v.company.toLowerCase() === String(company || '').toLowerCase())
  const user = {
    id: `u-${Date.now()}`,
    vendorId: vendor?.id || null,
    name,
    email,
    role: vendor ? 'VENDOR_ADMIN' : 'SUPER_ADMIN',
    status: 'ACTIVE',
    phone: '',
    lastLogin: nowISO(),
    permissions: null,
  }
  db.users.push(user)
  return { user: sanitizeUser(user), message: 'Account created successfully' }
})

on('POST', '/auth/refresh', (ctx) => {
  const db = getDb()
  const refresh = ctx.body?.refreshToken
  const payload = decodePayload(refresh)
  if (!payload) throw new ApiError(401, 'Invalid refresh token')
  const user = db.users.find((u) => u.id === payload.sub)
  if (!user) throw new ApiError(401, 'Invalid refresh token')
  return {
    accessToken: makeTokens(user, true).access,
    user: sanitizeUser(user),
    vendor: user.vendorId ? db.vendors.find((v) => v.id === user.vendorId) : null,
  }
})

on('POST', '/auth/forgot-password', (ctx) => {
  const db = getDb()
  const u = db.users.find((x) => x.email.toLowerCase() === String(ctx.body?.email || '').toLowerCase())
  if (!u) throw new ApiError(404, 'No account found with that email address')
  return { message: 'If the email exists, a reset link has been sent.' }
})

on('POST', '/auth/reset-password', (ctx) => {
  const { email, token, password } = ctx.body || {}
  if (!email || !password || !token) throw new ApiError(400, 'All fields are required')
  const u = db_user_find(email)
  if (!u) throw new ApiError(404, 'Account not found')
  u.passwordResetAt = nowISO()
  return { message: 'Password reset successfully. You can now sign in.' }
})

function db_user_find(email) {
  return getDb().users.find((x) => x.email.toLowerCase() === String(email || '').toLowerCase())
}

on('POST', '/auth/change-password', (ctx) => {
  const user = requireUser(ctx)
  const db = getDb()
  const u = db.users.find((x) => x.id === user.id)
  const { currentPassword, newPassword } = ctx.body || {}
  if (!u) throw new ApiError(401, 'Session invalid')
  if (!currentPassword || !newPassword) throw new ApiError(400, 'Both passwords are required')
  if (currentPassword === newPassword) throw new ApiError(400, 'New password must differ from current password')
  return { message: 'Password changed successfully' }
})

on('GET', '/auth/me', (ctx) => {
  const u = requireUser(ctx)
  const db = getDb()
  const user = db.users.find((x) => x.id === u.id)
  if (!user) throw new ApiError(401, 'Session invalid')
  const vendor = user.vendorId ? db.vendors.find((v) => v.id === user.vendorId) : null
  return { user: sanitizeUser(user), vendor }
})

function sanitizeUser(user) {
  const { ...rest } = user
  return rest
}

on('POST', '/auth/logout', () => ({ message: 'Logged out' }))

/* ================= PLATFORM / ADMIN ================= */

on('GET', '/admin/dashboard', (ctx) => {
  requireUser(ctx)
  const db = getDb()
  const activeVendors = db.vendors.filter((v) => v.status === 'ACTIVE')
  const totalCustomers = db.customers.length
  const totalEmployees = db.employees.length
  const totalProducts = db.products.length
  const totalOrders = db.orders.length
  const totalInvoices = db.invoices.length
  const totalRevenue = db.invoices.filter((i) => i.status !== 'CANCELLED').reduce((s, i) => s + i.amountPaid, 0)
  const activeUsers = db.users.filter((u) => u.status === 'ACTIVE').length

  const monthlyActivity = monthSeries(12, (d) => {
    const invoices = db.invoices.filter((i) => inMonth(new Date(i.createdAt), d))
    const orders = db.orders.filter((o) => inMonth(new Date(o.createdAt), d))
    const tickets = db.tickets.filter((t) => inMonth(new Date(t.createdAt), d))
    return {
      label: monthShort(d),
      revenue: round2(invoices.reduce((s, i) => s + i.amountPaid, 0)),
      orders: orders.length,
      tickets: tickets.length,
      invoices: invoices.length,
    }
  })

  const vendorGrowth = [...activeVendors]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-12)
    .map((v) => ({ label: shortName(v.company), createdAt: v.createdAt.slice(0, 10) }))
    .reduce((acc, v) => {
      const key = v.createdAt.slice(0, 7)
      const existing = acc.find((a) => a.month === key)
      if (existing) existing.count += 1
      else acc.push({ month: key, label: key, count: 1 })
      return acc
    }, [])

  return {
    metrics: {
      totalVendors: db.vendors.length,
      activeVendors: activeVendors.length,
      pendingVendors: db.vendors.filter((v) => v.status === 'PENDING').length,
      totalCustomers,
      totalEmployees,
      totalProducts,
      totalTransactions: totalInvoices + totalOrders + db.expenses.length,
      platformRevenue: round2(totalRevenue),
      activeUsers,
      totalTickets: db.tickets.length,
      openTickets: db.tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
    },
    revenueByVendor: db.vendors.map((v) => ({
      name: shortName(v.company),
      revenue: round2(
        db.invoices.filter((i) => i.vendorId === v.id && i.status !== 'CANCELLED').reduce((s, i) => s + i.amountPaid, 0)
      ),
    })),
    monthlyActivity,
    vendorGrowth,
    customerGrowth: monthSeries(9, (d) => ({
      label: monthShort(d),
      customers: db.customers.filter((c) => inMonth(new Date(c.createdAt), d)).length,
    })),
    recentVendors: [...db.vendors].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
    lowStockCount: db.stock.filter((s) => s.available <= s.reorderLevel).length,
  }
})

on('GET', '/admin/vendors', (ctx) => {
  requireUser(ctx)
  const db = getDb()
  let vendors = [...db.vendors]
  vendors = sortItems(vendors, ctx.query, 'createdAt')
  if (ctx.query.search) {
    vendors = filterBySearch(vendors, ['company', 'email', 'industry', 'city'], ctx.query.search)
  }
  if (ctx.query.status && ctx.query.status !== 'ALL') {
    vendors = vendors.filter((v) => v.status === ctx.query.status)
  }
  const result = paginate(vendors, ctx.query)
  return {
    ...result,
    items: result.items.map((v) => ({
      ...v,
      userCount: db.users.filter((u) => u.vendorId === v.id).length,
      productCount: db.products.filter((p) => p.vendorId === v.id).length,
    })),
  }
})

on('GET', '/admin/vendors/:vendorId', (ctx) => {
  requireUser(ctx)
  const db = getDb()
  const vendor = db.vendors.find((v) => v.id === ctx.params.vendorId)
  if (!vendor) throw new ApiError(404, 'Vendor not found')
  return {
    ...vendor,
    userCount: db.users.filter((u) => u.vendorId === vendor.id).length,
    productCount: db.products.filter((p) => p.vendorId === vendor.id).length,
    customerCount: db.customers.filter((c) => c.vendorId === vendor.id).length,
    invoiceTotal: round2(db.invoices.filter((i) => i.vendorId === vendor.id).reduce((s, i) => s + i.total, 0)),
    amountCollected: round2(db.invoices.filter((i) => i.vendorId === vendor.id).reduce((s, i) => s + i.amountPaid, 0)),
    employeeCount: db.employees.filter((e) => e.vendorId === vendor.id).length,
  }
})

on('POST', '/admin/vendors', (ctx) => {
  const user = requireUser(ctx)
  if (user.role !== 'SUPER_ADMIN') throw new ApiError(403, 'Only platform admins can create vendors')
  const db = getDb()
  const b = ctx.body || {}
  if (!b.company || !b.email) throw new ApiError(400, 'Company name and email are required')
  if (db.vendors.some((v) => v.email.toLowerCase() === b.email.toLowerCase())) {
    throw new ApiError(409, 'A vendor with this email already exists')
  }
  const vendor = {
    id: `v-${String(db.vendors.length + 1).padStart(2, '0')}`,
    company: b.company,
    registrationNumber: b.registrationNumber || `RC-${Date.now().toString().slice(-6)}`,
    email: b.email,
    phone: b.phone || '+234 800 000 0000',
    address: b.address || '—',
    city: b.city || 'Lagos',
    industry: b.industry || 'General',
    taxId: b.taxId || '',
    status: 'ACTIVE',
    plan: b.plan || 'BASIC',
    logo: null,
    createdAt: nowISO(),
    subscription: {
      startedAt: nowISO(),
      renewal: futureDays(60),
      monthlyFee: b.plan === 'ENTERPRISE' ? 850000 : b.plan === 'PROFESSIONAL' ? 450000 : 150000,
    },
    creditLimit: Number(b.creditLimit) || 0,
  }
  db.vendors.push(vendor)
  addAudit(ctx, 'created', 'vendor', vendor.id, `Created vendor ${vendor.company}`, vendor.id)
  return vendor
})

function futureDays(d) {
  const date = new Date(Date.now() + d * 86400000)
  return date.toISOString()
}

on('PATCH', '/admin/vendors/:vendorId', (ctx) => {
  requireUser(ctx)
  const db = getDb()
  const vendor = db.vendors.find((v) => v.id === ctx.params.vendorId)
  if (!vendor) throw new ApiError(404, 'Vendor not found')
  const allowed = ['company', 'registrationNumber', 'email', 'phone', 'address', 'city', 'industry', 'taxId', 'plan', 'creditLimit']
  allowed.forEach((k) => {
    if (ctx.body?.[k] !== undefined) vendor[k] = ctx.body[k]
  })
  addAudit(ctx, 'updated', 'vendor', vendor.id, `Updated vendor ${vendor.company}`, vendor.id)
  return vendor
})

on('POST', '/admin/vendors/:vendorId/status', (ctx) => {
  requireUser(ctx)
  const db = getDb()
  const vendor = db.vendors.find((v) => v.id === ctx.params.vendorId)
  if (!vendor) throw new ApiError(404, 'Vendor not found')
  const { status } = ctx.body || {}
  if (!['ACTIVE', 'SUSPENDED', 'INACTIVE', 'PENDING'].includes(status)) {
    throw new ApiError(400, 'Invalid vendor status')
  }
  vendor.status = status
  addAudit(ctx, 'changed status of', 'vendor', vendor.id, `${vendor.company} set to ${status}`, vendor.id)
  return vendor
})

on('DELETE', '/admin/vendors/:vendorId', (ctx) => {
  const user = requireUser(ctx)
  if (user.role !== 'SUPER_ADMIN') throw new ApiError(403, 'Only platform admins can delete vendors')
  const db = getDb()
  const idx = db.vendors.findIndex((v) => v.id === ctx.params.vendorId)
  if (idx === -1) throw new ApiError(404, 'Vendor not found')
  const [removed] = db.vendors.splice(idx, 1)
  addAudit(ctx, 'deleted', 'vendor', removed.id, `Deleted vendor ${removed.company}`, removed.id)
  return { message: 'Vendor deleted', id: removed.id }
})

on('GET', '/admin/vendors/:vendorId/users', (ctx) => {
  requireUser(ctx)
  const db = getDb()
  const users = db.users.filter((u) => u.vendorId === ctx.params.vendorId)
  return paginate(sortItems(users, ctx.query, 'createdAt'), ctx.query)
})

on('POST', '/admin/vendors/:vendorId/users', (ctx) => {
  const user = requireUser(ctx)
  if (user.role !== 'SUPER_ADMIN') throw new ApiError(403, 'Only platform admins can add users')
  const db = getDb()
  const b = ctx.body || {}
  if (!b.name || !b.email || !b.role) throw new ApiError(400, 'Name, email and role are required')
  const u = {
    id: `u-${ctx.params.vendorId}-${db.users.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
    vendorId: ctx.params.vendorId,
    name: b.name,
    email: b.email,
    role: b.role,
    status: b.status || 'INVITED',
    phone: b.phone || '',
    lastLogin: null,
  }
  db.users.push(u)
  return u
})

on('PATCH', '/admin/vendors/:vendorId/users/:userId', (ctx) => {
  requireUser(ctx)
  const db = getDb()
  const u = db.users.find((x) => x.id === ctx.params.userId && x.vendorId === ctx.params.vendorId)
  if (!u) throw new ApiError(404, 'User not found')
  ;['name', 'role', 'status', 'phone'].forEach((k) => {
    if (ctx.body?.[k] !== undefined) u[k] = ctx.body[k]
  })
  return u
})

on('GET', '/admin/users', (ctx) => {
  requireUser(ctx)
  const db = getDb()
  let users = [...db.users]
  if (ctx.query.search) users = filterBySearch(users, ['name', 'email', 'role'], ctx.query.search)
  users = sortItems(users, ctx.query, 'createdAt')
  return paginate(users, ctx.query)
})

on('PATCH', '/admin/users/:userId', (ctx) => {
  requireUser(ctx)
  const db = getDb()
  const u = db.users.find((x) => x.id === ctx.params.userId)
  if (!u) throw new ApiError(404, 'User not found')
  if (ctx.body?.status) u.status = ctx.body.status
  return u
})

/* ================= VENDOR SCOPED HELPERS ================= */

function vendorList(ctx, collection, { searchKeys = [], extraFilters = () => true, sortDefault = 'createdAt' } = {}) {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  let items = db[collection].filter((i) => i.vendorId === vendor.id && extraFilters(i))
  if (ctx.query.search) items = filterBySearch(items, searchKeys, ctx.query.search)
  if (ctx.query.status && ctx.query.status !== 'ALL') {
    items = items.filter((i) => i.status === ctx.query.status)
  }
  let sorted = sortItems(items, ctx.query, sortDefault)
  // cross-reference popups
  return paginate(sorted, ctx.query)
}

function enrichCustomer(c) {
  const db = getDb()
  const invoices = db.invoices.filter((i) => i.customerId === c.id)
  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0)
  const paid = invoices.reduce((s, i) => s + i.amountPaid, 0)
  return {
    ...c,
    totalInvoiced: round2(totalInvoiced),
    paidAmount: round2(paid),
    outstanding: round2(totalInvoiced - paid),
    invoiceCount: invoices.length,
    orderCount: db.orders.filter((o) => o.customerId === c.id).length,
  }
}

function enrichSupplier(s) {
  const db = getDb()
  const pos = db.purchaseOrders.filter((p) => p.supplierId === s.id)
  const totalOrdered = pos.reduce((sum, p) => sum + p.lines.reduce((x, l) => x + l.quantity * l.unitCost, 0), 0)
  return { ...s, productCount: (s.products || []).length, totalOrdered: round2(totalOrdered), poCount: pos.length }
}

function enrichProduct(p) {
  const db = getDb()
  const stockRows = db.stock.filter((s) => s.productId === p.id)
  const available = stockRows.reduce((s, r) => s + r.available, 0)
  const reserved = stockRows.reduce((s, r) => s + r.reserved, 0)
  const incoming = stockRows.reduce((s, r) => s + r.incoming, 0)
  const damaged = stockRows.reduce((s, r) => s + r.damaged, 0)
  return {
    ...p,
    available,
    reserved,
    incoming,
    damaged,
    stockRows,
    inventoryValue: round2((available + incoming) * p.costPrice),
  }
}

/* ================= CUSTOMERS ================= */

on('GET', '/vendor/:vendorId/customers', (ctx) => {
  const result = vendorList(ctx, 'customers', { searchKeys: ['firstName', 'lastName', 'company', 'email', 'phone'], sortDefault: 'createdAt' })
  return { ...result, items: result.items.map(enrichCustomer) }
})

on('GET', '/vendor/:vendorId/customers/:customerId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const c = db.customers.find((x) => x.id === ctx.params.customerId && x.vendorId === ctx.params.vendorId)
  if (!c) throw new ApiError(404, 'Customer not found')
  return enrichCustomer(c)
})

on('POST', '/vendor/:vendorId/customers', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.firstName || !b.lastName || !b.email) throw new ApiError(400, 'First name, last name and email are required')
  const id = `cst-${vendor.id}-${String(db.customers.filter((c) => c.vendorId === vendor.id).length + 1).padStart(3, '0')}-${Math.random().toString(36).slice(2, 5)}`
  const customer = {
    id,
    vendorId: vendor.id,
    firstName: b.firstName,
    lastName: b.lastName,
    company: b.company || null,
    email: b.email,
    phone: b.phone || '',
    address: b.address || '',
    creditLimit: Number(b.creditLimit) || 0,
    paymentTerms: b.paymentTerms || 'NET30',
    status: b.status || 'ACTIVE',
    createdAt: nowISO(),
    totalPurchases: 0,
    totalPaid: 0,
    outstanding: 0,
    notes: b.notes ? [{ text: b.notes, by: 'You', at: nowISO() }] : [],
    activity: [{ id: `act-${Date.now()}`, type: 'CUSTOMER_CREATED', title: 'Customer created', at: nowISO(), by: ctx.user.name || 'You' }],
  }
  db.customers.push(customer)
  addAudit(ctx, 'created', 'customer', id, `Created customer ${customer.firstName} ${customer.lastName}`, vendor.id)
  return enrichCustomer(customer)
})

on('PATCH', '/vendor/:vendorId/customers/:customerId', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const c = db.customers.find((x) => x.id === ctx.params.customerId && x.vendorId === vendor.id)
  if (!c) throw new ApiError(404, 'Customer not found')
  const allowed = ['firstName', 'lastName', 'company', 'email', 'phone', 'address', 'creditLimit', 'paymentTerms', 'status']
  allowed.forEach((k) => {
    if (ctx.body?.[k] !== undefined) c[k] = ctx.body[k]
  })
  c.activity.unshift({ id: `act-${Date.now()}`, type: 'CUSTOMER_UPDATED', title: 'Customer updated', at: nowISO(), by: ctx.user.name || 'You' })
  addAudit(ctx, 'updated', 'customer', c.id, `Updated customer ${c.company || c.firstName + ' ' + c.lastName}`, vendor.id)
  return enrichCustomer(c)
})

on('DELETE', '/vendor/:vendorId/customers/:customerId', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const idx = db.customers.findIndex((x) => x.id === ctx.params.customerId && x.vendorId === vendor.id)
  if (idx === -1) throw new ApiError(404, 'Customer not found')
  const [c] = db.customers.splice(idx, 1)
  addAudit(ctx, 'deleted', 'customer', c.id, `Deleted customer ${c.company || c.firstName + ' ' + c.lastName}`, vendor.id)
  return { message: 'Customer deleted' }
})

/* ================= SUPPLIERS ================= */

on('GET', '/vendor/:vendorId/suppliers', (ctx) => {
  const result = vendorList(ctx, 'suppliers', { searchKeys: ['name', 'contactPerson', 'email', 'phone'], sortDefault: 'createdAt' })
  return { ...result, items: result.items.map(enrichSupplier) }
})

on('GET', '/vendor/:vendorId/suppliers/:supplierId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const s = db.suppliers.find((x) => x.id === ctx.params.supplierId && x.vendorId === ctx.params.vendorId)
  if (!s) throw new ApiError(404, 'Supplier not found')
  const pos = db.purchaseOrders.filter((p) => p.supplierId === s.id)
  return {
    ...enrichSupplier(s),
    purchaseOrders: pos
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((p) => ({ id: p.id, number: p.number, status: p.status, total: round2(p.lines.reduce((x, l) => x + l.quantity * l.unitCost, 0)), createdAt: p.createdAt })),
    products: db.products.filter((p) => (s.products || []).includes(p.id)).map(enrichProduct),
  }
})

on('POST', '/vendor/:vendorId/suppliers', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.name || !b.contactPerson) throw new ApiError(400, 'Company name and contact person are required')
  const id = `sup-${vendor.id}-${db.suppliers.filter((s) => s.vendorId === vendor.id).length + 1}`
  const supplier = {
    id,
    vendorId: vendor.id,
    name: b.name,
    contactPerson: b.contactPerson,
    email: b.email || '',
    phone: b.phone || '',
    address: b.address || '',
    paymentTerms: b.paymentTerms || 'NET30',
    paymentMethod: b.paymentMethod || 'BANK_TRANSFER',
    status: b.status || 'ACTIVE',
    products: [],
  }
  db.suppliers.push(supplier)
  addAudit(ctx, 'created', 'supplier', id, `Created supplier ${supplier.name}`, vendor.id)
  return supplier
})

on('PATCH', '/vendor/:vendorId/suppliers/:supplierId', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const s = db.suppliers.find((x) => x.id === ctx.params.supplierId && x.vendorId === vendor.id)
  if (!s) throw new ApiError(404, 'Supplier not found')
  ;['name', 'contactPerson', 'email', 'phone', 'address', 'paymentTerms', 'paymentMethod', 'status'].forEach((k) => {
    if (ctx.body?.[k] !== undefined) s[k] = ctx.body[k]
  })
  return s
})

/* ================= CATEGORIES / PRODUCTS ================= */

on('GET', '/vendor/:vendorId/categories', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  return db.categories
    .filter((c) => c.vendorId === vendor.id)
    .map((c) => ({ ...c, productCount: db.products.filter((p) => p.categoryId === c.id).length }))
})

on('POST', '/vendor/:vendorId/categories', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.name) throw new ApiError(400, 'Category name is required')
  const c = {
    id: `cat-${vendor.id}-${db.categories.filter((x) => x.vendorId === vendor.id).length + 1}-${Math.random().toString(36).slice(2, 5)}`,
    vendorId: vendor.id,
    name: b.name,
    code: b.code || `CAT${db.categories.filter((x) => x.vendorId === vendor.id).length + 1}`,
    productCount: 0,
  }
  db.categories.push(c)
  return c
})

on('GET', '/vendor/:vendorId/products', (ctx) => {
  const result = vendorList(ctx, 'products', { searchKeys: ['name', 'sku', 'brand'], sortDefault: 'createdAt' })
  return { ...result, items: result.items.map(enrichProduct) }
})

on('GET', '/vendor/:vendorId/products/:productId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const p = db.products.find((x) => x.id === ctx.params.productId && x.vendorId === ctx.params.vendorId)
  if (!p) throw new ApiError(404, 'Product not found')
  const movements = db.stock
    .filter((s) => s.productId === p.id)
    .flatMap((s) => s.movements.map((m) => ({ ...m, warehouse: db.warehouses.find((w) => w.id === s.warehouseId)?.name, productId: p.id })))
  return { ...enrichProduct(p), movements: movements.sort((a, b) => new Date(b.at) - new Date(a.at)) }
})

on('POST', '/vendor/:vendorId/products', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.name || !b.sku) throw new ApiError(400, 'Name and SKU are required')
  const id = `prod-${vendor.id}-${db.products.filter((p) => p.vendorId === vendor.id).length + 1}`
  const product = {
    id,
    vendorId: vendor.id,
    categoryId: b.categoryId || null,
    type: b.type || 'PRODUCT',
    sku: b.sku,
    name: b.name,
    description: b.description || '',
    brand: b.brand || '',
    costPrice: Number(b.costPrice) || 0,
    sellingPrice: Number(b.sellingPrice) || 0,
    taxRate: Number(b.taxRate) || 7.5,
    reorderLevel: Number(b.reorderLevel) || 0,
    unit: b.unit || 'pcs',
    status: b.status || 'ACTIVE',
    supplierIds: b.supplierIds || [],
    supplierId: b.supplierId || null,
  }
  db.products.push(product)
  const supplier = b.supplierId ? db.suppliers.find((s) => s.id === b.supplierId) : null
  if (supplier) {
    supplier.products.push(id)
    product.supplierIds.push(supplier.id)
  }
  addAudit(ctx, 'created', 'product', id, `Created product ${product.name}`, vendor.id)
  return enrichProduct(product)
})

on('PATCH', '/vendor/:vendorId/products/:productId', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const p = db.products.find((x) => x.id === ctx.params.productId && x.vendorId === vendor.id)
  if (!p) throw new ApiError(404, 'Product not found')
  const allowed = ['categoryId', 'type', 'sku', 'name', 'description', 'brand', 'costPrice', 'sellingPrice', 'taxRate', 'reorderLevel', 'unit', 'status']
  allowed.forEach((k) => {
    if (ctx.body?.[k] !== undefined) {
      p[k] = k.includes('Price') || k === 'taxRate' || k === 'reorderLevel' ? Number(ctx.body[k]) : ctx.body[k]
    }
  })
  addAudit(ctx, 'updated', 'product', p.id, `Updated product ${p.name}`, vendor.id)
  return enrichProduct(p)
})

/* ================= WAREHOUSES ================= */

on('GET', '/vendor/:vendorId/warehouses', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  return db.warehouses
    .filter((w) => w.vendorId === vendor.id)
    .map((w) => {
      const rows = db.stock.filter((s) => s.warehouseId === w.id)
      return {
        ...w,
        stockLines: rows.length,
        totalUnits: rows.reduce((s, r) => s + r.available, 0),
        value: round2(rows.reduce((s, r) => s + (r.available + r.incoming) * r.unitCost, 0)),
      }
    })
})

on('GET', '/vendor/:vendorId/warehouses/:warehouseId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const w = db.warehouses.find((x) => x.id === ctx.params.warehouseId && x.vendorId === ctx.params.vendorId)
  if (!w) throw new ApiError(404, 'Warehouse not found')
  const rows = db.stock.filter((s) => s.warehouseId === w.id)
  const lines = rows.map((r) => {
    const p = db.products.find((x) => x.id === r.productId)
    return { ...r, product: p ? { id: p.id, name: p.name, sku: p.sku, categoryId: p.categoryId } : null }
  })
  return {
    ...w,
    lines: sortItems(lines, ctx.query, 'available').map((l) => l),
    value: round2(rows.reduce((s, r) => s + (r.available + r.incoming) * r.unitCost, 0)),
    totalUnits: rows.reduce((s, r) => s + r.available, 0),
  }
})

/* ================= STOCK / ADJUSTMENTS / TRANSFERS ================= */

on('GET', '/vendor/:vendorId/inventory', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  let rows = db.stock.filter((s) => s.vendorId === vendor.id)
  const q = ctx.query
  if (q.productId) rows = rows.filter((r) => r.productId === q.productId)
  if (q.warehouseId) rows = rows.filter((r) => r.warehouseId === q.warehouseId)
  if (q.lowStock === 'true') rows = rows.filter((r) => r.available <= r.reorderLevel)
  if (q.outOfStock === 'true') rows = rows.filter((r) => r.available <= 0)
  rows = rows.map((r) => {
    const p = db.products.find((x) => x.id === r.productId)
    const w = db.warehouses.find((x) => x.id === r.warehouseId)
    return {
      ...r,
      productName: p?.name,
      sku: p?.sku,
      productStatus: p?.status,
      warehouseName: w?.name,
      value: round2((r.available + r.incoming) * r.unitCost),
    }
  })
  rows = sortItems(rows, ctx.query, 'updatedAt')
  return paginate(rows, ctx.query)
})

on('GET', '/vendor/:vendorId/inventory/summary', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const products = db.products.filter((p) => p.vendorId === vendor.id && p.type === 'PRODUCT')
  const low = []
  products.forEach((p) => {
    const rows = db.stock.filter((s) => s.productId === p.id)
    const available = rows.reduce((s, r) => s + r.available, 0)
    if (available <= p.reorderLevel) {
      low.push({ ...enrichProduct(p), available })
    }
  })
  return {
    totalSKUs: products.length,
    totalValue: round2(db.stock.filter((s) => s.vendorId === vendor.id).reduce((s, r) => s + (r.available + r.incoming) * r.unitCost, 0)),
    lowStock: low.length,
    outOfStock: products.filter((p) => {
      const rows = db.stock.filter((s) => s.productId === p.id)
      return rows.reduce((s, r) => s + (r.available + r.incoming), 0) === 0
    }).length,
  }
})

on('GET', '/vendor/:vendorId/stock-adjustments', (ctx) => {
  const result = vendorList(ctx, 'adjustments', { searchKeys: ['reason'], sortDefault: 'createdAt' })
  return { ...result, items: result.items.map((a) => ({ ...a, productName: getDb().products.find((p) => p.id === a.productId)?.name })) }
})

on('POST', '/vendor/:vendorId/stock-adjustments', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.productId || !b.warehouseId || !b.type || !Number(b.quantity)) {
    throw new ApiError(400, 'Product, warehouse, type and quantity are required')
  }
  const row = db.stock.find((s) => s.productId === b.productId && s.warehouseId === b.warehouseId && s.vendorId === vendor.id)
  if (!row) throw new ApiError(404, 'Stock record not found')
  const adjustment = {
    id: `adj-${Date.now()}`,
    number: `ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
    vendorId: vendor.id,
    productId: b.productId,
    warehouseId: b.warehouseId,
    type: b.type,
    quantity: Number(b.quantity),
    reason: b.reason || '',
    createdBy: ctx.user.id,
    createdAt: nowISO(),
  }
  db.adjustments = db.adjustments || []
  db.adjustments.push(adjustment)
  if (['ADD', 'CORRECTION'].includes(b.type)) row.available += Number(b.quantity)
  else row.available = Math.max(0, row.available - Number(b.quantity))
  row.damaged += b.type === 'DAMAGED' ? Number(b.quantity) : 0
  row.movements.unshift({
    id: `mvt-${Date.now()}`,
    type: b.type === 'ADD' ? 'IN' : 'OUT',
    qty: Number(b.quantity),
    reason: `${b.type} tally`,
    at: nowISO(),
    userId: ctx.user.id,
  })
  addAudit(ctx, 'adjusted stock', 'product', b.productId, `${b.type}: ${Number(b.quantity)} units`, vendor.id)
  return adjustment
})

on('GET', '/vendor/:vendorId/stock-transfers', (ctx) => {
  const result = vendorList(ctx, 'transfers', { searchKeys: ['reference'], sortDefault: 'createdAt' })
  const db = getDb()
  return {
    ...result,
    items: result.items.map((t) => ({
      ...t,
      fromName: db.warehouses.find((w) => w.id === t.fromWarehouseId)?.name,
      toName: db.warehouses.find((w) => w.id === t.toWarehouseId)?.name,
      productName: db.products.find((p) => p.id === t.productId)?.name,
    })),
  }
})

on('POST', '/vendor/:vendorId/stock-transfers', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.productId || !b.fromWarehouseId || !b.toWarehouseId || !Number(b.quantity)) {
    throw new ApiError(400, 'Product, source, destination and quantity are required')
  }
  if (b.fromWarehouseId === b.toWarehouseId) throw new ApiError(400, 'Source and destination warehouses must differ')
  const transfer = {
    id: `tr-${Date.now()}`,
    reference: `XFER-${Math.floor(10000 + Math.random() * 90000)}`,
    vendorId: vendor.id,
    productId: b.productId,
    fromWarehouseId: b.fromWarehouseId,
    toWarehouseId: b.toWarehouseId,
    quantity: Number(b.quantity),
    status: 'REQUESTED',
    requestedBy: ctx.user.id,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    history: [{ status: 'REQUESTED', at: nowISO(), by: ctx.user.name || 'You' }],
  }
  db.transfers = db.transfers || []
  db.transfers.push(transfer)
  return transfer
})

on('POST', '/vendor/:vendorId/stock-transfers/:transferId/transition', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const t = db.transfers.find((x) => x.id === ctx.params.transferId && x.vendorId === vendor.id)
  if (!t) throw new ApiError(404, 'Transfer not found')
  const to = ctx.body?.to
  if (!canTransition(STOCK_TRANSITION_MAP, t.status, to)) throw new ApiError(400, `Invalid transition ${t.status} → ${to}`)
  if (to === 'RECEIVED') {
    const from = db.stock.find((s) => s.productId === t.productId && s.warehouseId === t.fromWarehouseId && s.vendorId === vendor.id)
    const dest = db.stock.find((s) => s.productId === t.productId && s.warehouseId === t.toWarehouseId && s.vendorId === vendor.id)
    if (!from || !dest) throw new ApiError(400, 'Stock records missing for transfer')
    if (from.available < t.quantity) throw new ApiError(400, 'Insufficient stock at source warehouse')
    from.available -= t.quantity
    dest.available += t.quantity
  }
  t.status = to
  t.updatedAt = nowISO()
  t.history.push({ status: to, at: nowISO(), by: ctx.user.name || 'You' })
  addAudit(ctx, 'updated', 'stock transfer', t.id, `Transfer ${t.reference} → ${to}`, vendor.id)
  return t
})

const STOCK_TRANSITION_MAP = {
  REQUESTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: [],
  REJECTED: [],
}

/* ================= QUOTES ================= */

on('GET', '/vendor/:vendorId/quotes', (ctx) => {
  const result = vendorList(ctx, 'quotes', { searchKeys: ['number', 'customerName'], sortDefault: 'createdAt' })
  return { ...result, items: result.items.map((q) => ({ ...q })) }
})

on('GET', '/vendor/:vendorId/quotes/:quoteId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const q = db.quotes.find((x) => x.id === ctx.params.quoteId && x.vendorId === ctx.params.vendorId)
  if (!q) throw new ApiError(404, 'Quote not found')
  return { ...q, customer: db.customers.find((c) => c.id === q.customerId) }
})

on('POST', '/vendor/:vendorId/quotes', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.customerId || !b.lines?.length) throw new ApiError(400, 'Customer and at least one line are required')
  const customer = db.customers.find((c) => c.id === b.customerId && c.vendorId === vendor.id)
  const seq = db.quotes.filter((x) => x.vendorId === vendor.id).length + 1
  const q = {
    id: `qt-${Date.now()}`,
    number: `QUOTE-${String(100000 + seq).slice(1)}`,
    vendorId: vendor.id,
    customerId: b.customerId,
    customerName: customer?.company || `${customer?.firstName} ${customer?.lastName}`,
    lines: b.lines.map((l) => ({ ...l })),
    discountType: b.discountType || 'FIXED',
    discountValue: Number(b.discountValue) || 0,
    taxRate: Number(b.taxRate) || 7.5,
    status: b.status || 'DRAFT',
    validUntil: b.validUntil || futureIn(21, 7),
    createdAt: nowISO(),
    issuedBy: ctx.user.id,
    activity: [{ id: `act-${Date.now()}`, type: 'QUOTE_CREATED', title: 'Quote created', at: nowISO(), by: ctx.user.name || 'You' }],
  }
  Object.assign(q, computeTotals(q))
  db.quotes.push(q)
  addAudit(ctx, 'created', 'quote', q.id, `Created quote ${q.number}`, vendor.id)
  return q
})

on('PATCH', '/vendor/:vendorId/quotes/:quoteId', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const q = db.quotes.find((x) => x.id === ctx.params.quoteId && x.vendorId === vendor.id)
  if (!q) throw new ApiError(404, 'Quote not found')
  const allowed = ['customerId', 'lines', 'discountType', 'discountValue', 'taxRate', 'validUntil']
  allowed.forEach((k) => {
    if (ctx.body?.[k] !== undefined) q[k] = ctx.body[k]
  })
  if (ctx.body?.customerId) {
    const customer = db.customers.find((c) => c.id === ctx.body.customerId)
    q.customerName = customer?.company || `${customer?.firstName} ${customer?.lastName}`
  }
  Object.assign(q, computeTotals(q))
  return q
})

on('POST', '/vendor/:vendorId/quotes/:quoteId/transition', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const q = db.quotes.find((x) => x.id === ctx.params.quoteId && x.vendorId === vendor.id)
  if (!q) throw new ApiError(404, 'Quote not found')
  const to = ctx.body?.to
  if (!canTransition(QUOTE_MAP, q.status, to)) throw new ApiError(400, `Invalid quote transition ${q.status} → ${to}`)
  q.status = to
  q.activity.unshift({ id: `act-${Date.now()}`, type: `QUOTE_${to}`, title: `Quote ${to.toLowerCase()}`, at: nowISO(), by: ctx.user.name || 'You' })
  addAudit(ctx, 'updated', 'quote', q.id, `Quote ${q.number} → ${to}`, vendor.id)
  return q
})

const QUOTE_MAP = { DRAFT: ['SENT', 'REJECTED'], SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'], ACCEPTED: [], REJECTED: [], EXPIRED: [] }

on('POST', '/vendor/:vendorId/quotes/:quoteId/convert', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const q = db.quotes.find((x) => x.id === ctx.params.quoteId && x.vendorId === vendor.id)
  if (!q) throw new ApiError(404, 'Quote not found')
  if (q.status !== 'ACCEPTED') throw new ApiError(400, 'Only accepted quotes can be converted to orders')
  const order = {
    id: `ord-${Date.now()}`,
    number: `SO-${String(100000 + db.orders.filter((o) => o.vendorId === vendor.id).length + 1)}`,
    vendorId: vendor.id,
    customerId: q.customerId,
    customerName: q.customerName,
    quoteId: q.id,
    lines: q.lines.map((l) => ({ ...l })),
    status: 'PENDING',
    subtotal: q.subtotal,
    discount: q.discount,
    taxable: q.taxable,
    tax: q.tax,
    total: q.total,
    createdAt: nowISO(),
    orderedAt: nowISO(),
    expectedDelivery: ctx.body?.expectedDelivery || futureIn(14, 3),
    issuedBy: ctx.user.id,
    payments: [],
    activity: [{ id: `act-${Date.now()}`, type: 'ORDER_CREATED', title: 'Order created from quote', at: nowISO(), by: ctx.user.name || 'You' }],
  }
  db.orders.push(order)
  q.activity.unshift({ id: `act-${Date.now()}`, type: 'ORDER_CREATED', title: 'Converted to sales order', at: nowISO(), by: ctx.user.name || 'You' })
  addAudit(ctx, 'converted', 'quote', q.id, `Converted ${q.number} to ${order.number}`, vendor.id)
  return order
})

/* ================= ORDERS ================= */

on('GET', '/vendor/:vendorId/orders', (ctx) => {
  const result = vendorList(ctx, 'orders', { searchKeys: ['number', 'customerName'], sortDefault: 'createdAt' })
  return result
})

on('GET', '/vendor/:vendorId/orders/:orderId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const o = db.orders.find((x) => x.id === ctx.params.orderId && x.vendorId === ctx.params.vendorId)
  if (!o) throw new ApiError(404, 'Order not found')
  const inv = db.invoices.find((i) => i.orderId === o.id)
  return { ...o, customer: db.customers.find((c) => c.id === o.customerId), invoice: inv || null }
})

on('POST', '/vendor/:vendorId/orders', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.customerId || !b.lines?.length) throw new ApiError(400, 'Customer and at least one line are required')
  const customer = db.customers.find((c) => c.id === b.customerId && c.vendorId === vendor.id)
  const lines = b.lines.map((l) => ({ ...l }))
  const order = {
    id: `ord-${Date.now()}`,
    number: `SO-${String(100000 + db.orders.filter((o) => o.vendorId === vendor.id).length + 1)}`,
    vendorId: vendor.id,
    customerId: b.customerId,
    customerName: customer?.company || `${customer?.firstName} ${customer?.lastName}`,
    quoteId: b.quoteId || null,
    lines,
    status: 'PENDING',
    subtotal: 0,
    discount: 0,
    taxable: 0,
    tax: 0,
    total: 0,
    createdAt: nowISO(),
    orderedAt: nowISO(),
    expectedDelivery: b.expectedDelivery || futureIn(14, 3),
    issuedBy: ctx.user.id,
    payments: [],
    activity: [{ id: `act-${Date.now()}`, type: 'ORDER_CREATED', title: 'Sales order created', at: nowISO(), by: ctx.user.name || 'You' }],
  }
  Object.assign(order, computeTotals(order))
  db.orders.push(order)
  addAudit(ctx, 'created', 'order', order.id, `Created sales order ${order.number}`, vendor.id)
  return order
})

on('POST', '/vendor/:vendorId/orders/:orderId/transition', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const o = db.orders.find((x) => x.id === ctx.params.orderId && x.vendorId === vendor.id)
  if (!o) throw new ApiError(404, 'Order not found')
  const to = ctx.body?.to
  if (!canTransition(ORDER_MAP, o.status, to)) throw new ApiError(400, `Invalid order transition ${o.status} → ${to}`)
  o.status = to
  if (to === 'RESERVED') {
    o.lines.forEach((l) => {
      db.stock
        .filter((s) => s.productId === l.productId && s.vendorId === vendor.id)
        .forEach((row) => {
          const take = Math.min(row.available, l.quantity)
          row.available -= take
          row.reserved += take
        })
    })
    o.activity.unshift({ id: `act-${Date.now()}`, type: 'STOCK_RESERVED', title: 'Inventory reserved for order', at: nowISO(), by: ctx.user.name || 'You' })
  }
  if (to === 'FULFILLED') {
    o.lines.forEach((l) => {
      let qty = l.quantity
      db.stock
        .filter((s) => s.productId === l.productId && s.vendorId === vendor.id)
        .forEach((row) => {
          const release = Math.min(row.reserved, qty)
          row.reserved -= release
          row.available -= release
          qty -= release
        })
    })
    o.activity.unshift({ id: `act-${Date.now()}`, type: 'ORDER_FULFILLED', title: 'Order fulfilled', at: nowISO(), by: ctx.user.name || 'You' })
  }
  o.activity.unshift({ id: `act-${Date.now()}`, type: 'ORDER_STATUS', title: `Order status → ${to}`, at: nowISO(), by: ctx.user.name || 'You' })
  addAudit(ctx, 'updated', 'order', o.id, `Order ${o.number} → ${to}`, vendor.id)
  return o
})

const ORDER_MAP = { DRAFT: ['PENDING', 'CANCELLED'], PENDING: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['RESERVED', 'FULFILLED', 'CANCELLED'], RESERVED: ['FULFILLED', 'CANCELLED'], FULFILLED: [], CANCELLED: [] }

/* ================= INVOICES ================= */

on('GET', '/vendor/:vendorId/invoices', (ctx) => {
  const db = getDb()
  const list = vendorList(ctx, 'invoices', { searchKeys: ['number', 'customerName'], sortDefault: 'createdAt' })
  return {
    ...list,
    items: list.items.map((i) => ({ ...i, outstanding: round2(Math.max(0, i.total - i.amountPaid)) })),
  }
})

on('GET', '/vendor/:vendorId/invoices/:invoiceId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const i = db.invoices.find((x) => x.id === ctx.params.invoiceId && x.vendorId === ctx.params.vendorId)
  if (!i) throw new ApiError(404, 'Invoice not found')
  return { ...i, outstanding: round2(Math.max(0, i.total - i.amountPaid)), customer: db.customers.find((c) => c.id === i.customerId) }
})

on('POST', '/vendor/:vendorId/invoices', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.customerId || !b.lines?.length) throw new ApiError(400, 'Customer and at least one line are required')
  const num = 10001 + db.invoices.filter((i) => i.vendorId === vendor.id).length
  const inv = {
    id: `inv-${Date.now()}`,
    number: `INV-${String(num)}`,
    vendorId: vendor.id,
    customerId: b.customerId,
    customerName: b.customerName || '',
    orderId: b.orderId || null,
    lines: b.lines.map((l) => ({ ...l })),
    discountType: b.discountType || 'FIXED',
    discountValue: Number(b.discountValue) || 0,
    taxRate: Number(b.taxRate) || 7.5,
    status: b.status || 'DRAFT',
    dueDate: b.dueDate || futureIn(30, 15),
    createdAt: nowISO(),
    issuedAt: b.status === 'SENT' ? nowISO() : null,
    issuedBy: ctx.user.id,
    amountPaid: 0,
    payments: [],
    activity: [{ id: `act-${Date.now()}`, type: 'INVOICE_CREATED', title: 'Invoice created', at: nowISO(), by: ctx.user.name || 'You' }],
  }
  const customer = db.customers.find((c) => c.id === b.customerId)
  inv.customerName = inv.customerName || customer?.company || `${customer?.firstName} ${customer?.lastName}`
  inv.paymentTerms = b.paymentTerms || customer?.paymentTerms || 'NET30'
  Object.assign(inv, computeTotals(inv))
  db.invoices.push(inv)
  addAudit(ctx, 'created', 'invoice', inv.id, `Created invoice ${inv.number}`, vendor.id)
  return inv
})

on('PATCH', '/vendor/:vendorId/invoices/:invoiceId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const i = db.invoices.find((x) => x.id === ctx.params.invoiceId && x.vendorId === ctx.params.vendorId)
  if (!i) throw new ApiError(404, 'Invoice not found')
  const allowed = ['lines', 'discountType', 'discountValue', 'taxRate', 'dueDate', 'paymentTerms']
  allowed.forEach((k) => {
    if (ctx.body?.[k] !== undefined) i[k] = ctx.body[k]
  })
  Object.assign(i, computeTotals(i))
  return i
})

on('POST', '/vendor/:vendorId/invoices/:invoiceId/transition', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const i = db.invoices.find((x) => x.id === ctx.params.invoiceId && x.vendorId === vendor.id)
  if (!i) throw new ApiError(404, 'Invoice not found')
  const to = ctx.body?.to
  if (!canTransition(INVOICE_MAP, i.status, to)) throw new ApiError(400, `Invalid invoice transition ${i.status} → ${to}`)
  i.status = to
  if (to === 'SENT') i.issuedAt = nowISO()
  i.activity.unshift({ id: `act-${Date.now()}`, type: 'INVOICE_STATUS', title: `Invoice marked ${to}`, at: nowISO(), by: ctx.user.name || 'You' })
  addAudit(ctx, 'updated', 'invoice', i.id, `Invoice ${i.number} → ${to}`, vendor.id)
  return i
})

const INVOICE_MAP = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'OVERDUE'],
  PAID: [],
  OVERDUE: ['PARTIALLY_PAID', 'PAID'],
  CANCELLED: [],
}

on('POST', '/vendor/:vendorId/invoices/:invoiceId/payments', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const i = db.invoices.find((x) => x.id === ctx.params.invoiceId && x.vendorId === vendor.id)
  if (!i) throw new ApiError(404, 'Invoice not found')
  const amount = Number(ctx.body?.amount)
  if (!amount || amount <= 0) throw new ApiError(400, 'A valid payment amount is required')
  const outstanding = i.total - i.amountPaid
  if (amount > outstanding + 0.01) throw new ApiError(400, 'Payment exceeds invoice outstanding balance')
  const pay = {
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    number: `PAY-${String(100000 + db.payments.length + 1)}`,
    vendorId: vendor.id,
    customerId: i.customerId,
    customerName: i.customerName,
    invoiceId: i.id,
    invoiceNumber: i.number,
    amount: round2(amount),
    method: ctx.body?.method || 'BANK_TRANSFER',
    reference: ctx.body?.reference || `TXN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    status: 'PAID',
    paidAt: nowISO(),
    receivedBy: ctx.user.id,
    createdAt: nowISO(),
  }
  db.payments.push(pay)
  i.payments.push(pay)
  i.amountPaid = round2(i.amountPaid + amount)
  const left = round2(i.total - i.amountPaid)
  if (left <= 0.01) i.status = 'PAID'
  else if (i.status === 'SENT' || i.status === 'OVERDUE') i.status = 'PARTIALLY_PAID'
  i.activity.unshift({
    id: `act-${Date.now()}`,
    type: 'PAYMENT_RECEIVED',
    title: `Payment received ₦${Number(amount).toLocaleString('en-NG')}`,
    at: nowISO(),
    by: ctx.user.name || 'You',
  })
  addAudit(ctx, 'recorded payment for', 'invoice', i.id, `Payment ₦${Number(amount).toLocaleString('en-NG')} on ${i.number}`, vendor.id)
  return { payment: pay, invoice: { ...i, outstanding: Math.max(0, left) } }
})

/* ================= PAYMENTS ================= */

on('GET', '/vendor/:vendorId/payments', (ctx) => {
  return vendorList(ctx, 'payments', { searchKeys: ['number', 'reference', 'customerName', 'invoiceNumber'], sortDefault: 'createdAt' })
})

/* ================= RECEIVABLES / PAYABLES ================= */

function aging(bucket, dueKey = 'dueDate') {
  const today = new Date()
  const now = today.getTime()
  const day = 86400000
  return {
    current: bucket.filter((x) => x[dueKey] && now - new Date(x[dueKey]).getTime() <= 0),
    days30: bucket.filter((x) => x[dueKey] && now - new Date(x[dueKey]).getTime() > 0 && now - new Date(x[dueKey]).getTime() <= 30 * day),
    days60: bucket.filter((x) => x[dueKey] && now - new Date(x[dueKey]).getTime() > 30 * day && now - new Date(x[dueKey]).getTime() <= 60 * day),
    days90: bucket.filter((x) => x[dueKey] && now - new Date(x[dueKey]).getTime() > 60 * day && now - new Date(x[dueKey]).getTime() <= 90 * day),
    days90plus: bucket.filter((x) => x[dueKey] && now - new Date(x[dueKey]).getTime() > 90 * day),
  }
}

on('GET', '/vendor/:vendorId/accounting/receivables', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const invoices = db.invoices
    .filter((i) => i.vendorId === vendor.id && i.status !== 'CANCELLED' && i.status !== 'PAID' && i.status !== 'DRAFT')
    .map((i) => {
      const days = Math.round((Date.now() - new Date(i.dueDate).getTime()) / 86400000)
      return {
        invoiceId: i.id,
        invoiceNumber: i.number,
        customerId: i.customerId,
        customerName: i.customerName,
        dueDate: i.dueDate,
        total: i.total,
        paid: i.amountPaid,
        outstanding: round2(Math.max(0, i.total - i.amountPaid)),
        daysOverdue: days > 0 ? days : 0,
      }
    })
    .filter((x) => x.outstanding > 0)
  const buckets = aging(invoices)
  const byStatus = {
    current: round2(buckets.current.reduce((s, b) => s + b.outstanding, 0)),
    days30: round2(buckets.days30.reduce((s, b) => s + b.outstanding, 0)),
    days60: round2(buckets.days60.reduce((s, b) => s + b.outstanding, 0)),
    days90: round2(buckets.days90.reduce((s, b) => s + b.outstanding, 0)),
    days90plus: round2(buckets.days90plus.reduce((s, b) => s + b.outstanding, 0)),
  }
  return {
    totalInvoiced: round2(invoices.reduce((s, x) => s + x.total, 0)),
    totalPaid: round2(invoices.reduce((s, x) => s + x.paid, 0)),
    outstanding: round2(invoices.reduce((s, x) => s + x.outstanding, 0)),
    overdue: round2(invoices.filter((x) => x.daysOverdue > 0).reduce((s, x) => s + x.outstanding, 0)),
    agingByStatus: byStatus,
    items: sortItems(invoices, ctx.query, 'dueDate').slice(0, Number(ctx.query.limit) || 50),
  }
})

function supplierTotals(supplierId) {
  const db = getDb()
  const pos = db.purchaseOrders.filter((p) => p.supplierId === supplierId && p.status !== 'CANCELLED')
  return pos.reduce(
    (acc, po) => {
      const total = round2(po.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0))
      acc.total += total
      acc.paid += round2(total * (po.status === 'RECEIVED' ? 0.85 : po.status === 'PARTIALLY_RECEIVED' ? 0.4 : 0))
      return acc
    },
    { total: 0, paid: 0 }
  )
}

on('GET', '/vendor/:vendorId/accounting/payables', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const suppliers = db.suppliers.filter((s) => s.vendorId === vendor.id)
  const items = suppliers.map((s) => {
    const { total, paid } = supplierTotals(s.id)
    return {
      supplierId: s.id,
      supplierName: s.name,
      totalOrdered: total,
      paid,
      outstanding: round2(total - paid),
    }
  })
  const outstanding = items.reduce((s, x) => s + x.outstanding, 0)
  return {
    totalOrdered: round2(items.reduce((s, x) => s + x.totalOrdered, 0)),
    totalPaid: round2(items.reduce((s, x) => s + x.paid, 0)),
    outstanding: round2(outstanding),
    items: items.filter((x) => x.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding),
  }
})

/* ================= PURCHASING ================= */

on('GET', '/vendor/:vendorId/purchase-requests', (ctx) => {
  const result = vendorList(ctx, 'purchaseRequests', { searchKeys: ['number', 'supplierName'], sortDefault: 'createdAt' })
  return result
})

on('POST', '/vendor/:vendorId/purchase-requests', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.lines?.length) throw new ApiError(400, 'At least one line item is required')
  const pr = {
    id: `pr-${Date.now()}`,
    number: `PR-${String(100000 + db.purchaseRequests.length + 1)}`,
    vendorId: vendor.id,
    supplierId: b.supplierId || null,
    supplierName: b.supplierId && db.suppliers.find((s) => s.id === b.supplierId)?.name,
    lines: b.lines.map((l) => ({ id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, ...l })),
    requestedBy: ctx.user.id,
    department: b.department || 'Operations',
    status: 'PENDING_APPROVAL',
    createdAt: nowISO(),
    activity: [],
  }
  db.purchaseRequests.push(pr)
  return pr
})

on('POST', '/vendor/:vendorId/purchase-requests/:id/transition', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const pr = db.purchaseRequests.find((x) => x.id === ctx.params.id && x.vendorId === vendor.id)
  if (!pr) throw new ApiError(404, 'Purchase request not found')
  pr.status = ctx.body?.to || pr.status
  return pr
})

on('GET', '/vendor/:vendorId/purchase-orders', (ctx) => {
  const result = vendorList(ctx, 'purchaseOrders', { searchKeys: ['number', 'supplierName'], sortDefault: 'createdAt' })
  const db = getDb()
  return {
    ...result,
    items: result.items.map((po) => ({ ...po, total: round2(po.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0)) })),
  }
})

on('GET', '/vendor/:vendorId/purchase-orders/:poId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const po = db.purchaseOrders.find((x) => x.id === ctx.params.poId && x.vendorId === ctx.params.vendorId)
  if (!po) throw new ApiError(404, 'Purchase order not found')
  return po
})

on('POST', '/vendor/:vendorId/purchase-orders', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.supplierId || !b.lines?.length) throw new ApiError(400, 'Supplier and line items are required')
  const po = {
    id: `po-${Date.now()}`,
    number: `PO-${String(100000 + db.purchaseOrders.length + 1)}`,
    vendorId: vendor.id,
    supplierId: b.supplierId,
    supplierName: db.suppliers.find((s) => s.id === b.supplierId)?.name,
    purchaseRequestId: b.purchaseRequestId || null,
    lines: b.lines.map((l) => ({ id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, receivedQty: 0, ...l })),
    status: 'DRAFT',
    expectedDelivery: b.expectedDelivery || futureIn(20, 5),
    createdAt: nowISO(),
    approvedBy: null,
    receivedAt: null,
    activity: [],
  }
  db.purchaseOrders.push(po)
  return po
})

on('POST', '/vendor/:vendorId/purchase-orders/:poId/transition', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const po = db.purchaseOrders.find((x) => x.id === ctx.params.poId && x.vendorId === vendor.id)
  if (!po) throw new ApiError(404, 'Purchase order not found')
  const to = ctx.body?.to
  if (!canTransition(PO_MAP, po.status, to)) throw new ApiError(400, `Invalid PO transition ${po.status} → ${to}`)
  po.status = to
  if (to === 'APPROVED') po.approvedBy = ctx.user.id
  po.activity.unshift({ id: `act-${Date.now()}`, type: 'PO_STATUS', title: `PO status → ${to}`, at: nowISO(), by: ctx.user.name || 'You' })
  addAudit(ctx, 'approved', 'purchase order', po.id, `Purchase order ${po.number} → ${to}`, vendor.id)
  return po
})

const PO_MAP = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
}

on('POST', '/vendor/:vendorId/purchase-orders/:poId/receive', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const po = db.purchaseOrders.find((x) => x.id === ctx.params.poId && x.vendorId === vendor.id)
  if (!po) throw new ApiError(404, 'Purchase order not found')
  const receivedLines = (ctx.body?.lines || po.lines).map((l) => ({ ...l, receivedQty: Number(l.receivedQty) }))
  receivedLines.forEach((l) => {
    const poLine = po.lines.find((x) => x.id === l.id)
    if (poLine) poLine.receivedQty = Number(l.receivedQty) || poLine.receivedQty
  })
  const allReceived = po.lines.every((l) => l.receivedQty >= l.quantity)
  po.status = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED'
  po.receivedAt = nowISO()
  db.receipts.push({
    id: `gr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    number: `GRN-${String(100000 + db.receipts.length + 1)}`,
    vendorId: vendor.id,
    purchaseOrderId: po.id,
    supplierId: po.supplierId,
    supplierName: po.supplierName,
    lines: receivedLines.map((l) => ({ productId: l.productId, productName: l.productName, quantity: l.receivedQty, unitCost: l.unitCost })),
    status: 'POSTED',
    receivedAt: nowISO(),
  })
  /* add received qty from primary warehouse that has this product */
  receivedLines.forEach((l) => {
    if (!Number(l.receivedQty)) return
    const row = db.stock.find((s) => s.productId === l.productId && s.vendorId === vendor.id && s.warehouseId.endsWith('1'))
    if (row) {
      row.available += Number(l.receivedQty)
      row.incoming = Math.max(0, row.incoming - Number(l.receivedQty))
      row.movements.unshift({ id: `mvt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, type: 'IN', qty: Number(l.receivedQty), reason: 'GOODS RECEIVED', at: nowISO(), userId: ctx.user.id })
    }
  })
  addAudit(ctx, 'received goods for', 'purchase order', po.id, `Goods received against ${po.number}`, vendor.id)
  return po
})

on('GET', '/vendor/:vendorId/goods-receipts', (ctx) => {
  const result = vendorList(ctx, 'receipts', { searchKeys: ['number', 'supplierName'], sortDefault: 'receivedAt' })
  return result
})

/* ================= EXPENSES ================= */

on('GET', '/vendor/:vendorId/expenses', (ctx) => {
  return vendorList(ctx, 'expenses', { searchKeys: ['number', 'description', 'category'], sortDefault: 'createdAt' })
})

on('POST', '/vendor/:vendorId/expenses', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.category || !Number(b.amount)) throw new ApiError(400, 'Category and amount are required')
  const exp = {
    id: `exp-${Date.now()}`,
    number: `EXP-${String(100000 + db.expenses.length + 1)}`,
    vendorId: vendor.id,
    category: b.category,
    description: b.description || '',
    amount: Number(b.amount),
    paidTo: (b.paidTo || '').toUpperCase(),
    paymentMethod: b.paymentMethod || 'BANK_TRANSFER',
    status: 'DRAFT',
    submittedBy: ctx.user.id,
    submittedAt: nowISO(),
    approvedBy: null,
    approvedAt: null,
    paidAt: null,
    activity: [{ id: `act-${Date.now()}`, type: 'EXPENSE_CREATED', title: 'Expense draft created', at: nowISO(), by: ctx.user.name || 'You' }],
  }
  db.expenses.push(exp)
  return exp
})

on('POST', '/vendor/:vendorId/expenses/:expenseId/transition', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const exp = db.expenses.find((x) => x.id === ctx.params.expenseId && x.vendorId === vendor.id)
  if (!exp) throw new ApiError(404, 'Expense not found')
  const to = ctx.body?.to
  if (!canTransition(EXPENSE_MAP, exp.status, to)) throw new ApiError(400, `Invalid expense transition ${exp.status} → ${to}`)
  exp.status = to
  if (to === 'APPROVED') {
    exp.approvedBy = ctx.user.id
    exp.approvedAt = nowISO()
  }
  if (to === 'PAID') exp.paidAt = nowISO()
  exp.activity.unshift({ id: `act-${Date.now()}`, type: 'EXPENSE_STATUS', title: `Expense → ${to}`, at: nowISO(), by: ctx.user.name || 'You' })
  addAudit(ctx, 'updated', 'expense', exp.id, `Expense ${exp.number} → ${to}`, vendor.id)
  return exp
})

const EXPENSE_MAP = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['PROCESSED', 'PAID'],
  REJECTED: [],
  PROCESSED: ['PAID'],
  PAID: [],
}

/* ================= FINANCE / ACCOUNTING ================= */

on('GET', '/vendor/:vendorId/accounting/financial', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const range = dates(ctx)
  const inv = db.invoices.filter((i) => i.vendorId === vendor.id && i.status !== 'CANCELLED')
  const exps = db.expenses.filter((e) => e.vendorId === vendor.id && e.status !== 'REJECTED' && e.status !== 'DRAFT')
  const applicable = (arr, field) => (range ? arr.filter((x) => inRange(new Date(x[field]), range.from, range.to)) : arr)
  const revenue = round2(applicable(inv, 'createdAt').reduce((s, i) => s + i.total, 0))
  const collected = round2(applicable(inv, 'createdAt').reduce((s, i) => s + i.amountPaid, 0))
  const expenses = round2(applicable(exps, 'createdAt').reduce((s, e) => s + e.amount, 0))
  const gross = round2(revenue - expenses)
  const receivables = round2(
    inv.filter((i) => i.status !== 'PAID').reduce((s, i) => s + Math.max(0, i.total - i.amountPaid), 0)
  )
  const payablesRes = getPayables(db, vendor.id)
  const cashFlow = monthSeries(12, (d) => {
    const mInv = inv.filter((i) => inMonth(new Date(i.createdAt), d))
    const mExp = exps.filter((e) => inMonth(new Date(e.createdAt), d))
    return {
      label: monthShort(d),
      inflow: round2(mInv.reduce((s, i) => s + i.amountPaid, 0)),
      outflow: round2(mExp.reduce((s, e) => s + e.amount, 0)),
    }
  })
  return {
    revenue,
    collected,
    outstanding: round2(revenue - collected),
    expenses,
    gross,
    net: round2(revenue - expenses),
    receivables,
    payables: payablesRes.total,
    cashFlow,
    series: monthSeries(12, (d) => {
      const mInv = inv.filter((i) => inMonth(new Date(i.createdAt), d))
      const mExp = exps.filter((e) => inMonth(new Date(e.createdAt), d))
      return {
        label: monthShort(d),
        revenue: round2(mInv.reduce((s, i) => s + i.total, 0)),
        collected: round2(mInv.reduce((s, i) => s + i.amountPaid, 0)),
        expenses: round2(mExp.reduce((s, e) => s + e.amount, 0)),
        profit: round2(mInv.reduce((s, i) => s + i.total, 0) - mExp.reduce((s, e) => s + e.amount, 0)),
      }
    }),
  }
})

function getPayables(db, vendorId) {
  const suppliers = db.suppliers.filter((s) => s.vendorId === vendorId)
  let total = 0
  suppliers.forEach((s) => {
    const { total: t, paid: p } = supplierTotals(s.id)
    total += t - p
  })
  return { total: round2(total) }
}

on('GET', '/vendor/:vendorId/accounting/cashflow', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  return monthSeries(12, (d) => {
    const inv = db.invoices.filter((i) => i.vendorId === ctx.params.vendorId && inMonth(new Date(i.createdAt), d))
    const exps = db.expenses.filter((e) => e.vendorId === ctx.params.vendorId && e.status !== 'REJECTED' && inMonth(new Date(e.createdAt), d))
    const inflow = inv.reduce((s, i) => s + i.amountPaid, 0)
    const outflow = exps.reduce((s, e) => s + e.amount, 0)
    return { label: monthShort(d), inflow: round2(inflow), outflow: round2(outflow), net: round2(inflow - outflow) }
  })
})

/* ================= DASHBOARD ================= */

on('GET', '/vendor/:vendorId/dashboard', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const vid = vendor.id
  const invoices = db.invoices.filter((i) => i.vendorId === vid && i.status !== 'CANCELLED')
  const expenses = db.expenses.filter((e) => e.vendorId === vid && e.status !== 'REJECTED' && e.status !== 'DRAFT')
  const sales = invoices.reduce((s, i) => s + i.total, 0)
  const collected = invoices.reduce((s, i) => s + i.amountPaid, 0)
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const receivables = invoiceOutstanding(invoices)
  const payables = getPayables(db, vid).total
  const stock = db.stock.filter((s) => s.vendorId === vid)
  const lowStock = stock
    .filter((s) => s.available <= s.reorderLevel)
    .map((s) => {
      const p = db.products.find((x) => x.id === s.productId)
      const w = db.warehouses.find((x) => x.id === s.warehouseId)
      return { ...s, productName: p?.name, sku: p?.sku, warehouseName: w?.name }
    })
  const overdueInv = invoices
    .filter((i) => i.status !== 'PAID' && new Date(i.dueDate) < new Date())
    .map((i) => ({ ...i, outstanding: round2(Math.max(0, i.total - i.amountPaid)) }))
  const recentInvoices = [...invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6)
  const recentOrders = [...db.orders.filter((o) => o.vendorId === vid)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6)
  const activities = [
    ...db.auditLogs.filter((a) => a.vendorId === vid).slice(0, 8).map((a) => ({ id: a.id, title: a.detail, type: 'AUDIT', at: a.at })),
    ...invoices.slice(0, 4).map((i) => ({ id: `act-i-${i.id}`, title: `Invoice ${i.number} created`, type: 'INVOICE', at: i.createdAt })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10)
  const salesSeries = monthSeries(12, (d) => {
    const mInv = invoices.filter((i) => inMonth(new Date(i.createdAt), d))
    return { label: monthShort(d), revenue: round2(mInv.reduce((s, i) => s + i.total, 0)), collected: round2(mInv.reduce((s, i) => s + i.amountPaid, 0)) }
  })
  const expenseSeries = monthSeries(12, (d) => {
    const mExp = expenses.filter((e) => inMonth(new Date(e.createdAt), d))
    return { label: monthShort(d), expenses: round2(mExp.reduce((s, e) => s + e.amount, 0)) }
  })
  const ordersOpen = db.orders.filter((o) => o.vendorId === vid && ['PENDING', 'CONFIRMED', 'RESERVED'].includes(o.status)).length
  return {
    metrics: {
      sales: round2(sales),
      expenses: expenseTotal,
      grossProfit: round2(sales - expenseTotal),
      customers: db.customers.filter((c) => c.vendorId === vid).length,
      products: db.products.filter((p) => p.vendorId === vid).length,
      inventoryValue: round2(stock.reduce((s, r) => s + (r.available + r.incoming) * r.unitCost, 0)),
      outstandingInvoices: receivables,
      payables,
      receivables,
      collected,
      lowStockCount: lowStock.length,
      overdueCount: overdueInv.length,
      openQuotes: db.quotes.filter((q) => q.vendorId === vid && q.status === 'SENT').length,
      openOrders: ordersOpen,
      invoicesSent: invoices.filter((i) => ['SENT', 'OVERDUE'].includes(i.status)).length,
    },
    salesSeries,
    expenseSeries,
    lowStock,
    overdueInvoices: overdueInv,
    recentInvoices,
    recentOrders,
    activities,
  }
})

function invoiceOutstanding(invoices) {
  return round2(invoices.reduce((s, i) => s + Math.max(0, i.total - i.amountPaid), 0))
}

/* ================= HR ================= */

on('GET', '/vendor/:vendorId/departments', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  return db.departments
    .filter((d) => d.vendorId === vendor.id)
    .map((d) => ({ ...d, employeeCount: db.employees.filter((e) => e.departmentId === d.id).length }))
})

on('POST', '/vendor/:vendorId/departments', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.name) throw new ApiError(400, 'Department name is required')
  const d = {
    id: `dep-${vendor.id}-${db.departments.filter((x) => x.vendorId === vendor.id).length + 1}`,
    vendorId: vendor.id,
    name: b.name,
    code: b.code || `DEP${db.departments.filter((x) => x.vendorId === vendor.id).length + 1}`,
    headId: b.headId || null,
    description: b.description || '',
    employeeCount: 0,
  }
  db.departments.push(d)
  return d
})

on('GET', '/vendor/:vendorId/employees', (ctx) => {
  const db = getDb()
  const result = vendorList(ctx, 'employees', { searchKeys: ['name', 'email', 'employeeId', 'position'], sortDefault: 'employmentDate' })
  return {
    ...result,
    items: result.items.map((e) => ({
      ...e,
      departmentName: db.departments.find((d) => d.id === e.departmentId)?.name,
      managerName: db.employees.find((m) => m.id === e.managerId)?.name,
    })),
  }
})

on('GET', '/vendor/:vendorId/employees/:employeeId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const e = db.employees.find((x) => x.id === ctx.params.employeeId && x.vendorId === ctx.params.vendorId)
  if (!e) throw new ApiError(404, 'Employee not found')
  const attendance = db.attendance.filter((a) => a.employeeId === e.id).slice(-30)
  const leave = db.leave.filter((l) => l.employeeId === e.id)
  return {
    ...e,
    departmentName: db.departments.find((d) => d.id === e.departmentId)?.name,
    attendance,
    leave,
    projects: db.tasks.filter((t) => t.assigneeId === e.id).map((t) => ({ id: t.id, title: t.title, status: t.status, projectId: t.projectId })),
  }
})

on('POST', '/vendor/:vendorId/employees', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.name || !b.email || !b.departmentId) throw new ApiError(400, 'Name, email and department are required')
  const emp = {
    id: `emp-${vendor.id}-${db.employees.filter((e) => e.vendorId === vendor.id).length + 1}-${Math.random().toString(36).slice(2, 5)}`,
    vendorId: vendor.id,
    employeeId: b.employeeId || `EMP-${String(db.employees.filter((e) => e.vendorId === vendor.id).length + 1).padStart(4, '0')}`,
    userId: null,
    name: b.name,
    email: b.email,
    phone: b.phone || '',
    departmentId: b.departmentId,
    position: b.position || 'Staff',
    managerId: b.managerId || null,
    salary: Number(b.salary) || 0,
    employmentDate: b.employmentDate || nowISO(),
    status: b.status || 'ACTIVE',
    activity: [],
  }
  db.employees.push(emp)
  return emp
})

on('PATCH', '/vendor/:vendorId/employees/:employeeId', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const e = db.employees.find((x) => x.id === ctx.params.employeeId && x.vendorId === vendor.id)
  if (!e) throw new ApiError(404, 'Employee not found')
  ;['name', 'email', 'phone', 'departmentId', 'position', 'managerId', 'salary', 'status'].forEach((k) => {
    if (ctx.body?.[k] !== undefined) e[k] = ctx.body[k]
  })
  return e
})

on('GET', '/vendor/:vendorId/attendance', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const rows = db.attendance.filter((a) => a.vendorId === vendor.id)
  const today = new Date().toISOString().slice(0, 10)
  const todayRows = rows.filter((a) => a.date === today)
  const summary = {
    employees: db.employees.filter((e) => e.vendorId === vendor.id && e.status === 'ACTIVE').length,
    present: todayRows.filter((a) => a.status === 'PRESENT').length,
    absent: todayRows.filter((a) => a.status === 'ABSENT').length,
    late: todayRows.filter((a) => a.status === 'LATE').length,
    leave: todayRows.filter((a) => a.status === 'LEAVE').length,
  }
  return {
    summary,
    items: sortItems(
      rows.map((a) => ({ ...a, employeeName: db.employees.find((e) => e.id === a.employeeId)?.name })).slice(-400),
      ctx.query,
      'date'
    ),
  }
})

on('POST', '/vendor/:vendorId/attendance', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const { employeeId, date, status } = ctx.body || {}
  if (!employeeId || !date || !status) throw new ApiError(400, 'Employee, date and status are required')
  db.attendance.push({
    id: `att-${Date.now()}`,
    vendorId: vendor.id,
    employeeId,
    date,
    status,
    checkIn: null,
    checkOut: null,
    recordedBy: ctx.user.id,
  })
  return { message: 'Attendance recorded' }
})

on('GET', '/vendor/:vendorId/leave', (ctx) => {
  const result = vendorList(ctx, 'leave', { searchKeys: ['employeeName', 'type'], sortDefault: 'appliedAt' })
  return result
})

on('POST', '/vendor/:vendorId/leave', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.employeeId || !b.type || !b.startDate || !b.endDate) throw new ApiError(400, 'Employee, type, start and end dates are required')
  if (new Date(b.endDate) < new Date(b.startDate)) throw new ApiError(400, 'End date cannot be before start date')
  const emp = db.employees.find((e) => e.id === b.employeeId)
  const leave = {
    id: `lv-${Date.now()}`,
    vendorId: vendor.id,
    employeeId: b.employeeId,
    employeeName: ctx.body?.employeeName || emp?.name,
    type: b.type,
    startDate: b.startDate,
    endDate: b.endDate,
    days: Math.round((new Date(b.endDate) - new Date(b.startDate)) / 86400000) + 1,
    reason: b.reason || '',
    status: 'PENDING',
    appliedAt: nowISO(),
    reviewBy: null,
    reviewedAt: null,
    activity: [],
  }
  db.leave.push(leave)
  return leave
})

on('POST', '/vendor/:vendorId/leave/:leaveId/transition', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const lv = db.leave.find((x) => x.id === ctx.params.leaveId && x.vendorId === vendor.id)
  if (!lv) throw new ApiError(404, 'Leave request not found')
  const to = ctx.body?.to
  if (!canTransition(LEAVE_MAP, lv.status, to)) throw new ApiError(400, `Invalid leave transition ${lv.status} → ${to}`)
  lv.status = to
  lv.reviewBy = ctx.user.id
  lv.reviewedAt = nowISO()
  addAudit(ctx, 'reviewed', 'leave request', lv.id, `Leave request → ${to}`, vendor.id)
  return lv
})

const LEAVE_MAP = { PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'], APPROVED: [], REJECTED: [], CANCELLED: [] }

/* ================= PROJECTS ================= */

on('GET', '/vendor/:vendorId/projects', (ctx) => {
  const result = vendorList(ctx, 'projects', { searchKeys: ['name', 'department'], sortDefault: 'createdAt' })
  const db = getDb()
  return {
    ...result,
    items: result.items.map((p) => ({
      ...p,
      teamMembers: (p.teamIds || []).map((id) => db.employees.find((e) => e.id === id)?.name).filter(Boolean),
    })),
  }
})

on('GET', '/vendor/:vendorId/projects/:projectId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const p = db.projects.find((x) => x.id === ctx.params.projectId && x.vendorId === ctx.params.vendorId)
  if (!p) throw new ApiError(404, 'Project not found')
  return {
    ...p,
    tasks: db.tasks.filter((t) => t.projectId === p.id).sort((a, b) => a.order - b.order),
    team: (p.teamIds || []).map((id) => db.employees.find((e) => e.id === id)),
  }
})

on('POST', '/vendor/:vendorId/projects', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.name) throw new ApiError(400, 'Project name is required')
  const prj = {
    id: `prj-${Date.now()}`,
    vendorId: vendor.id,
    name: b.name,
    description: b.description || '',
    department: b.department || 'Operations',
    status: b.status || 'PLANNING',
    budget: Number(b.budget) || 0,
    spent: 0,
    progress: 0,
    startDate: b.startDate || nowISO(),
    deadline: b.deadline || futureIn(90, 30),
    teamIds: b.teamIds || [],
    milestones: [],
    createdAt: nowISO(),
    activity: [],
  }
  db.projects.push(prj)
  return prj
})

on('PATCH', '/vendor/:vendorId/projects/:projectId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const p = db.projects.find((x) => x.id === ctx.params.projectId && x.vendorId === ctx.params.vendorId)
  if (!p) throw new ApiError(404, 'Project not found')
  ;['name', 'description', 'department', 'status', 'budget', 'spent', 'progress', 'deadline', 'teamIds'].forEach((k) => {
    if (ctx.body?.[k] !== undefined) p[k] = ctx.body[k]
  })
  return p
})

on('GET', '/vendor/:vendorId/tasks', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  let tasks = db.tasks.filter((t) => t.vendorId === vendor.id)
  if (ctx.query.projectId) tasks = tasks.filter((t) => t.projectId === ctx.query.projectId)
  if (ctx.query.status) tasks = tasks.filter((t) => t.status === ctx.query.status)
  return {
    items: tasks.map((t) => ({
      ...t,
      projectName: db.projects.find((p) => p.id === t.projectId)?.name,
      assigneeName: db.employees.find((e) => e.id === t.assigneeId)?.name,
    })),
    total: tasks.length,
  }
})

on('POST', '/vendor/:vendorId/tasks', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.title || !b.projectId) throw new ApiError(400, 'Task title and project are required')
  const task = {
    id: `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    vendorId: vendor.id,
    projectId: b.projectId,
    title: b.title,
    description: b.description || '',
    status: b.status || 'TODO',
    priority: b.priority || 'MEDIUM',
    assigneeId: b.assigneeId || null,
    dueDate: b.dueDate || futureIn(30, 1),
    order: db.tasks.filter((t) => t.projectId === b.projectId).length,
    createdAt: nowISO(),
    activity: [],
  }
  db.tasks.push(task)
  return task
})

on('PATCH', '/vendor/:vendorId/tasks/:taskId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const t = db.tasks.find((x) => x.id === ctx.params.taskId && x.vendorId === ctx.params.vendorId)
  if (!t) throw new ApiError(404, 'Task not found')
  ;['status', 'priority', 'assigneeId', 'dueDate', 'title', 'description', 'order'].forEach((k) => {
    if (ctx.body?.[k] !== undefined) t[k] = ctx.body[k]
  })
  return t
})

/* ================= CRM LEADS ================= */

on('GET', '/vendor/:vendorId/leads', (ctx) => {
  const db = getDb()
  const result = vendorList(ctx, 'leads', { searchKeys: ['name', 'company'], sortDefault: 'createdAt' })
  return {
    ...result,
    items: result.items.map((l) => ({
      ...l,
      assignedName: db.users.find((u) => u.id === l.assignedUser)?.name || 'Unassigned',
    })),
  }
})

on('GET', '/vendor/:vendorId/leads/pipeline', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const leads = db.leads.filter((l) => l.vendorId === vendor.id)
  const stageOrder = ['LEADS', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']
  return stageOrder.map((stage) => ({
    stage,
    leads: leads
      .filter((l) => l.stage === stage)
      .map((l) => ({ ...l, assignedName: db.users.find((u) => u.id === l.assignedUser)?.name || 'Unassigned' })),
  }))
})

on('POST', '/vendor/:vendorId/leads', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.name) throw new ApiError(400, 'Lead name is required')
  const lead = {
    id: `lead-${Date.now()}`,
    vendorId: vendor.id,
    name: b.name,
    company: b.company || null,
    email: b.email || '',
    phone: b.phone || '',
    stage: b.stage || 'LEADS',
    value: Number(b.value) || 0,
    assignedUser: b.assignedUser || null,
    source: b.source || 'WEBSITE',
    nextAction: b.nextAction || '',
    lastActivity: nowISO(),
    createdAt: nowISO(),
    activity: [],
  }
  db.leads.push(lead)
  return lead
})

on('PATCH', '/vendor/:vendorId/leads/:leadId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const lead = db.leads.find((x) => x.id === ctx.params.leadId && x.vendorId === ctx.params.vendorId)
  if (!lead) throw new ApiError(404, 'Lead not found')
  ;['name', 'company', 'email', 'phone', 'stage', 'value', 'assignedUser', 'source', 'nextAction'].forEach((k) => {
    if (ctx.body?.[k] !== undefined) lead[k] = ctx.body[k]
  })
  lead.lastActivity = nowISO()
  return lead
})

/* ================= TICKETS ================= */

on('GET', '/vendor/:vendorId/tickets', (ctx) => {
  const result = vendorList(ctx, 'tickets', { searchKeys: ['number', 'subject', 'customerName'], sortDefault: 'createdAt' })
  const db = getDb()
  return {
    ...result,
    items: result.items.map((t) => ({ ...t, assignedName: db.users.find((u) => u.id === t.assignedTo)?.name || 'Unassigned' })),
  }
})

on('GET', '/vendor/:vendorId/tickets/:ticketId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const t = db.tickets.find((x) => x.id === ctx.params.ticketId && x.vendorId === ctx.params.vendorId)
  if (!t) throw new ApiError(404, 'Ticket not found')
  return { ...t, customer: db.customers.find((c) => c.id === t.customerId), assignedName: db.users.find((u) => u.id === t.assignedTo)?.name }
})

on('POST', '/vendor/:vendorId/tickets', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const b = ctx.body || {}
  if (!b.subject || !b.customerId) throw new ApiError(400, 'Subject and customer are required')
  const tk = {
    id: `tk-${Date.now()}`,
    number: `TK-${1000 + db.tickets.length * 3 + 4}`,
    vendorId: vendor.id,
    subject: b.subject,
    customerId: b.customerId,
    customerName: b.customerName || '',
    priority: b.priority || 'MEDIUM',
    status: 'OPEN',
    source: b.source || 'WEB',
    assignedTo: b.assignedTo || null,
    createdBy: ctx.user.id,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    comments: [],
    activity: [{ id: `act-${Date.now()}`, type: 'TICKET_CREATED', title: 'Ticket created', at: nowISO(), by: ctx.user.name || 'You' }],
  }
  const customer = db.customers.find((c) => c.id === b.customerId)
  tk.customerName = customer?.company || `${customer?.firstName} ${customer?.lastName}`
  db.tickets.push(tk)
  return tk
})

on('PATCH', '/vendor/:vendorId/tickets/:ticketId', (ctx) => {
  const db = getDb()
  requireVendor(ctx, ctx.params.vendorId)
  const t = db.tickets.find((x) => x.id === ctx.params.ticketId && x.vendorId === ctx.params.vendorId)
  if (!t) throw new ApiError(404, 'Ticket not found')
  ;['priority', 'status', 'assignedTo'].forEach((k) => {
    if (ctx.body?.[k] !== undefined) t[k] = ctx.body[k]
  })
  t.updatedAt = nowISO()
  return t
})

on('POST', '/vendor/:vendorId/tickets/:ticketId/transition', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const t = db.tickets.find((x) => x.id === ctx.params.ticketId && x.vendorId === vendor.id)
  if (!t) throw new ApiError(404, 'Ticket not found')
  const to = ctx.body?.to
  if (!canTransition(TICKET_MAP, t.status, to)) throw new ApiError(400, `Invalid ticket transition ${t.status} → ${to}`)
  t.status = to
  t.updatedAt = nowISO()
  t.activity.unshift({ id: `act-${Date.now()}`, type: 'TICKET_STATUS', title: `Ticket status → ${to}`, at: nowISO(), by: ctx.user.name || 'You' })
  return t
})

const TICKET_MAP = {
  OPEN: ['IN_PROGRESS', 'WAITING', 'CLOSED'],
  IN_PROGRESS: ['WAITING', 'RESOLVED', 'CLOSED'],
  WAITING: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
}

on('POST', '/vendor/:vendorId/tickets/:ticketId/comments', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const t = db.tickets.find((x) => x.id === ctx.params.ticketId && x.vendorId === vendor.id)
  if (!t) throw new ApiError(404, 'Ticket not found')
  if (!ctx.body?.text) throw new ApiError(400, 'Comment text is required')
  t.comments.push({ id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, text: ctx.body.text, by: ctx.user.name || 'You', at: nowISO() })
  t.updatedAt = nowISO()
  t.activity.unshift({ id: `act-${Date.now()}`, type: 'COMMENT_ADDED', title: 'Comment added', at: nowISO(), by: ctx.user.name || 'You' })
  return t
})

/* ================= NOTIFICATIONS ================= */

on('GET', '/notifications', (ctx) => {
  const user = requireUser(ctx)
  const db = getDb()
  const list = db.notifications.filter((n) => !n.vendorId || n.vendorId === user.vendorId)
  const unread = list.filter((n) => !n.read).length
  return { items: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50), unread }
})

on('PATCH', '/notifications/:id/read', (ctx) => {
  const db = getDb()
  const n = db.notifications.find((x) => x.id === ctx.params.id)
  if (n) n.read = true
  return { ok: true }
})

on('POST', '/notifications/read-all', () => {
  getDb().notifications.forEach((n) => {
    n.read = true
  })
  return { ok: true }
})

/* ================= REPORTS ================= */

on('GET', '/vendor/:vendorId/reports/:reportType', (ctx) => {
  const db = getDb()
  const { vendor } = requireVendor(ctx, ctx.params.vendorId)
  const vid = vendor.id
  const range = dates(ctx)
  const inR = (d) => (range ? inRange(new Date(d.createdAt), range.from, range.to) : true)

  switch (ctx.params.reportType) {
    case 'sales': {
      const inv = db.invoices.filter((i) => i.vendorId === vid && inR(i))
      const total = inv.reduce((s, i) => s + i.total, 0)
      const collected = inv.reduce((s, i) => s + i.amountPaid, 0)
      const orders = db.orders.filter((o) => o.vendorId === vid && inR(o))
      return {
        summary: {
          totalSales: round2(total),
          collected: round2(collected),
          outstanding: round2(total - collected),
          invoiceCount: inv.length,
          orderCount: orders.length,
          averageOrder: round2(orders.length ? total / orders.length : 0),
        },
        series: monthSeries(8, (d) => {
          const m = inv.filter((i) => inMonth(new Date(i.createdAt), d))
          return { label: monthShort(d), revenue: round2(m.reduce((s, i) => s + i.total, 0)), collected: round2(m.reduce((s, i) => s + i.amountPaid, 0)) }
        }),
        items: [...inv].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200),
      }
    }
    case 'purchases': {
      const pos = db.purchaseOrders.filter((p) => p.vendorId === vid && inR(p))
      const items = [...pos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200).map((po) => ({
        ...po,
        total: round2(po.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0)),
      }))
      return {
        summary: {
          poCount: pos.length,
          totalOrdered: round2(items.reduce((s, x) => s + x.total, 0)),
          received: pos.filter((p) => p.status === 'RECEIVED').length,
          pending: pos.filter((p) => ['PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(p.status)).length,
        },
        items,
      }
    }
    case 'inventory': {
      const low = db.stock.filter((s) => s.vendorId === vid && s.available <= s.reorderLevel)
      const products = db.products.filter((p) => p.vendorId === vid).map(enrichProduct)
      return {
        summary: {
          totalSKUs: products.length,
          totalValue: round2(products.reduce((s, p) => s + p.inventoryValue, 0)),
          lowStock: low.length,
          outOfStock: products.filter((p) => p.available + p.incoming === 0).length,
        },
        items: products,
      }
    }
    case 'expenses': {
      const exps = db.expenses.filter((e) => e.vendorId === vid && e.status !== 'REJECTED' && inR(e))
      const byCategory = {}
      exps.forEach((e) => {
        byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
      })
      return {
        summary: {
          totalExpenses: round2(exps.reduce((s, e) => s + e.amount, 0)),
          count: exps.length,
          approved: exps.filter((e) => ['APPROVED', 'PROCESSED', 'PAID'].includes(e.status)).length,
          pending: exps.filter((e) => e.status === 'SUBMITTED').length,
        },
        byCategory: Object.entries(byCategory).map(([name, value]) => ({ name, value: round2(value) })),
        items: [...exps].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200),
      }
    }
    case 'customers': {
      const customers = db.customers.filter((c) => c.vendorId === vid).map(enrichCustomer)
      return {
        summary: {
          total: customers.length,
          active: customers.filter((c) => c.status === 'ACTIVE').length,
          outstanding: round2(customers.reduce((s, c) => s + c.outstanding, 0)),
          totalLifetime: round2(customers.reduce((s, c) => s + c.totalInvoiced, 0)),
        },
        items: customers.sort((a, b) => b.totalInvoiced - a.totalInvoiced).slice(0, 200),
      }
    }
    case 'suppliers':
      return {
        summary: { total: db.suppliers.filter((s) => s.vendorId === vid).length },
        items: db.suppliers.filter((s) => s.vendorId === vid).map(enrichSupplier),
      }
    case 'employees':
      return {
        summary: { total: db.employees.filter((e) => e.vendorId === vid).length },
        items: db.employees.filter((e) => e.vendorId === vid),
      }
    case 'financial':
    case 'tax': {
      const inv = db.invoices.filter((i) => i.vendorId === vid && inR(i))
      const tax = inv.reduce((s, i) => s + i.tax, 0)
      return {
        summary: { revenue: round2(inv.reduce((s, i) => s + i.total, 0)), taxCollected: round2(tax), invoiceCount: inv.length },
        items: [...inv].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 200),
      }
    }
    default:
      throw new ApiError(404, 'Unknown report type')
  }
})

/* ================= AUDIT ================= */

on('GET', '/audit-logs', (ctx) => {
  const db = getDb()
  const user = requireUser(ctx)
  let logs = [...db.auditLogs]
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_SUPPORT') {
    logs = logs.filter((l) => l.vendorId === user.vendorId)
  }
  if (ctx.query.search) {
    const t = String(ctx.query.search).toLowerCase()
    logs = logs.filter((l) => (l.detail || l.userName || l.action || '').toLowerCase().includes(t))
  }
  if (ctx.query.entity) logs = logs.filter((l) => l.entity === ctx.query.entity)
  logs = sortItems(logs, ctx.query, 'at')
  return paginate(logs, ctx.query)
})

/* ================= SEARCH ================= */

on('GET', '/search', (ctx) => {
  const db = getDb()
  const user = requireUser(ctx)
  const q = String(ctx.query.q || '').trim().toLowerCase()
  if (!q) return { query: '', results: {} }
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_SUPPORT'
  const byVendor = (vendorId) => (isAdmin ? true : vendorId === user.vendorId)
  const textMatch = (candidate) => String(candidate || '').toLowerCase().includes(q)

  const results = {
    customers: db.customers.filter((c) => byVendor(c.vendorId) && (textMatch(c.firstName) || textMatch(c.lastName) || textMatch(c.company) || textMatch(c.email))).slice(0, 5),
    providers: db.suppliers.filter((s) => byVendor(s.vendorId) && (textMatch(s.name) || textMatch(s.contactPerson))).slice(0, 5),
    employees: db.employees.filter((e) => byVendor(e.vendorId) && (textMatch(e.name) || textMatch(e.email) || textMatch(e.position))).slice(0, 5),
    products: db.products.filter((p) => byVendor(p.vendorId) && (textMatch(p.name) || textMatch(p.sku) || textMatch(p.brand))).slice(0, 5),
    orders: db.orders.filter((o) => byVendor(o.vendorId) && textMatch(o.number)).slice(0, 5),
    invoices: db.invoices.filter((i) => byVendor(i.vendorId) && (textMatch(i.number) || textMatch(i.customerName))).slice(0, 5),
    projects: db.projects.filter((pr) => byVendor(pr.vendorId) && textMatch(pr.name)).slice(0, 5),
    tickets: db.tickets.filter((t) => byVendor(t.vendorId) && (textMatch(t.number) || textMatch(t.subject))).slice(0, 5),
  }
  db.searches.unshift({ id: `sch-${Date.now()}`, term: q, at: nowISO() })
  return { query: ctx.query.q, results }
})

/* ================= misc date helpers ================= */

function rInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function futureIn(minDays, maxDays) {
  return futureDays(rInt(minDays, maxDays))
}

function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

function inMonth(date, ref) {
  return date.getFullYear() === ref.getFullYear() && date.getMonth() === ref.getMonth()
}

function inRange(date, from, to) {
  return date >= from && date <= to
}

function monthShort(d) {
  return new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d)
}

function monthSeries(n, fn) {
  const out = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(fn(d))
  }
  return out
}

function shortName(company) {
  const parts = String(company || '').split(' ')
  return parts.slice(0, 2).join(' ')
}

/* ================= public entry ================= */

export function resolveRequest(method, url, body = {}, headers = {}) {
  const [path, queryStr] = String(url).split('?')
  const query = {}
  if (queryStr) {
    new URLSearchParams(queryStr).forEach((v, k) => {
      query[k] = v
    })
  }
  return dispatch(method, path, query, body, headers)
}

export function isMockEnabled() {
  return !import.meta.env?.VITE_API_URL
}
