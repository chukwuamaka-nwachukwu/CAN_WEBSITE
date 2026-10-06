/**
 * Seeded in-memory database for the Nex-IV mock API.
 * Data is realistic Nigerian business data, deterministically generated.
 * The collections mirror what a real backend would expose so the UI can be
 * switched to a live REST API without rewrites.
 */
/* eslint-disable no-unused-vars */

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NAMES = {
  first: [
    'Adaeze', 'Chinedu', 'Ngozi', 'Emeka', 'Aisha', 'Ibrahim', 'Femi', 'Chiamaka',
    'Tunde', 'Ifeoma', 'Yusuf', 'Blessing', 'Olawale', 'Kemi', 'Sekinat', 'Peter',
    'Gloria', 'Samuel', 'Halima', 'Bola', 'Chukwuemeka', 'Zainab', 'David', 'Amara',
    'Joseph', 'Funke', 'Musa', 'Chioma', 'Ladi', 'Nneka',
  ],
  last: [
    'Okafor', 'Balogun', 'Adeyemi', 'Eze', 'Mohammed', 'Adewale', 'Okoro', 'Osei',
    'Okonkwo', 'Uche', 'Abubakar', 'Nwosu', 'Olatunji', 'Igwe', 'Bello', 'Danjuma',
    'Akinwale', 'Adesina', 'Yakubu', 'Ogunleye', 'Nwachukwu', 'Suleiman', 'Obi',
    'Ekwueme', 'Afolabi', 'Lawal', 'Osuji', 'Daramola', 'Fadipe', 'Bassey',
  ],
}

const VENDOR_SEEDS = [
  {
    company: 'Prime Office Supplies',
    reg: 'RC-20190874',
    industry: 'Office Equipment',
    city: 'Lagos',
    plan: 'ENTERPRISE',
  },
  {
    company: 'ABC Technologies Ltd',
    reg: 'RC-20170542',
    industry: 'IT & Electronics',
    city: 'Abuja',
    plan: 'ENTERPRISE',
  },
  {
    company: 'Lagos Business Solutions',
    reg: 'RC-20201133',
    industry: 'Consulting & Services',
    city: 'Lagos',
    plan: 'PROFESSIONAL',
  },
  {
    company: 'Port Harcourt Industrial Services',
    reg: 'RC-20141028',
    industry: 'Industrial Equipment',
    city: 'Port Harcourt',
    plan: 'ENTERPRISE',
  },
  {
    company: 'Abuja Tech Distribution',
    reg: 'RC-20221296',
    industry: 'IT Distribution',
    city: 'Abuja',
    plan: 'PROFESSIONAL',
  },
  {
    company: 'Kano Agro Processing',
    reg: 'RC-20121577',
    industry: 'Agro & Food',
    city: 'Kano',
    plan: 'BASIC',
  },
  {
    company: 'Benin Retail Group',
    reg: 'RC-20241988',
    industry: 'Retail',
    city: 'Benin City',
    plan: 'BASIC',
  },
]

const DEPARTMENTS = [
  'Human Resources',
  'Finance',
  'Sales',
  'Marketing',
  'IT',
  'Operations',
  'Warehouse',
  'Customer Support',
]

const PRODUCT_TEMPLATES = {
  'IT & Electronics': [
    ['HP ProBook 450 G9 Laptop', 'Electronics', 720000, 905000, 15],
    ['Dell Latitude 5440', 'Electronics', 810000, 1010000, 12],
    ['Samsung 24" LED Monitor', 'Electronics', 145000, 185000, 20],
    ['Canon LaserJet M404dn', 'Electronics', 385000, 462000, 8],
    ['Logitech Wireless Keyboard', 'Electronics', 32000, 45000, 40],
    ['TP-Link 8-Port Switch', 'Electronics', 21000, 32000, 35],
  ],
  'Office Equipment': [
    ['A4 Copy Paper (5000 pk)', 'Office Supplies', 4500, 6200, 120],
    ['BIC Ballpoint Pen (box)', 'Office Supplies', 1800, 2800, 200],
    ['Filing Cabinet 4-Drawer', 'Office Supplies', 68000, 84000, 15],
    ['Office Chair Ergonomic', 'Office Supplies', 96000, 125000, 18],
    ['Executive Desk 6ft', 'Office Supplies', 175000, 216000, 10],
    ['Shredder Heavy Duty', 'Office Supplies', 52000, 68000, 12],
  ],
  'IT Distribution': [
    ['Intel Core i5 CPU', 'IT Hardware', 185000, 232000, 25],
    ['Corsair 16GB RAM Module', 'IT Hardware', 98000, 124000, 40],
    ['Western Digital 1TB SSD', 'IT Hardware', 112000, 138000, 45],
    ['NVIDIA RTX 4060 GPU', 'IT Hardware', 640000, 760000, 8],
    ['Asus B760 Motherboard', 'IT Hardware', 158000, 189000, 15],
    ['Cooler Master PSU 750W', 'IT Hardware', 82000, 104000, 20],
  ],
  'Industrial Equipment': [
    ['7.5kW Industrial Motor', 'Machinery', 1450000, 1720000, 5],
    ['Hydraulic Pump Set', 'Machinery', 980000, 1180000, 6],
    ['Conveyor Belt Roller', 'Machinery', 340000, 415000, 12],
    ['Safety Helmet (case)', 'Safety', 22000, 31500, 60],
    ['Welding Machine 200A', 'Machinery', 420000, 498000, 10],
    ['Compressor 30HP', 'Machinery', 2850000, 3240000, 3],
  ],
  'Consulting & Services': [
    ['Managed IT Services (mo)', 'Service', 350000, 450000, 0],
    ['Cloud Migration Package', 'Service', 900000, 1200000, 0],
    ['Annual Software Maintenance', 'Service', 250000, 340000, 0],
    ['Data Backup Solution', 'Service', 180000, 260000, 0],
    ['Cybersecurity Audit', 'Service', 600000, 780000, 0],
  ],
  'Agro & Food': [
    ['50kg Rice Bag (Grade A)', 'Agro', 42000, 52000, 200],
    ['1L Groundnut Oil (carton)', 'Agro', 21000, 27500, 150],
    ['Maize Grain (50kg)', 'Agro', 28000, 34000, 180],
    ['Garri (50kg)', 'Agro', 26000, 32500, 160],
    ['Dried Pepper (10kg)', 'Agro', 18500, 24000, 90],
  ],
  Retail: [
    ['Carton of Soap (pack)', 'Household', 5400, 7200, 150],
    ['Noddles Carton', 'Household', 9200, 11800, 200],
    ['Washing Powder 1kg', 'Household', 3400, 4600, 180],
    ['Vegetable Oil 5L', 'Household', 14500, 17800, 120],
    ['Toothpaste (carton)', 'Household', 8200, 10800, 140],
  ],
}

