import { useMemo } from 'react'
import { useCurrentVendor } from '../../hooks/useCurrentVendor.js'
import { useGetReceivablesQuery } from './api.js'
import { PageHeader, Card, StatCard } from '../../components/common/Card.jsx'
import { DataTable } from '../../components/common/DataTable.jsx'
import { Money } from '../../components/common/Money.jsx'
import { DonutChart } from '../../components/charts/Charts.jsx'
import { Badge } from '../../components/common/Badge.jsx'
import { DateCell } from '../../components/common/DateCell.jsx'
import { LoadingState } from '../../components/common/state/LoadingState.jsx'
import { ErrorState } from '../../components/common/state/ErrorState.jsx'
import { useListParams } from '../../hooks/useListParams.js'
import { Link } from 'react-router-dom'
import { MdAccountBalanceWallet } from 'react-icons/md'
import { PERMISSIONS as P } from '../../constants/roles.js'
import { PermissionGate } from '../../components/common/PermissionGate.jsx'

export function ReceivablesPage() {
  const vendorId = useCurrentVendor()
  const list = useListParams({ perPage: 20, sortBy: 'dueDate' })
  const { data, isFetching, isError, error, refetch } = useGetReceivablesQuery(vendorId, { skip: !vendorId })

  const filtered = useLocalFilter(data, list)
  const rows = filtered.items
  const total = filtered.total

  if (isFetching && !data) return <LoadingState label="Loading receivables…" />
  if (isError) return <ErrorState message={error?.data?.message} onRetry={refetch} />

  const aging = data.agingByStatus
  const donut = [
    { name: 'Current', value: aging.current },
    { name: '1–30 days', value: aging.days30 },
    { name: '31–60 days', value: aging.days60 },
    { name: '61–90 days', value: aging.days90 },
    { name: '90+ days', value: aging.days90plus },
  ].filter((x) => x.value > 0)

  return (
    <PermissionGate permission={P.FINANCE_VIEW}>
      <div className="stack">
        <PageHeader title="Receivables" subtitle="What customers owe you" icon={<MdAccountBalanceWallet />} />
        <div className="grid-3">
          <StatCard label="Outstanding" value={<Money value={data.outstanding} />} />
          <StatCard label="Overdue" value={<Money value={data.overdue} />} tone="danger" />
          <StatCard label="Invoiced" value={<Money value={data.totalInvoiced} />} />
        </div>
        <div className="grid-2">
          <Card title="Outstanding by age">
            {donut.length ? <DonutChart data={donut} height={240} centerLabel={{ main: formatMoney(data.outstanding), sub: 'total' }} /> : <p className="muted">Nothing outstanding.</p>}
          </Card>
          <Card title="Invoice aging">
            <div className="aging-list">
              {[
                ['Current', aging.current],
                ['1–30 days', aging.days30],
                ['31–60 days', aging.days60],
                ['61–90 days', aging.days90],
                ['90+ days', aging.days90plus],
              ].map(([label, value]) => (
                <div key={label} className="aging-row">
                  <span>{label}</span>
                  <strong><Money value={value} /></strong>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card title="Invoices" padded={false}>
          <DataTable
            columns={[
              { key: 'invoiceNumber', label: 'Invoice', render: (r) => <Link to={`/sales/invoices/${r.invoiceId}`}><strong>{r.invoiceNumber}</strong></Link> },
              { key: 'customerName', label: 'Customer' },
              { key: 'dueDate', label: 'Due', render: (r) => <DateCell value={r.dueDate} /> },
              { key: 'age', label: 'Age', render: (r) => r.daysOverdue > 0 ? <Badge tone="danger">{r.daysOverdue}d overdue</Badge> : <Badge tone="success">Current</Badge> },
              { key: 'total', label: 'Total', align: 'right', render: (r) => <Money value={r.total} /> },
              { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => <Money value={r.outstanding} tone="danger" /> },
            ]}
            rows={rows}
            rowKey="invoiceId"
            loading={isFetching}
            error={isError ? error : null}
            onRetry={refetch}
            emptyTitle="No outstanding invoices"
            pagination={{
              page: list.page,
              totalPages: Math.ceil(total / list.perPage),
              total,
              perPage: list.perPage,
              onPerPageChange: (n) => { list.setPerPage(n); list.setPage(1) },
              onPageChange: list.setPage,
              sortKey: list.sortBy,
              sortDirection: list.sortDir.toLowerCase(),
              onSort: list.onSort,
              disabled: isFetching,
            }}
          />
        </Card>
      </div>
    </PermissionGate>
  )
}

function formatMoney(v) {
  return v == null ? '₦0' : Number(v).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })
}

function useLocalFilter(data, list) {
  return useMemo(() => {
    const items = (data?.items || []).filter((x) => {
      const q = list.search.toLowerCase()
      if (!q) return true
      return x.invoiceNumber.toLowerCase().includes(q) || x.customerName.toLowerCase().includes(q)
    })
    const sorted = [...items].sort((a, b) => {
      if (list.sortBy === 'outstanding') return list.sortDir === 'ASC' ? a.outstanding - b.outstanding : b.outstanding - a.outstanding
      return list.sortDir === 'ASC' ? String(a[list.sortBy] || '').localeCompare(String(b[list.sortBy] || '')) : String(b[list.sortBy] || '').localeCompare(String(a[list.sortBy] || ''))
    })
    const total = sorted.length
    const start = (list.page - 1) * list.perPage
    return { items: sorted.slice(start, start + list.perPage), total }
  }, [data, list])
}

export default ReceivablesPage