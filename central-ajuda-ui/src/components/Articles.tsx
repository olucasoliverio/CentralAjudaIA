import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api, type ArticleSummary } from '../api';

export function Articles() {
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleSummary | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchArticles = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listArticles(200, 0);
      setArticles(data);
    } catch (err: any) {
      setError(err?.message || 'Erro ao buscar artigos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setMessage('');
    try {
      const res = await api.syncArticles();
      setMessage(res.message || 'Sincronização iniciada');
      setTimeout(() => fetchArticles(), 2000);
    } catch {
      setMessage('Erro ao iniciar sincronização');
    } finally {
      setSyncing(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const openArticle = async (articleId: string) => {
    setSelectedId(articleId);
    setModalLoading(true);
    try {
      const res = await api.getArticle({ articleId });
      setSelectedArticle(res);
    } catch (err: any) {
      setError(err?.message || 'Erro ao abrir artigo');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedId(null);
    setSelectedArticle(null);
  };

  const truncate = (s?: string, n = 300) => {
    if (!s) return '';
    return s.length > n ? s.slice(0, n) + '...' : s;
  };

  return (
    <div className="animate-in">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Artigos</h1>
          <p>Lista de artigos presentes no banco de dados.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={fetchArticles} disabled={loading}>
            {loading ? 'Carregando...' : 'Atualizar Lista'}
          </button>
          <button className={`btn btn-sync ${syncing ? 'syncing' : ''}`} onClick={handleSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : 'Sincronizar Base'}
          </button>
        </div>
      </header>

      {message && <div className="status-ok" style={{ marginTop: 12 }}>{message}</div>}
      {error && <div className="status-error" style={{ marginTop: 12 }}>{error}</div>}

      <section style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!articles || articles.length === 0 ? (
          <div className="empty-state">Nenhum artigo encontrado.</div>
        ) : (
          articles.map(a => (
            <div key={a.id} className="panel" style={{ maxWidth: 900 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0 }}>{a.title}</h3>
                  <div style={{ color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>Updated: {new Date(a.updatedAt).toLocaleString()}</span>
                    <span>•</span>
                    <a
                      href={`https://sistemanextfit.freshdesk.com/support/solutions/articles/${a.freshdeskId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="link"
                    >
                      Freshdesk: {a.freshdeskId}
                    </a>
                    <span>•</span>
                    <span>{a.category || '-'}</span>
                    <span>•</span>
                    <span>{(a.tags || []).slice(0, 5).join(', ')}</span>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <ReactMarkdown>{truncate(a.description, 400)}</ReactMarkdown>
                  </div>
                </div>

                <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => openArticle(a.id)}>
                    Abrir
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      {selectedId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--bg)', padding: 20, borderRadius: 8, width: 'min(92%, 900px)', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0 }}>{selectedArticle?.title || (modalLoading ? 'Carregando...' : 'Artigo')}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  className="btn btn-ghost"
                  href={selectedArticle ? `https://sistemanextfit.freshdesk.com/support/solutions/articles/${selectedArticle.freshdeskId}` : '#'}
                  target="_blank" rel="noreferrer"
                >
                  Abrir no Freshdesk
                </a>
                <button className="btn btn-secondary" onClick={closeModal}>Fechar</button>
              </div>
            </div>

            <div style={{ marginTop: 12, color: 'var(--text-muted)' }}>
              <small>Atualizado: {selectedArticle ? new Date(selectedArticle.updatedAt).toLocaleString() : ''}</small>
            </div>

            <div style={{ marginTop: 16 }}>
              {modalLoading ? (
                <div>Carregando...</div>
              ) : (
                <ReactMarkdown>{selectedArticle?.description || ''}</ReactMarkdown>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
