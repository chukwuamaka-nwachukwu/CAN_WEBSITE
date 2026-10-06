import { useCurrentVendor } from '../../hooks/useCurrentVendor.js'
import { useGetFinancialQuery } from './api.js'
import { PageHeader, Card, StatCard } from '../../components/common/Card.jsx'
import { LoadingState } from '../../components/common/state/LoadingState.jsx'
import { ErrorState } from '../../components/common/state/ErrorState.jsx'
import { Money } from '../../components/common/Money.jsx'
import { BarChart, LineChart } from '../../components/charts/Charts.jsx'
import { MdAccountBalanceWallet } from 'react-icons/md'
import { PERMISSIONS as P } from '../../constants/roles.js'
import { PermissionGate } from '../../components/common/PermissionGate.jsx'

export function FinanceOverviewPage() {
  const vendorId = useCurrentVendor()
  const { data, isFetching, isError, error, refetch } = useGetFinancialQuery(vendorId, { skip: !vendorId })

  if (isFetching && !data) return <LoadingState label="Loading financials…" />
  if (isError) return <ErrorState message={error?.data?.message} onRetry={refetch} />

  const s = data || {}
  const cash = (s.cashFlow || []).map((m) => ({ label: m.label, ...m }))
  const series = (s.series || []).map((m) => ({ label: m.label, ...m }))

  return (
    <PermissionGate permission={P.FINANCE_VIEW}>
      <div className="stack">
        <PageHeader title="Finance overview" subtitle="Revenue, expenses and cash position" icon={<MdAccountBalanceWallet />} />
        <div className="grid-4">
          <StatCard label="Revenue" value={<Money value={s.revenue} />} />
          <StatCard label="Collected" value={<Money value={s.collected} />} />
          <StatCard label="Expenses" value={<Money value={s.expenses} />} tone="danger" />
          <StatCard label="Net profit" value={<Money value={s.net} />} tone={s.net >= 0 ? 'success' : 'danger'} />
        </div>
        <div className="grid-2">
          <Card title="Revenue vs expenses">
            <BarChart
              data={series}
              xKey="label"
              series={[
                { key: 'revenue', name: 'Revenue', color: '#3b82f6' },
                { key: 'expenses', name: 'Expenses', color: '#ef4444' },
              ]}
              height={260}
            />
          </Card>
          <Card title="Cash flow (12 months)">
            <LineChart
              data={cash}
              xKey="label"
              series={[
                { key: 'inflow', name: 'Inflow', color: '#22c55e' },
                { key: 'outflow', name: 'Outflow', color: '#f59e0b' },
              ]}
              height={260}
            />
          </Card>
        </div>
        <div className="grid-3">
          <StatCard label="Outstanding invoices" value={<Money value={s.outstanding} />} />
          <StatCard label="Receivables" value={<Money value={s.receivables} />} />
          <StatCard label="Payables" value={<Money value={s.payables} />} tone="warning" />
        </div>
      </div>
    </PermissionGate>
  )
}

export default FinanceOverviewPage