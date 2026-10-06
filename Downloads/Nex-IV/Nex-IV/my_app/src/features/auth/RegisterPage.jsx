/* eslint-disable react-hooks/incompatible-library */
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useRegisterMutation } from './api.js'
import { Button } from '../../components/common/Button.jsx'
import { Field, Input, Select, Checkbox } from '../../components/form/Field.jsx'
import { useToast } from '../../hooks/useToast.js'
import { MdAppRegistration } from 'react-icons/md'

export function RegisterPage() {
  const [register, { isLoading }] = useRegisterMutation()
  const navigate = useNavigate()
  const toast = useToast()

  const {
    register: r,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      industry: 'General',
      plan: 'GROWTH',
      agree: false,
    },
  })

  const password = watch('password')

  const onSubmit = async (values) => {
    try {
      await register({
        name: values.name,
        email: values.email,
        password: values.password,
        company: { name: values.companyName, industry: values.industry, plan: values.plan },
      }).unwrap()
      toast.success('Your workspace has been created. Sign in to continue.')
      navigate('/login')
    } catch (err) {
      toast.error(err?.data?.message || 'Unable to create the account', 'Registration failed')
    }
  }

  return (
    <div className="auth-card">
      <header className="auth-card-header">
        <h1>Create your workspace</h1>
        <p className="muted">Start a new Nex-IV customer account</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-form">
        <div className="form-grid-2">
          <Field label="Your name" required error={errors.name?.message}>
            <Input placeholder="Jane Doe" invalid={!!errors.name} {...r('name', { required: 'Name is required' })} />
          </Field>
          <Field label="Work email" required error={errors.email?.message}>
            <Input
              type="email"
              placeholder="jane@company.com"
              invalid={!!errors.email}
              {...r('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
              })}
            />
          </Field>
        </div>

        <div className="form-grid-2">
          <Field label="Password" required error={errors.password?.message}>
            <Input
              type="password"
              invalid={!!errors.password}
              {...r('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'At least 8 characters' },
              })}
            />
          </Field>
          <Field label="Confirm password" required error={errors.confirmPassword?.message}>
            <Input
              type="password"
              invalid={!!errors.confirmPassword}
              {...r('confirmPassword', {
                validate: (v) => v === password || 'Passwords do not match',
              })}
            />
          </Field>
        </div>

        <Field label="Company name" required error={errors.companyName?.message}>
          <Input
            placeholder="Prime Office Supplies Ltd"
            invalid={!!errors.companyName}
            {...r('companyName', { required: 'Company name is required' })}
          />
        </Field>

        <div className="form-grid-2">
          <Field label="Industry">
            <Select {...r('industry')}>
              {['General', 'Office Equipment', 'Retail', 'Manufacturing', 'Construction', 'Technology', 'Healthcare', 'Education'].map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plan">
            <Select {...r('plan')}>
              <option value="GROWTH">Growth</option>
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </Select>
          </Field>
        </div>

        <Field error={errors.agree?.message}>
          <Checkbox
            label="I agree to the terms of service and privacy policy"
            invalid={!!errors.agree}
            {...r('agree', { required: 'You must agree to continue' })}
          />
        </Field>

        <Button type="submit" loading={isLoading} size="lg" block>
          {!isLoading && <MdAppRegistration />} Create account
        </Button>
      </form>
    </div>
  )
}

export default RegisterPage