import { useState, useEffect } from 'react';
import './index.css';
import { ImpactAnalyzer } from './components/ImpactAnalyzer';
import { SemanticSearch } from './components/SemanticSearch';
import { ArticleGenerator } from './components/ArticleGenerator';
import { ArticleReviewer } from './components/ArticleReviewer';
import { Articles } from './components/Articles';
import { ColorPalette } from './components/ColorPalette';
import { Login } from './Login';

type Page = 'impact' | 'search' | 'generator' | 'reviewer' | 'articles';
type Theme = 'light' | 'dark';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    return saved || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));
  return { theme, toggle };
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('api-key'));
  const [currentPage, setCurrentPage] = useState<Page>('impact');
  const [colorPaletteOpen, setColorPaletteOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const handleAuthFailed = () => setIsAuthenticated(false);
    window.addEventListener('auth-failed', handleAuthFailed);
    return () => window.removeEventListener('auth-failed', handleAuthFailed);
  }, []);

  const handleLogin = (key: string) => {
    localStorage.setItem('api-key', key);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('api-key');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const navItems: { key: Page; label: string }[] = [
    { key: 'impact', label: 'Análise de Impacto' },
    { key: 'search', label: 'Busca Semântica' },
    { key: 'generator', label: 'Gerador de Artigos' },
    { key: 'reviewer', label: 'Revisor de Artigos' },
    { key: 'articles', label: 'Artigos' },
  ];

  return (
    <div className={`app-layout ${colorPaletteOpen ? 'palette-open' : ''}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>Olive Articles AI</h2>
          <p>Central de Ajuda</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${currentPage === item.key ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-divider" />
          <button className="btn btn-theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
          </button>
          <button className="btn btn-ghost" onClick={handleLogout} style={{ marginTop: '4px' }}>
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="main-inner">
          {currentPage === 'impact' && <ImpactAnalyzer onTogglePalette={() => setColorPaletteOpen(true)} />}
          {currentPage === 'search' && <SemanticSearch />}
          {currentPage === 'articles' && <Articles />}
          {currentPage === 'generator' && <ArticleGenerator onTogglePalette={() => setColorPaletteOpen(true)} />}
          {currentPage === 'reviewer' && <ArticleReviewer />}
        </div>
      </main>

      {/* Color Palette Sidebar */}
      <ColorPalette isOpen={colorPaletteOpen} onClose={() => setColorPaletteOpen(false)} />
    </div>
  );
}

export default App;