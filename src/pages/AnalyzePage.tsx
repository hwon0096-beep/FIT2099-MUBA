import { useEffect, useState } from 'react'
import PayoffShowcase from '../components/PayoffShowcase'
import { loadExplorerData, type ExplorerData } from '../lib/thetanuts'

export default function AnalyzePage() {
  const [data, setData] = useState<ExplorerData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { void loadExplorerData().then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load live analysis data.')) }, [])
  return <main className="app-shell">
    {error && <section className="notice error-notice" role="alert">{error}</section>}
    <PayoffShowcase orders={data?.orders} marketData={data?.marketData} />
  </main>
}
