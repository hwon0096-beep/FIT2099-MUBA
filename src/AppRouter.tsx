import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import OptionsExplorer from './OptionsExplorer'
import FillFlow from './FillFlow'

const styles: { bar: React.CSSProperties; link: React.CSSProperties; activeLink: React.CSSProperties } = {
  bar: { display: 'flex', gap: 20, padding: '12px 24px', borderBottom: '1px solid #333' },
  link: { color: 'inherit', opacity: 0.7, textDecoration: 'none' },
  activeLink: { color: 'inherit', opacity: 1, textDecoration: 'underline', fontWeight: 600 },
}

function Nav() {
  const linkStyle = ({ isActive }: { isActive: boolean }) => (isActive ? styles.activeLink : styles.link)
  return (
    <nav style={styles.bar}>
      <NavLink to="/" end style={linkStyle}>Options Explorer</NavLink>
      <NavLink to="/fill" style={linkStyle}>Fill Order</NavLink>
    </nav>
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<OptionsExplorer />} />
        <Route path="/fill" element={<FillFlow />} />
      </Routes>
    </BrowserRouter>
  )
}
