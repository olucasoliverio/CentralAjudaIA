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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const fetchArticles = async (p = page, size = pageSize, s = search) => {
    setError('');

    const cacheKey = (pageNum: number, pageSz: number, q?: string) => `articles_cache:${pageNum}:${pageSz}:${q || ''}`;

    const key = cacheKey(p, size, s);
    const cachedRaw = localStorage.getItem(key);
    let hadCache = false;

    if (cachedRaw) {
      try {
        const parsed = JSON.parse(cachedRaw) as { items: ArticleSummary[]; total: number; ts?: number };
        setArticles(parsed.items);
        setTotal(parsed.total);
        setPage(p);
        setPageSize(size);
        hadCache = true;
      } catch {
        // ignore parse errors
      }
    } else {
      setLoading(true);
    }

    try {
      const offset = (p - 1) * size;
      const res = await api.listArticles(size, offset, s || undefined);

      // strip description from items to avoid showing/storing full article body in list cache
      const itemsStripped = res.items.map(({ description, ...rest }) => rest as ArticleSummary);

      const prevJson = cachedRaw || '';
      const newJson = JSON.stringify({ items: itemsStripped, total: res.total });
      if (newJson !== prevJson) {
        localStorage.setItem(key, newJson);
        setArticles(itemsStripped);
        setTotal(res.total);
      }

      setPage(p);
      setPageSize(size);
    } catch (err: any) {
      if (!hadCache) setError(err?.message || 'Erro ao buscar artigos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles(1, pageSize, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // truncate/strip helpers removed — description column no longer shown in list

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    fetchArticles(newPage, pageSize, search);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    fetchArticles(1, newSize, search);
  };

  const handleSearchSubmit = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    fetchArticles(1, pageSize, search);
  };

  return (
    <div className="animate-in">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Artigos</h1>
          <p>Lista de artigos presentes no banco de dados.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => fetchArticles()} disabled={loading}>
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
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            gap: 8,
            margin: '0 auto 12px',
            alignItems: 'center',
            width: '100%',
            maxWidth: 1100,
          }}
        >
          <input
            placeholder="Pesquisar por título ou ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 200,
              padding: '8px 10px',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 8,
              background: 'var(--bg-input, #fff)'
            }}
          />
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            style={{ width: 100, padding: '8px 6px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, background: 'var(--bg-input, #fff)' }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button className="btn btn-primary" type="button" onClick={() => handleSearchSubmit()} disabled={loading} style={{ minWidth: 90, borderRadius: 8 }}>
            Buscar
          </button>
        </form>

        {!articles || articles.length === 0 ? (
          <div className="empty-state">Nenhum artigo encontrado.</div>
        ) : (
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', maxWidth: '1200px', tableLayout: 'center' }}>
              <thead>
                <tr>
                  <th style={{ width: '55%' }}>Título</th>
                  <th style={{ width: '15%' }}>Freshdesk</th>
                  <th style={{ width: '20%' }}>Atualizado Em</th>
                  <th style={{ width: '10%' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {articles.map(a => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{a.title}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <a
                        href={`https://sistemanextfit.freshdesk.com/support/solutions/articles/${a.freshdeskId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="link"
                      >
                        {a.freshdeskId}
                      </a>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(a.updatedAt).toLocaleString()}</td>
                    <td>
                      <button className="btn btn-ghost" onClick={() => openArticle(a.id)}>Abrir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <div style={{ color: 'var(--text-muted)' }}>
                Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} de {total}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>Anterior</button>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button className="btn btn-ghost" onClick={() => handlePageChange(1)} disabled={page === 1}>1</button>
                  {page > 2 && <span style={{ padding: '0 6px' }}>…</span>}
                  <button className="btn btn-ghost" onClick={() => handlePageChange(page)} disabled>{page}</button>
                  {page < totalPages - 1 && <span style={{ padding: '0 6px' }}>…</span>}
                  <button className="btn btn-ghost" onClick={() => handlePageChange(totalPages)} disabled={page === totalPages}>{totalPages}</button>
                </div>
                <button className="btn btn-ghost" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>Próxima</button>
              </div>
            </div>
          </div>
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
