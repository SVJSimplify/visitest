const rawAdmin    = import.meta.env.VITE_ADMIN_SLUG    || 'admin-login'
const rawSecurity = import.meta.env.VITE_SECURITY_SLUG || 'security-login'
const rawTeacher  = import.meta.env.VITE_TEACHER_SLUG  || 'teacher-login'

const clean = (s) => String(s).replace(/^\/+/, '').replace(/\/+$/, '')

export const ADMIN_LOGIN_SLUG    = clean(rawAdmin)
export const SECURITY_LOGIN_SLUG = clean(rawSecurity)
export const TEACHER_LOGIN_SLUG  = clean(rawTeacher)

export const ADMIN_LOGIN_PATH    = '/' + ADMIN_LOGIN_SLUG
export const SECURITY_LOGIN_PATH = '/' + SECURITY_LOGIN_SLUG
export const TEACHER_LOGIN_PATH  = '/' + TEACHER_LOGIN_SLUG
