import { useEffect, useState } from 'react';
import { api, type ArticleSummary } from '../api';

export function Articles() {
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

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
      // opcional: atualizar lista após breve espera
      setTimeout(() => fetchArticles(), 2000);
    } catch {
      setMessage('Erro ao iniciar sincronização');
    } finally {
      setSyncing(false);
      setTimeout(() => setMessage(''), 4000);
    }
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

      <section style={{ marginTop: 16 }}>
        {!articles || articles.length === 0 ? (
          <div className="empty-state">Nenhum artigo encontrado.</div>
        ) : (
          <div className="panel">
            <table className="table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>ID</th>
                  <th>Freshdesk ID</th>
                  <th>Categoria</th>
                  <th>Tags</th>
                  <th>Atualizado Em</th>
                </tr>
              </thead>
              <tbody>
                {articles.map(a => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td style={{ fontFamily: 'monospace' }}>{a.id.slice(0, 8)}...</td>
                    <td>{a.freshdeskId}</td>
                    <td>{a.category || '-'}</td>
                    <td>{(a.tags || []).join(', ')}</td>
                    <td>{new Date(a.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
