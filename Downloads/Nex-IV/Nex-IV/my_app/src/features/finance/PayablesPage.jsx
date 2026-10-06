import { useCurrentVendor } from '../../hooks/useCurrentVendor.js'
import { useGetPayablesQuery } from './api.js'
import { PageHeader, Card, StatCard } from '../../components/common/Card.jsx'
import { DataTable } from '../../components/common/DataTable.jsx'
import { Money } from '../../components/common/Money.jsx'
import { LoadingState } from '../../components/common/state/LoadingState.jsx'
import { ErrorState } from '../../components/common/state/ErrorState.jsx'
import { Link } from 'react-router-dom'
import { MdPayments } from 'react-icons/md'
import { PERMISSIONS as P } from '../../constants/roles.js'
import { PermissionGate } from '../../components/common/PermissionGate.jsx'

export function PayablesPage() {
  const vendorId = useCurrentVendor()
  const { data, isFetching, isError, error, refetch } = useGetPayablesQuery(vendorId, { skip: !vendorId })

  if (isFetching && !data) return <LoadingState label="Loading payables…" />
  if (isError) return <ErrorState message={error?.data?.message} onRetry={refetch} />

  const items = data.items || []
  const grand = items.reduce((s, x) => s + x.outstanding, 0)

  return (
    <PermissionGate permission={P.FINANCE_VIEW}>
      <div className="stack">
        <PageHeader title="Payables" subtitle="What you owe suppliers" icon={<MdPayments />} />
        <div className="grid-3">
          <StatCard label="Total ordered" value={<Money value={data.totalOrdered} />} />
          <StatCard label="Paid" value={<Money value={data.totalPaid} />} tone="success" />
          <StatCard label="Outstanding" value={<Money value={grand} />} tone="warning" />
        </div>
        <Card title="Supplier balances" padded={false}>
          <DataTable
            columns={[
              { key: 'supplierName', label: 'Supplier', render: (r) => <Link to={`/purchasing/suppliers/${r.supplierId}`}><strong>{r.supplierName}</strong></Link> },
              { key: 'totalOrdered', label: 'Ordered', align: 'right', render: (r) => <Money value={r.totalOrdered} /> },
              { key: 'paid', label: 'Paid', align: 'right', render: (r) => <Money value={r.paid} /> },
              { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => <Money value={r.outstanding} tone="danger" /> },
            ]}
            rows={items}
            rowKey="supplierId"
            loading={isFetching}
            error={isError ? error : null}
            onRetry={refetch}
            emptyTitle="No supplier balances"
          />
        </Card>
      </div>
    </PermissionGate>
  )
}

export default PayablesPage