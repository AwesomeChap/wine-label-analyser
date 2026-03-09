import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnalyzePage } from './pages/AnalyzePage';
import { HistoryPage } from './pages/HistoryPage';

function App() {
  const location = useLocation();
  const isAnalyze = location.pathname === '/';

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">
          Wine Label Analyser
        </Link>
        <nav>
          <Link to="/" className={isAnalyze ? 'active' : ''}>Analyse</Link>
          <Link to="/history" className={!isAnalyze ? 'active' : ''}>History</Link>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<AnalyzePage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
