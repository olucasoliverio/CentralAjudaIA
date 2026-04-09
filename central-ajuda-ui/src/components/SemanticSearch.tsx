import { useState } from 'react';
import { api, type SearchResult } from '../api';

export function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState('');
  const [qualityLoading, setQualityLoading] = useState<string | null>(null);
  const [qualityScores, setQualityScores] = useState<Record<string, any>>({});

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const data = await api.search(query, topK);
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Erro na busca.');
    } finally {
      setLoading(false);
    }
  };

  const handleQualityCheck = async (articleId: string) => {
    setQualityLoading(articleId);
    try {
      const score = await api.qualityScore({ articleId });
      setQualityScores(prev => ({ ...prev, [articleId]: score }));
    } catch {
      setQualityScores(prev => ({ ...prev, [articleId]: { error: true } }));
    } finally {
      setQualityLoading(null);
    }
  };

  const getRelevance = (distance: number) => {
    const similarity = Math.max(0, Math.min(100, (1 - distance) * 100));
    return similarity.toFixed(1);
  };

  const getRelevanceClass = (distance: number) => {
    const similarity = (1 - distance) * 100;
    if (similarity >= 70) return 'relevance-high';
    if (similarity >= 40) return 'relevance-mid';
    return 'relevance-low';
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'alta': return 'badge badge-alto';
      case 'media': return 'badge badge-medio';
      case 'baixa': return 'badge badge-baixo';
      default: return 'badge';
    }
  };

  // Group results by article (deduplicate chunks from same article)
  const groupedResults = results
    ? Object.values(
        results.reduce((acc, r) => {
          if (!acc[r.articleId]) {
            acc[r.articleId] = { ...r, chunks: [r.content] };
          } else {
            acc[r.articleId].chunks.push(r.content);
            if (r.distance < acc[r.articleId].distance) {
              acc[r.articleId].distance = r.distance;
            }
          }
          return acc;
        }, {} as Record<string, SearchResult & { chunks: string[] }>)
      ).sort((a, b) => a.distance - b.distance)
    : null;

  return (
    <>
      <header className="page-header">
        <h1>Busca Semântica</h1>
        <p>Pesquise na base vetorial de conhecimento usando linguagem natural.</p>
      </header>

      <section className="panel animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div>
          <label htmlFor="search-input">Consulta</label>
          <input
            id="search-input"
            type="text"
            placeholder="Ex: como configurar pagamento recorrente..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="topk-input" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Resultados</label>
            <select
              id="topk-input"
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              style={{ width: '80px' }}
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
          >
            {loading ? <span className="loading-text">Buscando...</span> : 'Buscar'}
          </button>
        </div>
      </section>

      {error && (
        <div className="status-error animate-in" style={{ marginBottom: '24px' }}>
          <h3>Erro</h3>
          <p>{error}</p>
        </div>
      )}

      {groupedResults && (
        <section className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.125rem' }}>
              Resultados
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>
                {groupedResults.length} artigos
              </span>
            </h2>
          </div>

          {groupedResults.length === 0 ? (
            <div className="empty-state">Nenhum resultado encontrado para essa consulta.</div>
          ) : (
            <div className="search-results">
              {groupedResults.map((result) => (
                <div key={result.articleId} className="search-result-item">
                  <div className="search-result-header">
                    <div>
                      <h3 className="search-result-title">{result.title}</h3>
                      <span className="search-result-id">ID: {result.articleId.slice(0, 8)}...</span>
                    </div>
                    <div className="search-result-relevance">
                      <span className={`relevance-value ${getRelevanceClass(result.distance)}`}>
                        {getRelevance(result.distance)}%
                      </span>
                      <span className="relevance-label">relevância</span>
                    </div>
                  </div>

                  <div className="relevance-bar-track">
                    <div
                      className={`relevance-bar-fill ${getRelevanceClass(result.distance)}`}
                      style={{ width: `${getRelevance(result.distance)}%` }}
                    />
                  </div>

                  <div className="search-result-snippet">
                    {result.chunks.slice(0, 2).map((chunk, i) => (
                      <p key={i}>{chunk.length > 250 ? chunk.slice(0, 250) + '...' : chunk}</p>
                    ))}
                    {result.chunks.length > 2 && (
                      <p className="more-chunks">+{result.chunks.length - 2} trechos adicionais</p>
                    )}
                  </div>

                  <div className="search-result-actions">
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleQualityCheck(result.articleId)}
                      disabled={qualityLoading === result.articleId}
                    >
                      {qualityLoading === result.articleId ? (
                        <span className="loading-text">Avaliando...</span>
                      ) : (
                        'Avaliar Qualidade'
                      )}
                    </button>
                  </div>

                  {qualityScores[result.articleId] && !qualityScores[result.articleId].error && (
                    <div className="quality-inline animate-in">
                      <div className="quality-inline-header">
                        <div className="score-display-inline">
                          <span className={`score-number ${getScoreColorClass(qualityScores[result.articleId].score)}`}>
                            {qualityScores[result.articleId].score}
                          </span>
                          <span className="score-of">/10</span>
                        </div>
                        <span className={getPriorityClass(qualityScores[result.articleId].priority)}>
                          {qualityScores[result.articleId].priority}
                        </span>
                      </div>
                      {qualityScores[result.articleId].issues?.length > 0 && (
                        <ul className="quality-issues-inline">
                          {qualityScores[result.articleId].issues.map((issue: string, i: number) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {qualityScores[result.articleId]?.error && (
                    <div className="status-error animate-in" style={{ marginTop: '8px' }}>
                      <p>Erro ao avaliar qualidade deste artigo.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function getScoreColorClass(score: number): string {
  if (score >= 8) return 'score-good';
  if (score >= 5) return 'score-ok';
  return 'score-bad';
}
