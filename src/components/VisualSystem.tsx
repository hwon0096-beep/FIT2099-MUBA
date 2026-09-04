import type { ReactNode, SVGProps } from 'react'

type IconName = 'radar' | 'volume' | 'interest' | 'calendar' | 'board' | 'lens' | 'wallet' | 'shield' | 'spark' | 'arrow' | 'info' | 'bot' | 'contract' | 'trend'
type IconProps = SVGProps<SVGSVGElement> & { name: IconName; title?: string }

/** Compact, local NUTSCOPE glyphs. All icons share the same rounded 1.7px system stroke. */
export function NutIcon({ name, title, ...props }: IconProps) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<IconName, ReactNode> = {
    radar: <><circle cx="12" cy="12" r="8.2" /><circle cx="12" cy="12" r="3" /><path d="M12 3.8v3M20.2 12h-3M12 20.2v-3M3.8 12h3M14.2 9.8l4-4" /><path d="m15 8.8 3.2-3.2" opacity=".55" /></>,
    volume: <><path d="M4 18V9l4-3v12M10 18V5l4-2v15M16 18v-7l4-3v10" /><path d="M3 20.5h18" opacity=".6" /></>,
    interest: <><path d="M4 17.5 8.1 13l3.1 2.7L18.8 7" /><path d="M15.5 7h3.3v3.3" /><circle cx="5" cy="6" r="1.5" /><circle cx="11.5" cy="7.7" r="1.5" /></>,
    calendar: <><rect x="4" y="5.5" width="16" height="14" rx="2.5" /><path d="M7.5 3.5v4M16.5 3.5v4M4 9.5h16M8 13h2M14 13h2M8 16.5h2" /></>,
    board: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M7.5 8h9M7.5 12h5M7.5 16h7" /><circle cx="17" cy="12" r="1.2" /></>,
    lens: <><circle cx="10.4" cy="10.4" r="5.4" /><path d="m14.4 14.4 5.1 5.1M7.4 10.8l2-2 1.7 1.4 2.4-2.8" /><path d="M7.2 14h6.4" opacity=".55" /></>,
    wallet: <><path d="M4 7.2A2.2 2.2 0 0 1 6.2 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.2A2.2 2.2 0 0 1 4 16.8V7.2Z" /><path d="M4.5 8.5h13.8a1.7 1.7 0 0 1 1.7 1.7v3.6h-4.2a2 2 0 0 1 0-4H20" /><circle cx="16.1" cy="11.8" r=".7" fill="currentColor" stroke="none" /></>,
    shield: <><path d="M12 3.4 19 6v5.3c0 4.2-2.8 7.2-7 9.3-4.2-2.1-7-5.1-7-9.3V6l7-2.6Z" /><path d="m8.7 12.1 2.1 2.1 4.5-4.6" /></>,
    spark: <><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" /><path d="m18.3 16.6.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></>,
    arrow: <><path d="M4 12h15" /><path d="m14 7 5 5-5 5" /></>,
    info: <><circle cx="12" cy="12" r="8" /><path d="M12 10.6v4.8M12 7.6h.01" /></>,
    bot: <><rect x="5" y="6" width="14" height="12" rx="4" /><path d="M12 3.5v2M8.5 11h.01M15.5 11h.01M9 14.5c1.8 1.2 4.2 1.2 6 0" /><path d="M3.5 10v4M20.5 10v4" /></>,
    contract: <><path d="M7 3.5h7l3 3V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5v3h3M8.5 11h7M8.5 14.5h5M8.5 18h4" /></>,
    trend: <><path d="M4 18.5V5.5M4 18.5h16" /><path d="m6.5 15 3.3-3.6 2.8 1.9L18 7.5" /><path d="M15.5 7.5H18V10" /></>,
  }
  return <svg viewBox="0 0 24 24" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} {...props} {...common}>{title && <title>{title}</title>}{paths[name]}</svg>
}

export function ProductMark({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 48 48" aria-hidden="true"><path d="m24 3 18 10.5v21L24 45 6 34.5v-21L24 3Z" fill="url(#mark)" /><path d="m15 21 9-5 9 5-9 5-9-5Zm0 6 9 5 9-5" fill="none" stroke="#05313b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /><defs><linearGradient id="mark" x1="7" y1="4" x2="42" y2="44"><stop stopColor="#55f1d1" /><stop offset="1" stopColor="#129bc2" /></linearGradient></defs></svg> }

export function AnalyzeIllustration({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 150 125" aria-hidden="true"><defs><linearGradient id="glass" x1="40" y1="25" x2="111" y2="99"><stop stopColor="#54f1d5" /><stop offset="1" stopColor="#169bc4" /></linearGradient><filter id="softGlow"><feGaussianBlur stdDeviation="4" /></filter></defs><circle cx="87" cy="66" r="35" fill="#20dac4" opacity=".16" filter="url(#softGlow)" /><path d="M25 83V35a7 7 0 0 1 7-7h52a7 7 0 0 1 7 7v31a7 7 0 0 1-7 7H54" fill="#0c2938" stroke="#298a96" /><path d="M35 62 47 51l10 7 14-18 11 9" fill="none" stroke="#4aefd1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><path d="M36 72h39" stroke="#3c7782" strokeWidth="2" strokeLinecap="round" /><circle cx="88" cy="76" r="22" fill="#092433" stroke="url(#glass)" strokeWidth="5" /><path d="m104 92 18 18" stroke="#42e7cd" strokeWidth="7" strokeLinecap="round" /><circle cx="88" cy="76" r="12" fill="none" stroke="#2b9da7" strokeWidth="2" strokeDasharray="3 4" /></svg> }
