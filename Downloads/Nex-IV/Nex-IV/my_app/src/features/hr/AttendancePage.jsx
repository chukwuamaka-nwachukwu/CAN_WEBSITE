import { useForm } from 'react-hook-form'
import { useGetAttendanceQuery, useCreateAttendanceMutation, useGetEmployeesQuery } from './api.js'
import { useCurrentVendor } from '../../hooks/useCurrentVendor.js'
import { useToast } from '../../hooks/useToast.js'
import { PageHeader, Card, StatCard } from '../../components/common/Card.jsx'
import { DataTable } from '../../components/common/DataTable.jsx'
import { Button } from '../../components/common/Button.jsx'
import { Field, Input, Select } from '../../components/form/Field.jsx'
import { Drawer } from '../../components/common/Drawer.jsx'
import { useModal } from '../../hooks/useModal.js'
import { Badge } from '../../components/common/Badge.jsx'
import { DateCell } from '../../components/common/DateCell.jsx'
import { MdChecklist } from 'react-icons/md'
import { PermissionGate } from '../../components/common/PermissionGate.jsx'
import { PERMISSIONS as P } from '../../constants/roles.js'

export function AttendancePage() {
  const vendorId = useCurrentVendor()
  const modal = useModal()
  const { data, isFetching, isError, error, refetch } = useGetAttendanceQuery(vendorId, { skip: !vendorId })
  const s = data?.summary || {}
  const rows = data?.items || []

  return (
    <PermissionGate permission={P.EMPLOYEE_VIEW}>
      <div className="stack">
        <PageHeader
          title="Attendance"
          subtitle="Who’s in today"
          icon={<MdChecklist />}
          actions={<Button onClick={() => modal.open(null)}>Record attendance</Button>}
        />
        <div className="grid-5">
          <StatCard label="Employees" value={s.employees || 0} />
          <StatCard label="Present" value={s.present || 0} tone="success" />
          <StatCard label="Late" value={s.late || 0} tone="warning" />
          <StatCard label="On leave" value={s.leave || 0} />
          <StatCard label="Absent" value={s.absent || 0} tone="danger" />
        </div>
        <Card padded={false}>
          <DataTable
            columns={[
              { key: 'employeeName', label: 'Employee', render: (r) => r.employeeName || '—' },
              { key: 'date', label: 'Date', sortable: true, render: (r) => <DateCell value={r.date} /> },
              { key: 'status', label: 'Status', render: (r) => <AttendanceBadge status={r.status} /> },
            ]}
            rows={rows}
            rowKey="id"
            loading={isFetching}
            error={isError ? error : null}
            onRetry={refetch}
            emptyTitle="No attendance records"
          />
        </Card>
        <Drawer open={modal.isOpen} onClose={modal.close} title="Record attendance" width={520}>
          {modal.isOpen && <AttendanceForm onDone={modal.close} />}
        </Drawer>
      </div>
    </PermissionGate>
  )
}

function AttendanceBadge({ status }) {
  const tone = status === 'PRESENT' ? 'success' : status === 'ABSENT' ? 'danger' : status === 'LATE' ? 'warning' : 'info'
  return <Badge tone={tone}>{status}</Badge>
}

function AttendanceForm({ onDone }) {
  const vendorId = useCurrentVendor()
  const [create, createState] = useCreateAttendanceMutation()
  const toast = useToast()
  const { data: employees } = useGetEmployeesQuery({ vendorId, params: { perPage: 200, status: 'ALL', q: '' } }, { skip: !vendorId })
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { date: new Date().toISOString().slice(0, 10), status: 'PRESENT' },
  })

  const onSubmit = async (values) => {
    try {
      await create({ vendorId, ...values }).unwrap()
      toast.success('Attendance recorded')
      onDone?.()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to record attendance')
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="Employee" required error={errors.employeeId?.message}>
        <Select invalid={!!errors.employeeId} {...register('employeeId', { required: 'Required' })}>
          <option value="">Select employee…</option>
          {(employees?.items || []).filter((e) => e.status === 'ACTIVE').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
      </Field>
      <div className="grid-2">
        <Field label="Date" required>
          <Input type="date" {...register('date', { required: 'Required' })} />
        </Field>
        <Field label="Status">
          <Select {...register('status')}>
            {['PRESENT', 'LATE', 'ABSENT', 'LEAVE'].map((st) => <option key={st} value={st}>{st}</option>)}
          </Select>
        </Field>
      </div>
      <footer className="form-footer">
        <Button variant="ghost" onClick={onDone} disabled={createState.isLoading}>Cancel</Button>
        <Button type="submit" loading={createState.isLoading}>Record</Button>
      </footer>
    </form>
  )
}

export default AttendancePage