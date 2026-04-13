import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Live-updating visitor list. Replaces the 5-second polling in the original
 * (issue #12). Uses Supabase Realtime for postgres changes.
 *
 * @param {object} opts
 * @param {Date}   opts.from   start of date filter
 * @param {Date}   opts.to     end of date filter
 * @param {string} opts.gate   optional gate filter
 * @param {string} opts.search optional search query
 */
export function useRealtimeVisitors({ from, to, gate, search }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    let q = supabase
      .from('visitors')
      .select('*')
      .order('id', { ascending: false })
      .limit(500)

    if (from) q = q.gte('created_at', from.toISOString())
    if (to)   q = q.lt('created_at', to.toISOString())
    if (gate) q = q.eq('gate', gate)

    const { data, error } = await q
    if (error) {
      setError(error)
      setLoading(false)
      return
    }

    let list = data || []
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (v) =>
          (v.name || '').toLowerCase().includes(s) ||
          (v.phone || '').includes(s) ||
          (v.purpose || '').toLowerCase().includes(s)
      )
    }
    setRows(list)
    setLoading(false)
  }, [from, to, gate, search])

  useEffect(() => {
    setLoading(true)
    load()

    // Bug 6 fix: unique channel name per mount so multiple subscribers
    // (e.g. dashboard table + sidebar count) don't collide.
    const channelName = `visitors-rt-${Math.random().toString(36).slice(2, 10)}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return { rows, loading, error, reload: load }
}
