import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/common/Card.jsx'
import { Card, StatCard } from '../../components/common/Card.jsx'
import { Field, Input } from '../../components/form/Field.jsx'
import { Button } from '../../components/common/Button.jsx'
import { useGetDepartmentsQuery, useCreateDepartmentMutation, useGetEmployeesQuery } from './api.js'
import { useCurrentVendor } from '../../hooks/useCurrentVendor.js'
import { useToast } from '../../hooks/useToast.js'
import { LoadingState } from '../../components/common/state/LoadingState.jsx'
import { ErrorState } from '../../components/common/state/ErrorState.jsx'
import { Modal } from '../../components/common/Modal.jsx'
import { useModal } from '../../hooks/useModal.js'
import { MdOutlineBusinessCenter, MdPerson } from 'react-icons/md'
import { PermissionGate } from '../../components/common/PermissionGate.jsx'
import { PERMISSIONS as P } from '../../constants/roles.js'

export function DepartmentPage() {
  const vendorId = useCurrentVendor()
  const createModal = useModal()
  const navigate = useNavigate()
  const { data: departments, isFetching, isError, error, refetch } = useGetDepartmentsQuery(vendorId, { skip: !vendorId })
  const { data: employees } = useGetEmployeesQuery({ vendorId, params: { perPage: 200, status: 'ALL' } }, { skip: !vendorId })

  if (isFetching && !departments) return <LoadingState label="Loading departments…" />
  if (isError) return <ErrorState message={error?.data?.message} onRetry={refetch} />

  const emps = employees?.items || []
  const headName = (dep) => emps.find((e) => e.id === dep.headId)?.name

  return (
    <PermissionGate permission={P.EMPLOYEE_VIEW}>
      <div className="stack">
        <PageHeader
          title="Departments"
          subtitle="Org structure and headcount"
          icon={<MdOutlineBusinessCenter />}
          actions={<Button onClick={() => createModal.open(null)}>New department</Button>}
        />
        <div className="grid-4">
          <StatCard label="Departments" value={(departments || []).length} />
        </div>
        <div className="grid-3">
          {(departments || []).map((d) => (
            <Card key={d.id} title={d.name}>
              <div className="detail-grid">
                <div className="detail-item"><div className="detail-label">Code</div><div className="detail-value">{d.code}</div></div>
                <div className="detail-item"><div className="detail-label">Head</div><div className="detail-value">{headName(d) || '—'}</div></div>
                <div className="detail-item"><div className="detail-label">Employees</div><div className="detail-value">{d.employeeCount}</div></div>
                <div className="detail-item"><div className="detail-label">Description</div><div className="detail-value">{d.description || '—'}</div></div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/hr/employees?department=${d.id}`)}
              >
                <MdPerson /> View team
              </Button>
            </Card>
          ))}
        </div>
        <Modal open={createModal.isOpen} onClose={createModal.close} title="New department" size="sm">
          {createModal.isOpen && <DepartmentForm onDone={createModal.close} />}
        </Modal>
      </div>
    </PermissionGate>
  )
}

function DepartmentForm({ onDone }) {
  const vendorId = useCurrentVendor()
  const [create, createState] = useCreateDepartmentMutation()
  const toast = useToast()
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (values) => {
    try {
      await create({ vendorId, ...values }).unwrap()
      toast.success('Department created')
      onDone?.()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create department')
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="Name" required error={errors.name?.message}>
        <Input invalid={!!errors.name} {...register('name', { required: 'Required' })} />
      </Field>
      <Field label="Code">
        <Input {...register('code')} placeholder="Optional (auto-generated)" />
      </Field>
      <Field label="Description">
        <Input {...register('description')} />
      </Field>
      <footer className="modal-footer">
        <Button variant="ghost" onClick={onDone} disabled={createState.isLoading}>Cancel</Button>
        <Button type="submit" loading={createState.isLoading}>Create</Button>
      </footer>
    </form>
  )
}

export default DepartmentPage