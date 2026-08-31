import { BrowserRouter, Route, Routes } from 'react-router-dom'
import OptionsExplorer from './OptionsExplorer'
import FillFlow from './FillFlow'
import AppHeader from './components/AppHeader'
import DiscoverPage from './pages/DiscoverPage'
import AnalyzePage from './pages/AnalyzePage'
import PortfolioPage from './pages/PortfolioPage'
import { WalletProvider } from './lib/WalletContext'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <AppHeader />
        <Routes>
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/markets" element={<OptionsExplorer />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/trade" element={<FillFlow />} />
          <Route path="/fill" element={<FillFlow />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
        </Routes>
      </WalletProvider>
    </BrowserRouter>
  )
}
