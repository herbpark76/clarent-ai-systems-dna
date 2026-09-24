import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ArticlePage from './components/ArticlePage';
import ConceptPage from './components/ConceptPage';
import AdminSignalDesk from './pages/AdminSignalDesk';
import SignalDeskPage from './pages/SignalDeskPage';
import LabsPage from './pages/LabsPage';
import UseCasesPage from './pages/UseCasesPage';
import ModelsPage from './pages/ModelsPage';
import RiskPage from './pages/RiskPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/articles/:slug" element={<ArticlePage />} />
        <Route path="/concepts/:slug" element={<ConceptPage />} />
        <Route path="/admin/signal-desk" element={<AdminSignalDesk />} />
        <Route path="/signal-desk" element={<SignalDeskPage />} />
        <Route path="/labs" element={<LabsPage />} />
        <Route path="/use-cases" element={<UseCasesPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/risk" element={<RiskPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
