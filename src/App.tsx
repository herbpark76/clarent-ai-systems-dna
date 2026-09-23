import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ArticlePage from './components/ArticlePage';
import ConceptPage from './components/ConceptPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/articles/:slug" element={<ArticlePage />} />
        <Route path="/concepts/:slug" element={<ConceptPage />} />
      </Routes>
    </BrowserRouter>
  );
}
