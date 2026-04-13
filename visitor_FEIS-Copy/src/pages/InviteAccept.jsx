import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Spinner } from '../components/ui/Feedback'

/**
 * InviteAccept
 * ----------------------------------------------------------------------
 * Receives /invite/:token URLs from share links and redirects into the
 * visitor app with the invite query parameter. The actual resolution
 * (lookup, prefill, submit) happens in VisitorApp.
 */
export default function InviteAccept() {
  const { token } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (token) navigate(`/?invite=${encodeURIComponent(token)}`, { replace: true })
    else navigate('/', { replace: true })
  }, [token, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner />
    </div>
  )
}
