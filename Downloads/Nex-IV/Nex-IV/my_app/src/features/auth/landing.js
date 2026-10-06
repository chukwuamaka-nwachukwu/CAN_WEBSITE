import { ROLES } from '../../constants/roles.js'

export const homeFor = (user) => {
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.PLATFORM_SUPPORT) return '/admin'
  if (user.role === 'EMPLOYEE') return '/me'
  return '/'
}

export function landingFor(user, from) {
  const home = homeFor(user)
  if (!from || from === '/login' || from === '/no-access') return home
  const isPlatform = user.role === ROLES.SUPER_ADMIN || user.role === ROLES.PLATFORM_SUPPORT
  const isEmployee = user.role === 'EMPLOYEE'
  if (isPlatform) return from === '/admin' || from.startsWith('/admin/') ? from : home
  if (isEmployee) return from === '/me' || from.startsWith('/me/') ? from : home
  if (from === '/admin' || from.startsWith('/admin/') || from === '/me' || from.startsWith('/me/')) return home
  return from
}