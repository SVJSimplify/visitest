/**
 * Route slugs for hidden admin and security login pages.
 *
 * These are read from environment variables so they don't appear in your
 * source code (or your GitHub repo). If a variable isn't set, a sensible
 * default is used.
 *
 * To set them:
 *   - Local dev:  add VITE_ADMIN_SLUG and VITE_SECURITY_SLUG to .env.local
 *   - Production: add them in Cloudflare Pages → Settings → Variables and
 *                 Secrets, then redeploy
 *
 * Example .env.local:
 *   VITE_ADMIN_SLUG=ggpog4
 *   VITE_SECURITY_SLUG=ggpog5
 *
 * The leading slash is added automatically; do NOT include it in the env var.
 *
 * IMPORTANT: changing these values requires a rebuild + redeploy. Vite bakes
 * env vars into the bundle at build time.
 */

const rawAdmin    = import.meta.env.VITE_ADMIN_SLUG || 'admin-login'
const rawSecurity = import.meta.env.VITE_SECURITY_SLUG || 'security-login'

// Strip any accidental leading slash so paths concatenate cleanly
const clean = (s) => String(s).replace(/^\/+/, '').replace(/\/+$/, '')

export const ADMIN_LOGIN_SLUG    = clean(rawAdmin)
export const SECURITY_LOGIN_SLUG = clean(rawSecurity)

export const ADMIN_LOGIN_PATH    = '/' + ADMIN_LOGIN_SLUG
export const SECURITY_LOGIN_PATH = '/' + SECURITY_LOGIN_SLUG
