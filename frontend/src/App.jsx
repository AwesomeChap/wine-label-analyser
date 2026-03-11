import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnalyzePage } from './pages/AnalyzePage';
import { HistoryPage } from './pages/HistoryPage';

function App() {
  const location = useLocation();
  const isAnalyze = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border bg-surface md:px-6 md:py-4 md:pl-[max(1rem,env(safe-area-inset-left))] md:pr-[max(1rem,env(safe-area-inset-right))]">
        <Link to="/" className="font-serif text-xl sm:text-2xl font-semibold text-[#f5f0eb] hover:text-accent hover:no-underline">
          Wine Label Analyser
        </Link>
        <nav className="flex gap-4 sm:gap-6">
          <Link
            to="/"
            className={`font-medium min-h-[44px] inline-flex items-center py-2 ${isAnalyze ? 'text-accent' : 'text-muted hover:text-accent'}`}
          >
            Analyse
          </Link>
          <Link
            to="/history"
            className={`font-medium min-h-[44px] inline-flex items-center py-2 ${!isAnalyze ? 'text-accent' : 'text-muted hover:text-accent'}`}
          >
            History
          </Link>
        </nav>
      </header>
      <main className="flex-1 w-full max-w-[900px] mx-auto px-4 py-8 sm:px-6 sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
        <Routes>
          <Route path="/" element={<AnalyzePage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
