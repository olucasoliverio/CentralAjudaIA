import { useState } from 'react';
import { api, type ImpactArticle, type ImpactResult, type RevisedArticle } from '../api';
import { CopyFreshdeskButton } from './CopyFreshdeskButton';
import { HelpCenterPreview } from './HelpCenterPreview';
import { GenerationHistoryPanel } from './GenerationHistoryPanel';
import { useGenerationHistory, type GenerationEntry } from '../hooks/useGenerationHistory';

export function ImpactAnalyzer() {
  const [productMessage, setProductMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [error, setError] = useState('');
  const [applyingUpdate, setApplyingUpdate] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [revisedArticles, setRevisedArticles] = useState<Record<string, RevisedArticle>>({});
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { history, addEntry, clearHistory, removeEntry } = useGenerationHistory();

  const handleAnalyze = async () => {
    if (!productMessage.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setUpdateSuccess(null);
    setApplyingUpdate(null);
    setRevisedArticles({});

    try {
      const data = await api.analyzeImpact(productMessage);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyUpdate = async (article: ImpactArticle) => {
    setApplyingUpdate(article.articleId);
    try {
      const data = await api.updateArticle({
        articleId: article.articleId,
        whatToChange: article.suggested_update_instruction,
      });
      setRevisedArticles(prev => ({
        ...prev,
        [article.articleId]: data,
      }));
      setUpdateSuccess(article.articleId);
      setShowPreview(article.articleId);

      // Salva no histórico automaticamente com o título do artigo + a instrução usada
      addEntry(
        `[Impacto] ${article.title}: ${article.suggested_update_instruction}`,
        data.revised_content,
        [{ id: article.articleId, title: article.title }]
      );
    } catch {
      alert('Erro ao tentar atualizar o artigo de ID: ' + article.articleId);
    } finally {
      setApplyingUpdate(null);
    }
  };

  const handleRestoreFromHistory = (entry: GenerationEntry) => {
    // Para simplificar, quando restaura do histórico aqui, 
    // assumimos que é uma visualização isolada do conteúdo
    const pseudoArticleId = entry.sources[0]?.id || `hist-${entry.id}`;
    setRevisedArticles(prev => ({
      ...prev,
      [pseudoArticleId]: {
        revised_content: entry.content,
        changes_summary: [entry.prompt],
        style_violations_fixed: [],
        assumptions: []
      }
    }));
    setShowPreview(pseudoArticleId);
    setUpdateSuccess(pseudoArticleId);
    setShowHistory(false);
  };

  const getImpactBadgeClass = (impact: string) => {
    switch (impact) {
      case 'ALTO': return 'badge badge-alto';
      case 'MEDIO': return 'badge badge-medio';
      case 'BAIXO': return 'badge badge-baixo';
      default: return 'badge';
    }
  };

  const currentArticle = showPreview
    ? result?.affected_articles.find(a => a.articleId === showPreview)
    : null;
  const currentRevised = showPreview ? revisedArticles[showPreview] : null;

  // Impact counters
  const countByImpact = (level: string) =>
    result?.affected_articles.filter(a => a.impact === level).length || 0;

  if (showPreview && currentRevised) {
    return (
      <section className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="preview-header">
          <button className="btn btn-secondary" onClick={() => setShowPreview(null)}>
            Voltar para lista
          </button>
          <CopyFreshdeskButton content={currentRevised.revised_content} />
        </div>

        <div className="preview-tip">
          <strong>Como usar:</strong> Clique em "Copiar para Freshdesk", abra o artigo no Freshdesk, clique no editor e pressione <kbd>Ctrl+V</kbd>. A formatação será preservada.
        </div>

        {currentRevised.changes_summary?.length > 0 && (
          <div className="changes-panel">
            <h4>Alterações realizadas</h4>
            <ul>
              {currentRevised.changes_summary.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {currentRevised.style_violations_fixed?.length > 0 && (
          <div className="changes-panel">
            <h4>Violações de estilo corrigidas</h4>
            <ul>
              {currentRevised.style_violations_fixed.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        <div id="article-preview-content">
          <HelpCenterPreview
            title={currentArticle?.title || 'Artigo Atualizado'}
            content={currentRevised.revised_content}
          />
        </div>
      </section>
    );
  }

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h1>Análise de Impacto</h1>
            <p>Cole as PRDs ou mensagens do time de Produto para cruzar com a base de conhecimento.</p>
          </div>
          <button
            id="history-toggle-btn"
            className={`btn btn-secondary ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(v => !v)}
            style={{ flexShrink: 0, position: 'relative' }}
          >
            Histórico
            {history.length > 0 && (
              <span className="nav-badge" style={{ position: 'absolute', top: '-6px', right: '-6px' }}>
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Painel de histórico — desliza abaixo do header */}
      {showHistory && (
        <GenerationHistoryPanel
          history={history}
          onRestore={handleRestoreFromHistory}
          onRemove={removeEntry}
          onClear={clearHistory}
        />
      )}

      <section className="panel animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div>
          <label htmlFor="impact-input">Nova Atualização de Produto</label>
          <textarea
            id="impact-input"
            rows={6}
            placeholder="Cole as novidades, changelogs ou especificações da PRD aqui..."
            value={productMessage}
            onChange={(e) => setProductMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAnalyze();
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="hint-text">Ctrl + Enter para enviar</span>
          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={loading || !productMessage.trim()}
          >
            {loading ? <span className="loading-text">Analisando...</span> : 'Analisar Impacto'}
          </button>
        </div>
      </section>

      {error && (
        <div className="status-error animate-in" style={{ marginBottom: '24px' }}>
          <h3>Erro</h3>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <section className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="summary-block">
            <h3>Resumo da IA</h3>
            <p>{result.summary}</p>
          </div>

          {result.affected_articles.length > 0 && (
            <div className="stats-row">
              <div className="stat-item">
                <span className="stat-value">{result.affected_articles.length}</span>
                <span className="stat-label">Artigos afetados</span>
              </div>
              <div className="stat-item stat-alto">
                <span className="stat-value">{countByImpact('ALTO')}</span>
                <span className="stat-label">Alto</span>
              </div>
              <div className="stat-item stat-medio">
                <span className="stat-value">{countByImpact('MEDIO')}</span>
                <span className="stat-label">Médio</span>
              </div>
              <div className="stat-item stat-baixo">
                <span className="stat-value">{countByImpact('BAIXO')}</span>
                <span className="stat-label">Baixo</span>
              </div>
            </div>
          )}

          {result.affected_articles.length === 0 ? (
            <div className="empty-state">
              Nenhum artigo da base de conhecimento precisa ser alterado com base nessa atualização.
            </div>
          ) : (
            <div className="articles-grid">
              {result.affected_articles.map((article) => (
                <div key={article.articleId} className="article-card">
                  <div className="article-card-header">
                    <h3>{article.title}</h3>
                    <span className={getImpactBadgeClass(article.impact)}>
                      {article.impact}
                    </span>
                  </div>

                  <div className="article-card-section">
                    <span className="article-card-section-label">Por que foi afetado</span>
                    <p>{article.reason}</p>
                  </div>

                  <div className="instruction-block">
                    <span className="article-card-section-label" style={{ color: 'var(--accent-brand)', marginBottom: '6px', display: 'block' }}>
                      Instrução para a IA
                    </span>
                    <p>"{article.suggested_update_instruction}"</p>
                  </div>

                  <div className="article-card-actions">
                    {updateSuccess === article.articleId ? (
                      <>
                        <div className="status-success">Atualização gerada com sucesso</div>
                        <button
                          className="btn btn-secondary"
                          style={{ width: '100%' }}
                          onClick={() => setShowPreview(article.articleId)}
                        >
                          Ver Preview
                        </button>
                        <CopyFreshdeskButton content={revisedArticles[article.articleId].revised_content} />
                      </>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        onClick={() => handleApplyUpdate(article)}
                        disabled={applyingUpdate === article.articleId}
                      >
                        {applyingUpdate === article.articleId ? (
                          <span className="loading-text">Gerando artigo...</span>
                        ) : (
                          'Gerar Atualização'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
