import { useState } from 'react'
import { useCurrentVendor } from '../../hooks/useCurrentVendor.js'
import { useGetReportQuery } from '../vendor/api.js'
import { PageHeader, Card, StatCard } from '../../components/common/Card.jsx'
import { DataTable } from '../../components/common/DataTable.jsx'
import { BarChart, DonutChart } from '../../components/charts/Charts.jsx'
import { Money } from '../../components/common/Money.jsx'
import { StatusPill } from '../../components/common/StatusPill.jsx'
import { LoadingState } from '../../components/common/state/LoadingState.jsx'
import { ErrorState } from '../../components/common/state/ErrorState.jsx'
import { Link } from 'react-router-dom'
import { MdAssessment } from 'react-icons/md'
import { PermissionGate } from '../../components/common/PermissionGate.jsx'
import { PERMISSIONS as P } from '../../constants/roles.js'

const REPORTS = [
  { key: 'sales', label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'employees', label: 'Employees' },
  { key: 'financial', label: 'Tax & Revenue' },
]

function reportColumns(reportType) {
  switch (reportType) {
    case 'sales':
      return [
        { key: 'number', label: 'Invoice', render: (r) => <Link to={`/sales/invoices/${r.id}`}><strong>{r.number}</strong></Link> },
        { key: 'customerName', label: 'Customer' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
        { key: 'total', label: 'Total', align: 'right', render: (r) => <Money value={r.total} /> },
      ]
    case 'purchases':
      return [
        { key: 'number', label: 'PO', render: (r) => <strong>{r.number}</strong> },
        { key: 'supplierName', label: 'Supplier' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
        { key: 'total', label: 'Total', align: 'right', render: (r) => <Money value={r.total} /> },
      ]
    case 'inventory':
      return [
        { key: 'sku', label: 'SKU', render: (r) => r.sku },
        { key: 'name', label: 'Product' },
        { key: 'available', label: 'Available', align: 'right' },
        { key: 'reorderLevel', label: 'Low at', align: 'right' },
      ]
    case 'expenses':
      return [
        { key: 'number', label: 'Expense', render: (r) => <strong>{r.number}</strong> },
        { key: 'category', label: 'Category' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
        { key: 'amount', label: 'Amount', align: 'right', render: (r) => <Money value={r.amount} /> },
      ]
    case 'customers':
      return [
        { key: 'firstName', label: 'Customer', render: (r) => <span>{r.company || `${r.firstName} ${r.lastName}`}</span> },
        { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
        { key: 'totalInvoiced', label: 'Lifetime', align: 'right', render: (r) => <Money value={r.totalInvoiced} /> },
        { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => <Money value={r.outstanding} /> },
      ]
    case 'suppliers':
      return [
        { key: 'name', label: 'Supplier', render: (r) => <strong>{r.name}</strong> },
        { key: 'contactPerson', label: 'Contact' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
      ]
    case 'employees':
      return [
        { key: 'employeeId', label: 'ID' },
        { key: 'name', label: 'Name', render: (r) => <strong>{r.name}</strong> },
        { key: 'position', label: 'Position' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
      ]
    case 'financial':
      return [
        { key: 'number', label: 'Invoice', render: (r) => <strong>{r.number}</strong> },
        { key: 'customerName', label: 'Customer' },
        { key: 'total', label: 'Total', align: 'right', render: (r) => <Money value={r.total} /> },
        { key: 'tax', label: 'VAT', align: 'right', render: (r) => <Money value={r.tax} /> },
      ]
    default:
      return []
  }
}

function summaryCards(reportType, data) {
  const s = data.summary || {}
  switch (reportType) {
    case 'sales':
      return [['Sales', s.totalSales], ['Collected', s.collected], ['Outstanding', s.outstanding, 'danger'], ['Orders', s.orderCount]]
    case 'purchases':
      return [['Purchase orders', s.poCount], ['Total ordered', s.totalOrdered], ['Received', s.received], ['Pending', s.pending, 'warning']]
    case 'inventory':
      return [['SKUs', s.totalSKUs], ['Value', s.totalValue], ['Low stock', s.lowStock, 'warning'], ['Out of stock', s.outOfStock, 'danger']]
    case 'expenses':
      return [['Total expenses', s.totalExpenses], ['Approved', s.approved], ['Pending', s.pending, 'warning'], ['Count', s.count]]
    case 'customers':
      return [['Customers', s.total], ['Active', s.active], ['Outstanding', s.outstanding, 'danger'], ['Lifetime', s.totalLifetime]]
    case 'suppliers':
      return [['Suppliers', s.total]]
    case 'employees':
      return [['Employees', s.total]]
    case 'financial':
      return [['Revenue', s.revenue], ['VAT collected', s.taxCollected], ['Invoices', s.invoiceCount]]
    default:
      return []
  }
}

export function ReportCenterPage() {
  const [reportType, setReportType] = useState('sales')
  const vendorId = useCurrentVendor()
  const { data, isFetching, isError, error, refetch } = useGetReportQuery({ vendorId, reportType }, { skip: !vendorId })

  const cards = summaryCards(reportType, data || {})
  const columns = reportColumns(reportType)
  const items = data?.items || []

  const chartData =
    reportType === 'expenses' ? (data?.byCategory || []) :
    reportType === 'sales' ? (data?.series || []).map((m) => ({ label: m.label, ...m })) : []

  return (
    <PermissionGate permission={P.REPORT_VIEW}>
      <div className="stack">
        <PageHeader title="Reports" subtitle="Analytics across your business" icon={<MdAssessment />} />
        <div className="report-tabs">
          {REPORTS.map((r) => (
            <button
              key={r.key}
              className={`tab-pill ${r.key === reportType ? 'tab-pill-active' : ''}`}
              onClick={() => setReportType(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {isFetching && !data ? <LoadingState label="Generating report…" /> : isError ? <ErrorState message={error?.data?.message} onRetry={refetch} /> : (
          <>
            <div className="grid-4">
              {cards.map(([label, value, tone]) => (
                <StatCard key={label} label={label} value={typeof value === 'number' && value > 1000 ? <Money value={value} /> : value ?? 0} tone={tone} />
              ))}
            </div>
            {(reportType === 'sales' || reportType === 'expenses') && (
              <Card title={reportType === 'sales' ? 'Revenue trend' : 'Expenses by category'}>
                {reportType === 'sales' ? (
                  <BarChart data={chartData} xKey="label" series={[{ key: 'revenue', name: 'Revenue', color: '#3b82f6' }, { key: 'collected', name: 'Collected', color: '#22c55e' }]} stacked height={240} />
                ) : (
                  <DonutChart data={chartData} height={240} />
                )}
              </Card>
            )}
            <Card title={`${REPORTS.find((r) => r.key === reportType)?.label} details`} padded={false}>
              <DataTable columns={columns} rows={items} rowKey="id" loading={isFetching} error={null} emptyTitle="No data for this report" />
            </Card>
          </>
        )}
      </div>
    </PermissionGate>
  )
}

export default ReportCenterPage