const SUPPLIER_COMPANIES = [
  'Tech Supplies Ltd',
  'Global Office Depot',
  'Allied Hardware & Tools',
  'Atlantic Distribution Co',
  'Nigerian Paper Mills',
  'Firstline IT Partners',
  'Metro Wholesale Ltd',
  'Haven Industrial Supply',
  'Summit Agro Traders',
  'Coastal Freight Supply',
]

/* ------------------ helpers to build entities ------------------ */

function rip() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

function rint(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

function rbool(rng, p = 0.5) {
  return rng() < p
}

function daysAgoISO(rng, maxDays, minDays = 0) {
  const d = new Date(Date.now() - rint(rng, minDays, maxDays) * 86400000)
  d.setHours(rint(rng, 8, 18), rint(rng, 0, 59))
  return d.toISOString()
}

function futureISO(rng, maxDays, minDays = 1) {
  const d = new Date(Date.now() + rint(rng, minDays, maxDays) * 86400000)
  d.setHours(rint(rng, 8, 18), rint(rng, 0, 59))
  return d.toISOString()
}

function fullName(rng) {
  return `${pick(rng, NAMES.first)} ${pick(rng, NAMES.last)}`
}

/* ------------------ actual DB builder ------------------ */

function buildDatabase() {
  const rng = mulberry32(20260514)
  const db = {
    vendors: [],
    users: [],
    customers: [],
    suppliers: [],
    categories: [],
    products: [],
    warehouses: [],
    stock: [],
    quotes: [],
    orders: [],
    invoices: [],
    payments: [],
    purchaseRequests: [],
    purchaseOrders: [],
    receipts: [],
    expenses: [],
    departments: [],
    employees: [],
    attendance: [],
    leave: [],
    projects: [],
    tasks: [],
    leads: [],
    tickets: [],
    notifications: [],
    auditLogs: [],
    searches: [],
    adjustments: [],
    transfers: [],
  }

  const now = Date.now()
  const domain = 'nexiv.app'

  /* ---------- Vendors ---------- */
  VENDOR_SEEDS.forEach((seed, i) => {
    const status = seed.status || (i === 0 || i === 1 ? 'ACTIVE' : i === 2 ? 'ACTIVE' : rbool(rng, 0.75) ? 'ACTIVE' : 'PENDING')
    const id = `v-${String(i + 1).padStart(2, '0')}`
    db.vendors.push({
      id,
      company: seed.company,
      registrationNumber: seed.reg,
      email: `info@${seed.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.ng`,
      phone: `+234 ${rint(rng, 700, 819)} ${rint(rng, 100, 999)} ${rint(rng, 1000, 9999)}`,
      address: `${rint(rng, 1, 120)} ${pick(rng, ['Allen Avenue', 'Admiralty Way', 'Karu Road', 'Trans Amadi', 'Ahmadu Bello Way', 'Aminu Kano Crescent'])} , ${seed.city}`,
      city: seed.city,
      industry: seed.industry,
      taxId: `TIN-${rint(rng, 100000, 999999)}-${rint(rng, 10, 99)}`,
      status,
      plan: seed.plan,
      logo: null,
      createdAt: daysAgoISO(rng, 900, 30),
      subscription: {
        startedAt: daysAgoISO(rng, 400, 30),
        renewal: futureISO(rng, 60, 15),
        monthlyFee: seed.plan === 'ENTERPRISE' ? 850000 : seed.plan === 'PROFESSIONAL' ? 450000 : 150000,
      },
      creditLimit: rint(rng, 2000000, 15000000),
    })
  })

  /* ---------- Users ---------- */
  let ui = 0
  const makeUser = (vendor, role, name, email, extra = {}) => ({
    id: `u-${vendor.id}-${String(++ui).padStart(3, '0')}`,
    vendorId: vendor.id,
    name,
    email,
    role,
    status: 'ACTIVE',
    phone: `+234 ${rint(rng, 700, 819)} ${rint(rng, 100, 999)} ${rint(rng, 1000, 9999)}`,
    lastLogin: daysAgoISO(rng, 15, 0),
    permissions: null,
    ...extra,
  })

  db.users.push(
    {
      id: 'u-super',
      vendorId: null,
      name: 'Adetokunbo Adewale',
      email: 'super@nexiv.app',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      phone: '+234 801 234 5678',
      lastLogin: daysAgoISO(rng, 1, 0),
      permissions: null,
    },
    {
      id: 'u-support',
      vendorId: null,
      name: 'Bisi Oyelaran',
      email: 'support@nexiv.app',
      role: 'PLATFORM_SUPPORT',
      status: 'ACTIVE',
      phone: '+234 802 334 6789',
      lastLogin: daysAgoISO(rng, 2, 0),
      permissions: null,
    }
  )

  const roleList = [
    'VENDOR_ADMIN',
    'SALES_MANAGER',
    'ACCOUNTANT',
    'INVENTORY_MANAGER',
    'HR_MANAGER',
    'SUPPORT_AGENT',
    'PURCHASING_MANAGER',
  ]

  db.vendors.forEach((vendor) => {
    roleList.forEach((role) => {
      const name = fullName(rng)
      const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${vendor.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.ng`
      db.users.push(makeUser(vendor, role, name, email))
    })
    // a few extra employees
    for (let e = 0; e < 3; e += 1) {
      const name = fullName(rng)
      db.users.push(
        makeUser(vendor, 'EMPLOYEE', name, `${name.toLowerCase().replace(/[^a-z]+/g, '.')}${e}@${vendor.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.ng`)
      )
    }
  })

  /* Well-known demo accounts (v-01 = Prime Office Supplies) */
  const demoAccounts = [
    ['Adegboye Adewale', 'admin@primeoffice.ng', 'VENDOR_ADMIN', 'v-01'],
    ['Chinwe Okafor', 'sales@primeoffice.ng', 'SALES_MANAGER', 'v-01'],
    ['Tajudeen Bello', 'accountant@primeoffice.ng', 'ACCOUNTANT', 'v-01'],
    ['Fatima Yusuf', 'inventory@primeoffice.ng', 'INVENTORY_MANAGER', 'v-01'],
    ['Efe Osei', 'hr@primeoffice.ng', 'HR_MANAGER', 'v-01'],
    ['Kolawole Ade', 'support@primeoffice.ng', 'SUPPORT_AGENT', 'v-01'],
  ]
  demoAccounts.forEach(([name, email, role, vendorId]) => {
    db.users.push({
      id: `u-demo-${role.toLowerCase()}`,
      vendorId,
      name,
      email,
      role,
      status: 'ACTIVE',
      phone: `+234 700 000 0000`,
      lastLogin: daysAgoISO(rng, 3, 0),
      permissions: null,
    })
  })

  /* login convenience map (email → password) — mock only, never shipped to prod */
  db.credentials = {}
  const visit = (email, pwd) => {
    db.credentials[email] = pwd
  }
  visit('super@nexiv.app', 'NeXiv-2026-Super#K')
  visit('support@nexiv.app', 'NeXiv-2026-Support#K')
  visit('admin@primeoffice.ng', 'NeXiv-2026-Admin#K')
  visit('sales@primeoffice.ng', 'NeXiv-2026-Sales#K')
  visit('accountant@primeoffice.ng', 'NeXiv-2026-Acct#K')
  visit('inventory@primeoffice.ng', 'NeXiv-2026-Inv#K')
  db.users.forEach((u) => {
    if (!db.credentials[u.email]) visit(u.email, 'NeXiv-2026-ChangeMe#K')
  })

  /* ---------- Departments (per vendor) ---------- */
  db.vendors.forEach((vendor) => {
    DEPARTMENTS.forEach((name, di) => {
      db.departments.push({
        id: `dep-${vendor.id}-${di + 1}`,
        vendorId: vendor.id,
        name,
        code: `DEP${String(di + 1).padStart(2, '0')}`,
        headId: null,
        description: `${name} department at ${vendor.company}`,
        employeeCount: 0,
      })
    })
  })

  /* ---------- Warehouses (per vendor) ---------- */
  const warehouseSeed = {
    'Prime Office Supplies': ['Lagos HQ', 'Ikeja Distribution'],
    'ABC Technologies Ltd': ['Abuja Central', 'Kubwa Depot'],
    'Lagos Business Solutions': ['Victoria Island'],
    'Port Harcourt Industrial Services': ['Trans Amadi Yard', 'Onne Depot'],
    'Abuja Tech Distribution': ['Utako Warehouse', 'Suleja Depot'],
    'Kano Agro Processing': ['Dawanau Warehouse'],
    'Benin Retail Group': ['Ring Road Store'],
  }
  db.vendors.forEach((vendor) => {
    const names = warehouseSeed[vendor.company] || ['Main Warehouse']
    names.forEach((wname, wi) => {
      db.warehouses.push({
        id: `wh-${vendor.id}-${wi + 1}`,
        vendorId: vendor.id,
        name: wname,
        code: `WH${String(wi + 1).padStart(2, '0')}`,
        city: vendor.city,
        isPrimary: wi === 0,
        createdAt: daysAgoISO(rng, 600, 30),
      })
    })
  })

  /* ---------- Categories + Products (per vendor) ---------- */
  db.vendors.forEach((vendor) => {
    const templates = PRODUCT_TEMPLATES[vendor.industry] || PRODUCT_TEMPLATES['Office Equipment']
    const catSet = new Set()
    templates.forEach((t) => catSet.add(t[1]))
    ;[...catSet].forEach((cname, ci) => {
      db.categories.push({
        id: `cat-${vendor.id}-${ci + 1}`,
        vendorId: vendor.id,
        name: cname,
        code: `CAT${String(ci + 1).padStart(2, '0')}`,
        productCount: 0,
      })
    })
    templates.forEach((t, ti) => {
      const [name, catName, cost, price, reorder] = t
      const isService = catName === 'Service'
      const id = `prod-${vendor.id}-${String(ti + 1).padStart(2, '0')}`
      db.products.push({
        id,
        vendorId: vendor.id,
        categoryId: `cat-${vendor.id}-${[...catSet].indexOf(catName) + 1}`,
        type: isService ? 'SERVICE' : 'PRODUCT',
        sku: `${vendor.company.slice(0, 3).toUpperCase()}-${isService ? 'SRV' : 'PRD'}-${String(ti + 1).padStart(3, '0')}`,
        name,
        description: `${name} supplied by ${vendor.company}`,
        brand: pick(rng, ['HP', 'Dell', 'Samsung', 'Canon', 'Logitech', 'Toshiba', 'Generic']),
        costPrice: cost,
        sellingPrice: price,
        taxRate: rbool(rng, 0.5) ? 7.5 : 5,
        reorderLevel: reorder,
        unit: 'pcs',
        status: rbool(rng, 0.9) ? 'ACTIVE' : 'INACTIVE',
        supplierIds: [],

        baseStock: {
          available: isService ? 0 : rint(rng, 3, 200),
          reserved: isService ? 0 : rint(rng, 0, 12),
          damaged: isService ? 0 : rint(rng, 0, 4),
          incoming: isService ? 0 : rint(rng, 0, 40),
        },
      })
    })
  })

  /* link suppliers to products and create suppliers per vendor */
  db.vendors.forEach((vendor, vi) => {
    const nSuppliers = 4 + rint(rng, 0, 4)
    for (let s = 0; s < nSuppliers; s += 1) {
      const company = `${pick(rng, ['Apex', 'Summit', 'Prime', 'Royal', 'Trans', 'Central'])} ${pick(rng, ['Supply', 'Trading', 'Distribution', 'Industries', 'Ventures', 'Enterprises'])} ${pick(rng, ['Nigeria', '& Sons', 'Ltd', 'Company'])}`
      const sid = `sup-${vendor.id}-${String(s + 1).padStart(2, '0')}`
      const contact = fullName(rng)
      db.suppliers.push({
        id: sid,
        vendorId: vendor.id,
        name: company,
        contactPerson: contact,
        email: `${contact.toLowerCase().replace(/[^a-z]+/g, '.')}@${company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
        phone: `+234 ${rint(rng, 700, 819)} ${rint(rng, 100, 999)} ${rint(rng, 1000, 9999)}`,
        address: `${rint(rng, 1, 80)} ${pick(rng, ['Trade Fair Complex', 'Apapa Road', 'Kano Road', 'Kaduna Road', 'Industrial Avenue'])} , ${vendor.city}`,
        paymentTerms: pick(rng, ['NET15', 'NET30', 'NET45', 'CASH']),
        paymentMethod: 'BANK_TRANSFER',
        status: rbool(rng, 0.85) ? 'ACTIVE' : 'INACTIVE',
        products: [],
      })
    }
    const vendorProducts = db.products.filter((p) => p.vendorId === vendor.id)
    db.suppliers
      .filter((s) => s.vendorId === vendor.id)
      .forEach((supplier, si) => {
        const linked = vendorProducts.filter((p, pi) => pi % nSuppliers === si).slice(0, 6)
        linked.forEach((p) => {
          p.supplierIds = p.supplierIds || []
          p.supplierIds.push(supplier.id)
          supplier.products.push(p.id)
        })
      })
  })

  /* ---------- Stock per warehouse ---------- */
  db.vendors.forEach((vendor) => {
    const whs = db.warehouses.filter((w) => w.vendorId === vendor.id)
    const products = db.products.filter((p) => p.vendorId === vendor.id && p.type === 'PRODUCT')
    products.forEach((p) => {
      const totalAvailable = p.baseStock.available
      whs.forEach((wh, wi) => {
        const share = whs.length === 1 ? totalAvailable : Math.round(totalAvailable * ((wi + 1) / (whs.length + 1)))
        db.stock.push({
          id: `stk-${p.id}-${wh.id}`,
          vendorId: vendor.id,
          productId: p.id,
          warehouseId: wh.id,
          available: share,
          reserved: wi === 0 ? p.baseStock.reserved : 0,
          damaged: wi === 0 ? p.baseStock.damaged : 0,
          incoming: wi === 0 ? p.baseStock.incoming : 0,
          reorderLevel: p.reorderLevel,
          unitCost: p.costPrice,
          updatedAt: daysAgoISO(rng, 20, 0),
          movements: [],
        })
      })
    })
  })

  /* simplified stock movements history on first stock row per product */
  db.stock.forEach((s, idx) => {
    if (s.warehouseId.includes('1')) {
      for (let m = 0; m < rint(rng, 2, 5); m += 1) {
        const qty = rint(rng, 2, 30)
        s.movements.push({
          id: `mvt-${idx}-${m}`,
          type: rbool(rng, 0.6) ? 'IN' : 'OUT',
          qty,
          reason: pick(rng, ['PURCHASE RECEIPT', 'SALE', 'TRANSFER', 'ADJUSTMENT', 'RETURN']),
          at: daysAgoISO(rng, 90, 0),
          userId: 'u-super',
        })
      }
    }
  })

  /* ---------- Customers (per vendor) ---------- */
  const customerCompanies = [
    'Greenfield Hotels',
    'Ubaka Motors',
    'Delta Chemical Co',
    'Eko Clinic',
    'Rainforest Farms',
    'Savanna Logistics',
    'Ivory Tower School',
    'Coastal Realty',
    'Niger Delta Energy',
    'Bright Path Insurance',
    'Oasis Pharmaceuticals',
    'Star Plaza Mall',
  ]
  db.vendors.forEach((vendor) => {
    const n = 12 + rint(rng, 0, 8)
    for (let c = 0; c < n; c += 1) {
      const company = c % 3 === 0 ? pick(rng, customerCompanies) : null
      const first = pick(rng, NAMES.first)
      const last = pick(rng, NAMES.last)
      const paid = rint(rng, 0, 9000000)
      const totalPurchases = paid + rint(rng, 0, 2500000)
      db.customers.push({
        id: `cst-${vendor.id}-${String(c + 1).padStart(3, '0')}`,
        vendorId: vendor.id,
        firstName: first,
        lastName: last,
        company: company || null,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@${(company || 'gmail').toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
        phone: `+234 ${rint(rng, 700, 819)} ${rint(rng, 100, 999)} ${rint(rng, 1000, 9999)}`,
        address: `${rint(rng, 1, 200)} ${pick(rng, ['Adewale Street', 'Broad Street', 'Marina Road', 'Obafemi Awolowo Way', 'Isaac John Street', 'Gwarinpa Estate'])} , ${vendor.city}`,
        creditLimit: rint(rng, 200000, 5000000),
        paymentTerms: pick(rng, ['NET15', 'NET30', 'NET45']),
        status: rbool(rng, 0.8) ? 'ACTIVE' : 'INACTIVE',
        createdAt: daysAgoISO(rng, 700, 30),
        totalPurchases,
        totalPaid: paid,
        outstanding: totalPurchases - paid,
        notes: [],
        activity: [
          {
            id: `act-c-${vendor.id}-${c}`,
            type: 'CUSTOMER_CREATED',
            title: 'Customer created',
            at: daysAgoISO(rng, 700, 30),
            by: 'System',
          },
        ],
      })
    }
  })

  /* ---------- Leads (per vendor, largest vendors get pipeline) ---------- */
  db.vendors.forEach((vendor) => {
    const active = vendor.status === 'ACTIVE'
    const n = active ? 12 + rint(rng, 0, 10) : 0
    for (let l = 0; l < n; l += 1) {
      const stage = pick(rng, ['LEADS', 'LEADS', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'])
      db.leads.push({
        id: `lead-${vendor.id}-${String(l + 1).padStart(3, '0')}`,
        vendorId: vendor.id,
        name: fullName(rng),
        company: rbool(rng, 0.7) ? `${pick(rng, ['Delta', 'Everest', 'Zenith', 'Orbit', 'Vantage'])} ${pick(rng, ['Energy', 'Global', 'Industries', 'Construct', 'Media'])}` : null,
        email: `${'lead'}${l}@example.ng`,
        phone: `+234 ${rint(rng, 700, 819)} ${rint(rng, 100, 999)} ${rint(rng, 1000, 9999)}`,
        stage,
        value: stage === 'WON' || stage === 'NEGOTIATION' ? rint(rng, 300000, 8000000) : rint(rng, 80000, 3500000),
        assignedUser: db.users.find((u) => u.vendorId === vendor.id && (u.role === 'SALES_MANAGER' || u.role === 'SALES_AGENT'))?.id || null,
        source: pick(rng, ['WEBSITE', 'REFERRAL', 'COLD_CALL', 'SOCIAL', 'EXHIBITION']),
        nextAction: pick(rng, ['Call to follow up', 'Send proposal', 'Schedule demo', 'Send pricing', 'Negotiate terms']),
        lastActivity: daysAgoISO(rng, 20, 0),
        createdAt: daysAgoISO(rng, 120, 10),
        activity: [],
      })
    }
  })

  /* ---------- Sales documents: quotes, orders, invoices, payments ---------- */
  db.vendors.forEach((vendor) => {
    if (vendor.status !== 'ACTIVE') return
    const customers = db.customers.filter((c) => c.vendorId === vendor.id)
    const products = db.products.filter((p) => p.vendorId === vendor.id)
    const users = db.users.filter((u) => u.vendorId === vendor.id)
    if (!customers.length || !products.length) return
    const nOrders = 30 + rint(rng, 0, 30)
    let invCounter = 10001
    let qCounter = 10001
    let oCounter = 10001
    let pCounter = 10001
    for (let o = 0; o < nOrders; o += 1) {
      const customer = pick(rng, customers)
      const created = daysAgoISO(rng, 210, 0)
      const lineCount = rint(rng, 1, 4)
      const lines = []
      for (let li = 0; li < lineCount; li += 1) {
        const p = pick(rng, products)
        const qty = rint(rng, 1, p.type === 'SERVICE' ? 12 : 30)
        lines.push({
          id: `li-${vendor.id}-${o}-${li}`,
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          quantity: qty,
          price: p.sellingPrice,
          taxRate: p.taxRate,
        })
      }
      const sortIdx = o
      const statusRoll = rng()
      const orderStatus = statusRoll < 0.2 ? 'DRAFT' : statusRoll < 0.45 ? 'CONFIRMED' : statusRoll < 0.7 ? 'RESERVED' : statusRoll < 0.92 ? 'FULFILLED' : 'CANCELLED'
      const orderDate = new Date(created)

      const quoteStatus =
        orderStatus === 'FULFILLED' || orderStatus === 'RESERVED'
          ? 'ACCEPTED'
          : orderStatus === 'CANCELLED'
            ? 'REJECTED'
            : pick(rng, ['DRAFT', 'SENT'])
      const discountType = rbool(rng, 0.15) ? 'PERCENT' : 'FIXED'
      const discountValue =
        discountType === 'PERCENT' ? (rbool(rng, 0.6) ? rint(rng, 2, 10) : 0) : rbool(rng, 0.6) ? 0 : rint(rng, 5000, 120000)
      const q = {
        id: `qt-${vendor.id}-${String(qCounter++)}`,
        number: `QUOTE-${String(qCounter).padStart(6, '0')}`,
        vendorId: vendor.id,
        customerId: customer.id,
        customerName: customer.company || `${customer.firstName} ${customer.lastName}`,
        lines,
        discountType,
        discountValue,
        taxRate: 7.5,
        status: quoteStatus,
        subtotal: 0,
        discount: 0,
        taxable: 0,
        tax: 0,
        total: 0,
        validUntil: futureISO(rng, 30, 7),
        createdAt: daysAgoISO(rng, 200, 0),
        issuedBy: pick(rng, users)?.id || null,
        activity: [],
      }
      const { subtotal, discount, taxable, tax, total } = computeTotals(q)
      Object.assign(q, { subtotal, discount, taxable, tax, total })
      q.activity = [
        {
          id: `act-q-${o}`,
          type: 'QUOTE_CREATED',
          title: 'Quote created',
          at: q.createdAt,
          by: pick(rng, users)?.name || 'System',
        },
      ]
      db.quotes.push(q)

      const order = {
        id: `ord-${vendor.id}-${String(oCounter++)}`,
        number: `SO-${String(oCounter).padStart(6, '0')}`,
        vendorId: vendor.id,
        customerId: customer.id,
        customerName: customer.company || `${customer.firstName} ${customer.lastName}`,
        quoteId: quoteStatus === 'ACCEPTED' ? q.id : null,
        lines: lines.map((l) => ({ ...l })),
        status: orderStatus,
        subtotal: q.subtotal,
        discount: q.discount,
        taxable: q.taxable,
        tax: q.tax,
        total: q.total,
        createdAt: orderDate.toISOString(),
        orderedAt: orderDate.toISOString(),
        expectedDelivery: futureISO(rng, 14, 3),
        issuedBy: pick(rng, users)?.id || null,
        payments: [],
        activity: [
          {
            id: `act-o-${o}`,
            type: 'ORDER_CREATED',
            title: 'Sales order created',
            at: orderDate.toISOString(),
            by: pick(rng, users)?.name || 'System',
          },
        ],
      }
      db.orders.push(order)

      /* invoice for fulfilled/reserved orders; some others too */
      const invoiceStatusRoll = rng()
      let invoiceStatus = 'DRAFT'
      if (orderStatus === 'FULFILLED' || orderStatus === 'RESERVED') {
        invoiceStatus = rbool(rng, 0.6)
          ? 'PAID'
          : rbool(rng, 0.6)
            ? 'PARTIALLY_PAID'
            : invoiceStatusRoll < 0.5
              ? 'SENT'
              : 'OVERDUE'
      } else if (orderStatus === 'CONFIRMED') {
        invoiceStatus = 'SENT'
      }
      if (invoiceStatus !== 'DRAFT') {
        const invoice = {
          id: `inv-${vendor.id}-${String(invCounter)}`,
          number: `INV-${String(invCounter++)}`,
          vendorId: vendor.id,
          customerId: customer.id,
          customerName: customer.company || `${customer.firstName} ${customer.lastName}`,
          orderId: order.id,
          lines: lines.map((l) => ({ ...l })),
          discountType: q.discountType,
          discountValue: q.discountValue,
          taxRate: q.taxRate,
          subtotal: q.subtotal,
          discount: q.discount,
          taxable: q.taxable,
          tax: q.tax,
          total: q.total,
          amountPaid: 0,
          status: invoiceStatus,
          dueDate: addDays(new Date(orderDate), rint(rng, 15, 45)).toISOString(),
          paymentTerms: customer.paymentTerms,
          issuedAt: orderDate.toISOString(),
          createdAt: orderDate.toISOString(),
          issuedBy: order.issuedBy,
          payments: [],
          activity: [
            {
              id: `act-i-${o}`,
              type: 'INVOICE_CREATED',
              title: 'Invoice generated',
              at: orderDate.toISOString(),
              by: pick(rng, users)?.name || 'System',
            },
          ],
        }
        /* create payments to reconcile amountPaid */
        let paid = 0
        const target =
          invoiceStatus === 'PAID' ? invoice.total : invoiceStatus === 'PARTIALLY_PAID' ? Math.round(invoice.total * (0.3 + rng() * 0.4)) : 0
        while (paid < target && paid < invoice.total) {
          const remaining = Math.round((Math.min(target, invoice.total) - paid) * 100) / 100
          const amount = Math.max(remaining, 1)
          const payment = {
            id: `pay-${vendor.id}-${String(pCounter++)}`,
            number: `PAY-${String(pCounter).padStart(6, '0')}`,
            vendorId: vendor.id,
            customerId: customer.id,
            customerName: invoice.customerName,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            amount,
            method: pick(rng, ['BANK_TRANSFER', 'CARD', 'CASH', 'POS']),
            reference: `TXN-${rip()}`,
            status: 'PAID',
            paidAt: daysAgoISO(rng, 20, 0),
            receivedBy: pick(rng, users)?.id || null,
            createdAt: daysAgoISO(rng, 20, 0),
          }
          invoice.payments.push(payment)
          invoice.activity.push({
            id: `act-p-${o}`,
            type: 'PAYMENT_RECEIVED',
            title: `Payment received ${formatNgn(payment.amount)}`,
            at: payment.createdAt,
            by: pick(rng, users)?.name || 'System',
          })
          db.payments.push(payment)
          paid += payment.amount
        }
        invoice.amountPaid = paid
        order.payments = [...invoice.payments]
        db.invoices.push(invoice)
      }
    }
  })

  /* ---------- Purchasing ---------- */
  db.vendors.forEach((vendor) => {
    if (vendor.status !== 'ACTIVE') return
    const suppliers = db.suppliers.filter((s) => s.vendorId === vendor.id)
    const products = db.products.filter((p) => p.vendorId === vendor.id)
    const users = db.users.filter((u) => u.vendorId === vendor.id)
    if (!suppliers.length) return
    const n = 14 + rint(rng, 0, 10)
    let prCounter = 10001
    let poCounter = 10001
    let grCounter = 10001
    for (let p = 0; p < n; p += 1) {
      const supplier = pick(rng, suppliers)
      const lines = []
      for (let li = 0; li < rint(rng, 1, 3); li += 1) {
        const prod = pick(rng, products)
        lines.push({
          id: `pl-${vendor.id}-${p}-${li}`,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantity: rint(rng, 5, 60),
          unitCost: prod.costPrice,
          receivedQty: 0,
        })
      }
      const pr = {
        id: `pr-${vendor.id}-${String(prCounter)}`,
        number: `PR-${String(prCounter++).padStart(6, '0')}`,
        vendorId: vendor.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        lines,
        requestedBy: pick(rng, users)?.id || null,
        department: pick(rng, ['Operations', 'IT', 'Warehouse', 'Sales']),
        status: pick(rng, ['PENDING_APPROVAL', 'APPROVED', 'CONVERTED', 'REJECTED', 'DRAFT']),
        note: pick(rng, ['Quarterly restock', 'Urgent replenishment', 'New product line', 'Warehouse stock-out']),
        createdAt: daysAgoISO(rng, 150, 0),
        activity: [],
      }
      db.purchaseRequests.push(pr)

      if (pr.status !== 'REJECTED' && pr.status !== 'DRAFT') {
        const poStatusRoll = rng()
        const poStatus =
          poStatusRoll < 0.15
            ? 'DRAFT'
            : poStatusRoll < 0.4
              ? 'APPROVED'
              : poStatusRoll < 0.6
                ? 'SENT'
                : poStatusRoll < 0.85
                  ? 'PARTIALLY_RECEIVED'
                  : 'RECEIVED'
        const po = {
          id: `po-${vendor.id}-${String(poCounter)}`,
          number: `PO-${String(poCounter++).padStart(6, '0')}`,
          vendorId: vendor.id,
          supplierId: supplier.id,
          supplierName: supplier.name,
          purchaseRequestId: pr.id,
          lines: lines.map((l) => ({ ...l, receivedQty: 0 })),
          status: poStatus,
          expectedDelivery: futureISO(rng, 20, 3),
          createdAt: daysAgoISO(rng, 120, 0),
          approvedBy: pick(rng, users)?.id || null,
          receivedAt: null,
          activity: [],
        }
        lines.forEach((l) => {
          po.lines.find((x) => x.id === l.id).receivedQty = poStatus === 'RECEIVED' || poStatus === 'PARTIALLY_RECEIVED' ? Math.round(l.quantity * (0.6 + rng() * 0.4)) : 0
        })
        db.purchaseOrders.push(po)

        if (poStatus !== 'DRAFT' && po.lines.some((l) => l.receivedQty > 0)) {
          db.receipts.push({
            id: `gr-${vendor.id}-${String(grCounter++)}`,
            number: `GRN-${String(grCounter).padStart(6, '0')}`,
            vendorId: vendor.id,
            purchaseOrderId: po.id,
            supplierId: supplier.id,
            supplierName: supplier.name,
            lines: po.lines
              .filter((l) => l.receivedQty > 0)
              .map((l) => ({ productId: l.productId, productName: l.productName, quantity: l.receivedQty, unitCost: l.unitCost })),
            status: 'POSTED',
            receivedAt: daysAgoISO(rng, 60, 0),
          })
        }
      }
    }
  })

  /* ---------- Expenses ---------- */
  db.vendors.forEach((vendor) => {
    if (vendor.status !== 'ACTIVE') return
    const users = db.users.filter((u) => u.vendorId === vendor.id)
    const categories = ['Transport', 'Office Supplies', 'Internet', 'Utilities', 'Marketing', 'Software', 'Rent', 'Maintenance']
    const n = 40 + rint(rng, 0, 15)
    let expCounter = 10001
    for (let e = 0; e < n; e += 1) {
      const status = pick(rng, ['SUBMITTED', 'APPROVED', 'PROCESSED', 'PAID', 'REJECTED', 'DRAFT'])
      db.expenses.push({
        id: `exp-${vendor.id}-${String(expCounter)}`,
        number: `EXP-${String(expCounter++).padStart(6, '0')}`,
        vendorId: vendor.id,
        category: pick(rng, categories),
        description: pick(rng, [
          'Staff transport for client visits',
          'Monthly office supplies restock',
          'Fiber internet subscription',
          'Electricity bill payment',
          'Social media campaign spend',
          'SaaS subscription renewal',
          'Warehouse rent installment',
          'Equipment maintenance service',
        ]),
        amount: rint(rng, 15000, 950000),
        paidTo: pick(rng, ['GTBank', 'MTN', 'Dangote Power', 'Facebook Ads', 'Google Workspace', 'Ikeja Electric', 'Maintenance Co']).toUpperCase(),
        paymentMethod: pick(rng, ['BANK_TRANSFER', 'CARD', 'CASH']),
        status,
        submittedBy: pick(rng, users)?.id || null,
        submittedAt: daysAgoISO(rng, 120, 0),
        approvedBy: null,
        approvedAt: null,
        paidAt: null,
        activity: [],
      })
    }
  })

  /* ---------- Employees ---------- */
  db.vendors.forEach((vendor) => {
    if (vendor.status !== 'ACTIVE') return
    const deps = db.departments.filter((d) => d.vendorId === vendor.id)
    const n = 26 + rint(rng, 0, 14)
    const positions = {
      'Human Resources': ['HR Officer', 'Recruiter'],
      Finance: ['Accountant', 'Financial Analyst', 'Payroll Officer'],
      Sales: ['Sales Executive', 'Sales Representative', 'Account Manager'],
      Marketing: ['Marketing Executive', 'Brand Manager'],
      IT: ['Software Engineer', 'Systems Admin', 'Helpdesk Analyst'],
      Operations: ['Operations Manager', 'Logistics Officer'],
      Warehouse: ['Store Keeper', 'Warehouse Assistant', 'Supervisor'],
      'Customer Support': ['Support Agent', 'Service Desk'],
    }
    for (let e = 0; e < n; e += 1) {
      const dep = pick(rng, deps)
      const name = fullName(rng)
      const empId = `EMP-${String(e + 1).padStart(4, '0')}`
      db.employees.push({
        id: `emp-${vendor.id}-${e + 1}`,
        vendorId: vendor.id,
        employeeId: empId,
        userId: db.users.find((u) => u.vendorId === vendor.id && !u.employeeId)?.id || null,
        name,
        email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${vendor.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.ng`,
        phone: `+234 ${rint(rng, 700, 819)} ${rint(rng, 100, 999)} ${rint(rng, 1000, 9999)}`,
        departmentId: dep.id,
        position: pick(rng, positions[dep.name] || ['Staff']),
        managerId: null,
        salary: rint(rng, 150000, 1200000),
        employmentDate: daysAgoISO(rng, 1400, 30),
        status: pick(rng, ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ON_LEAVE']),
        avatarColor: null,
        activity: [],
      })
    }
    /* link managers loosely */
    const emps = db.employees.filter((em) => em.vendorId === vendor.id)
    if (emps.length) {
      emps.forEach((em, idx) => {
        if (idx > 4) em.managerId = pick(rng, emps.slice(0, Math.min(5, emps.length)))?.id || null
      })
    }
  })

  /* ---------- Attendance ---------- */
  db.vendors.forEach((vendor) => {
    const emps = db.employees.filter((e) => e.vendorId === vendor.id)
    // last 14 days
    for (let d = 13; d >= 0; d -= 1) {
      const day = new Date(Date.now() - d * 86400000)
      if (day.getDay() === 0 || day.getDay() === 6) continue
      emps.forEach((em, idx) => {
        if (em.status === 'ACTIVE' && rng() > 0.15) {
          const roll = rng()
          const status = roll < 0.78 ? 'PRESENT' : roll < 0.88 ? 'LATE' : roll < 0.96 ? 'ABSENT' : 'LEAVE'
          db.attendance.push({
            id: `att-${em.id}-${d}`,
            vendorId: vendor.id,
            employeeId: em.id,
            date: day.toISOString().slice(0, 10),
            status,
            checkIn: status === 'PRESENT' || status === 'LATE' ? `${rint(rng, 7, 8)}:${rint(rng, 0, 59).toString().padStart(2, '0')}` : null,
            checkOut: status === 'PRESENT' || status === 'LATE' ? '17:30' : null,
            recordedBy: 'System',
          })
        }
      })
    }
    if (emps.length) {
      // today's attendance (partial)
      emps.forEach((em, idx) => {
        if (em.status === 'ACTIVE' && rng() > 0.2) {
          const roll = rng()
          const status = roll < 0.72 ? 'PRESENT' : roll < 0.85 ? 'LATE' : roll < 0.95 ? 'ABSENT' : 'LEAVE'
          db.attendance.push({
            id: `att-today-${em.id}`,
            vendorId: vendor.id,
            employeeId: em.id,
            date: new Date().toISOString().slice(0, 10),
            status,
            checkIn: status === 'PRESENT' || status === 'LATE' ? `${rint(rng, 7, 9)}:${rint(rng, 0, 59).toString().padStart(2, '0')}` : null,
            checkOut: null,
            recordedBy: 'System',
          })
        }
      })
    }
  })

  /* ---------- Leave ---------- */
  db.vendors.forEach((vendor) => {
    const emps = db.employees.filter((e) => e.vendorId === vendor.id)
    for (let l = 0; l < rint(rng, 6, 16); l += 1) {
      if (!emps.length) break
      const emp = pick(rng, emps)
      const start = daysAgoISO(rng, 40, 0).slice(0, 10)
      const days = rint(rng, 1, 21)
      const end = new Date(new Date(start).getTime() + days * 86400000).toISOString().slice(0, 10)
      db.leave.push({
        id: `lv-${vendor.id}-${l + 1}`,
        vendorId: vendor.id,
        employeeId: emp.id,
        employeeName: emp.name,
        type: pick(rng, ['ANNUAL', 'SICK', 'MATERNITY', 'EMERGENCY']),
        startDate: start,
        endDate: end,
        days,
        reason: pick(rng, ['Family event', 'Medical appointment', 'Personal reasons', 'Annual vacation', 'Rest and recuperation']),
        status: pick(rng, ['PENDING', 'APPROVED', 'APPROVED', 'REJECTED']),
        appliedAt: daysAgoISO(rng, 60, 0),
        reviewBy: null,
        reviewedAt: null,
        activity: [],
      })
    }
  })

  /* ---------- Projects ---------- */
  db.vendors.forEach((vendor) => {
    if (vendor.status !== 'ACTIVE') return
    const templates = [
      ['Website Redesign', 'Marketing', 6, 5000000],
      ['ERP Implementation', 'IT', 8, 12000000],
      ['Warehouse Automation', 'Warehouse', 5, 18000000],
      ['Staff Training Program', 'Human Resources', 3, 3000000],
      ['Mobile App MVP', 'IT', 7, 9000000],
      ['Rebranding Campaign', 'Marketing', 4, 4000000],
    ]
    templates.forEach(([title, dept, months, budget], pi) => {
      if (!rbool(rng, 0.8)) return
      const start = daysAgoISO(rng, months * 30, 10)
      const progress = rint(rng, 10, 100)
      const pid = `prj-${vendor.id}-${pi + 1}`
      db.projects.push({
        id: pid,
        vendorId: vendor.id,
        name: title,
        description: `${title} initiative for ${vendor.company}`,
        department: dept,
        status: progress >= 100 ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'PLANNING',
        budget,
        spent: Math.round(budget * (progress / 100)),
        progress,
        startDate: start,
        deadline: futureISO(rng, months * 30, 5),
        teamIds: [],
        createdAt: start,
        activity: [],
      })
      const team = db.employees.filter((e) => e.vendorId === vendor.id).slice(0, rint(rng, 2, 5)).map((e) => e.id)
      const prj = db.projects.find((p) => p.id === pid)
      prj.teamIds = team
      const taskNames = [
        'Requirements gathering',
        'Design system setup',
        'Core module build',
        'Integration testing',
        'Deployment preparation',
        'User acceptance testing',
        'Documentation',
        'Training sessions',
      ]
      taskNames.forEach((tn, ti) => {
        const roll = rng()
        const status = pi === 0 && ti < 5 ? (ti < 2 ? 'DONE' : ti < 4 ? 'IN_PROGRESS' : 'TODO') : roll < 0.45 ? 'DONE' : roll < 0.8 ? 'IN_PROGRESS' : 'TODO'
        db.tasks.push({
          id: `tsk-${pid}-${ti + 1}`,
          vendorId: vendor.id,
          projectId: pid,
          title: tn,
          description: `${tn} for ${prj.name}`,
          status,
          priority: pick(rng, ['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
          assigneeId: rbool(rng, 0.7) && team.length ? pick(rng, team) : null,
          dueDate: futureISO(rng, 40, 1),
          order: ti,
          createdAt: daysAgoISO(rng, months * 30, 10),
          activity: [],
        })
      })
      // milestones are embedded on the project after construction
    })
    /* dedicated milestones collection is replaced by activity; keep milestones embedded */
    db.projects.forEach((prj) => {
      if (!prj.milestones) {
        prj.milestones = [
          { id: `mil-${prj.id}-1`, title: 'Kickoff', status: 'COMPLETED', due: daysAgoISO(rng, 60, 5) },
          { id: `mil-${prj.id}-2`, title: 'Midway Review', status: prj.progress > 50 ? 'COMPLETED' : 'IN_PROGRESS', due: futureISO(rng, 30, 5) },
          { id: `mil-${prj.id}-3`, title: 'Delivery', status: prj.progress >= 100 ? 'COMPLETED' : 'PENDING', due: prj.deadline },
        ]
      }
    })
  })

  /* ---------- Tickets ---------- */
  db.vendors.forEach((vendor) => {
    if (vendor.status !== 'ACTIVE') return
    const customers = db.customers.filter((c) => c.vendorId === vendor.id)
    const users = db.users.filter((u) => u.vendorId === vendor.id && (u.role === 'SUPPORT_AGENT' || u.role === 'VENDOR_ADMIN'))
    const subjects = [
      'Unable to download invoice',
      'Payment not reflected on account',
      'Wrong product received',
      'Delay in delivery',
      'Request for price revision',
      'Login issue after password change',
      'Order status not updating',
      'Need copy of receipt',
      'Damaged goods received',
      'Credit limit increase request',
    ]
    for (let t = 0; t < 22; t += 1) {
      const customer = pick(rng, customers)
      const status = pick(rng, ['OPEN', 'IN_PROGRESS', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'])
      const tk = {
        id: `tk-${vendor.id}-${t + 1}`,
        number: `TK-${String(1040 + t)}`,
        vendorId: vendor.id,
        subject: pick(rng, subjects),
        customerId: customer.id,
        customerName: customer.company || `${customer.firstName} ${customer.lastName}`,
        priority: pick(rng, ['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
        status,
        source: pick(rng, ['EMAIL', 'PHONE', 'WEB', 'CHAT', 'CRM']),
        assignedTo: rbool(rng, 0.65) && users.length ? pick(rng, users).id : null,
        createdBy: pick(rng, users)?.id || null,
        createdAt: daysAgoISO(rng, 90, 0),
        updatedAt: daysAgoISO(rng, 20, 0),
        comments: [],
        activity: [],
      }
      const nComments = rint(rng, 0, 3)
      for (let cm = 0; cm < nComments; cm += 1) {
        tk.comments.push({
          id: `cm-${tk.id}-${cm}`,
          text: pick(rng, [
            'We are looking into this issue now.',
            'Can you share the transaction reference?',
            'This has been resolved on our end.',
            'I have escalated this to the relevant team.',
            'Please confirm your details so we can assist.',
            'We appreciate your patience while we investigate.',
          ]),
          by: pick(rng, users)?.name || 'System',
          at: daysAgoISO(rng, 10, 0),
        })
      }
      db.tickets.push(tk)
    }
  })

  /* ---------- Notifications ---------- */
  db.vendors.forEach((vendor) => {
    if (vendor.status !== 'ACTIVE') return
    const notifTemplates = [
      ['LOW_STOCK', 'Low stock alert', 'HP ProBook Laptop has fallen below its reorder level.'],
      ['INVOICE_OVERDUE', 'Invoice overdue', 'Invoice INV-10025 is 15 days overdue.'],
      ['LEAVE_REQUEST', 'Leave request', 'An employee submitted a leave request awaiting review.'],
      ['ORDER_CREATED', 'New sales order', 'A new sales order has been created and needs confirmation.'],
      ['PO_APPROVAL', 'Purchase order approval', 'A purchase order is awaiting your approval.'],
      ['PAYMENT_RECEIVED', 'Payment received', 'A payment was received and applied to an invoice.'],
      ['STOCK_TRANSFER', 'Stock transfer', 'A stock transfer is waiting to be received.'],
      ['TICKET_ASSIGNED', 'Ticket assigned', 'A support ticket has been assigned to you.'],
      ['SYSTEM', 'System maintenance', 'Scheduled maintenance is planned for the weekend.'],
    ]
    for (let nt = 0; nt < 14; nt += 1) {
      const [source, title, body] = pick(rng, notifTemplates)
      db.notifications.push({
        id: `nt-${vendor.id}-${nt + 1}`,
        vendorId: vendor.id,
        source,
        title,
        body,
        read: rbool(rng, 0.45),
        createdAt: daysAgoISO(rng, 30, 0),
        link: null,
      })
    }
  })

  /* ---------- Audit logs ---------- */
  const actionPool = [
    ['created', 'invoice', 'INV-10423'],
    ['updated', 'customer', 'ABC Ltd'],
    ['approved', 'purchase order', 'PO-204'],
    ['changed price of', 'product', 'HP Laptop'],
    ['suspended', 'vendor', 'Vendor B'],
    ['logged in', 'account', ''],
    ['exported', 'report', 'Sales Report'],
    ['created', 'quote', 'QUOTE-000112'],
    ['recorded payment for', 'invoice', 'INV-10398'],
    ['updated', 'employee record', 'John Doe'],
    ['resolved', 'ticket', 'TK-1044'],
    ['added stock adjustment', 'product', 'HP Laptop'],
  ]
  const allUsers = db.users
  for (let a = 0; a < 80; a += 1) {
    const user = pick(rng, allUsers)
    const [action, entity, ref] = pick(rng, actionPool)
    db.auditLogs.push({
      id: `aud-${a + 1}`,
      vendorId: user.vendorId || null,
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: `${action} ${entity}`,
      entity,
      entityId: ref,
      detail: `${user.name} ${action} ${entity} ${ref ? `#${ref}` : ''}`.trim(),
      ip: `197.210.${rint(rng, 0, 255)}.${rint(rng, 1, 254)}`,
      device: pick(rng, ['Chrome / Windows', 'Safari / macOS', 'Chrome / Android', 'Edge / Windows']),
      at: daysAgoISO(rng, 45, 0),
    })
  }
  db.auditLogs.sort((a, b) => new Date(b.at) - new Date(a.at))

  /* synthetic user search history */
  for (let s = 0; s < 10; s += 1) {
    db.searches.push({
      id: `sch-${s}`,
      term: pick(rng, ['invoice', 'laptop', 'project', 'customer', 'employee', 'ticket', 'quote']),
      at: daysAgoISO(rng, 14, 0),
    })
  }

  return db
}

/* ---------- shared helpers used by seed + handlers ---------- */

function computeTotals(doc) {
  let subtotal = 0
  doc.lines.forEach((l) => {
    subtotal += Math.round(Number(l.quantity) * Number(l.price) * 100)
  })
  subtotal = Math.round(subtotal) / 100
  const discount =
    doc.discountType === 'PERCENT'
      ? (subtotal * Number(doc.discountValue || 0)) / 100
      : Number(doc.discountValue || 0)
  const taxable = subtotal - discount
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    taxable: Math.round(taxable * 100) / 100,
    tax: Math.round((taxable * Number(doc.taxRate || 0)) / 100 * 100) / 100,
    total: Math.round((taxable + (taxable * Number(doc.taxRate || 0)) / 100) * 100) / 100,
  }
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatNgn(v) {
  return `₦${Number(v || 0).toLocaleString('en-NG')}`
}

/* module state — one shared mutable db for the life of the app */
let db = buildDatabase()

export function getDb() {
  return db
}

export function resetDb() {
  db = buildDatabase()
  return db
}

export { computeTotals, addDays, formatNgn, rint, pick, fullName, daysAgoISO, futureISO }