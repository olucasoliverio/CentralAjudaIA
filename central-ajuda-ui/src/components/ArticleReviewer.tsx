import { useState } from 'react';
import { api, type QualityScore, type StyleAnalysis, type RevisedArticle } from '../api';
import { CopyFreshdeskButton } from './CopyFreshdeskButton';
import { HelpCenterPreview } from './HelpCenterPreview';

type Tab = 'quality' | 'review' | 'style';
type InputMode = 'id' | 'content';

export function ArticleReviewer() {
  // Input state
  const [inputMode, setInputMode] = useState<InputMode>('id');
  const [articleId, setArticleId] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [reviewInstructions, setReviewInstructions] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('quality');

  // Result states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [qualityResult, setQualityResult] = useState<QualityScore | null>(null);
  const [reviewResult, setReviewResult] = useState<RevisedArticle | null>(null);
  const [styleResult, setStyleResult] = useState<StyleAnalysis | null>(null);
  const [showReviewPreview, setShowReviewPreview] = useState(false);

  const isNumeric = (val: string) => /^\d+$/.test(val.trim());

  const getIdParams = () => {
    const id = articleId.trim();
    if (!id) return {};
    if (isNumeric(id)) return { freshdeskId: id };
    return { articleId: id };
  };

  const getInputParams = () => {
    if (inputMode === 'content') {
      return { articleContent: articleContent.trim() };
    }
    return getIdParams();
  };

  const hasValidInput = () => {
    if (inputMode === 'id') return articleId.trim().length > 0;
    return articleContent.trim().length > 0;
  };

  const clearResults = () => {
    setQualityResult(null);
    setReviewResult(null);
    setStyleResult(null);
    setShowReviewPreview(false);
    setError('');
  };

  const handleQualityScore = async () => {
    if (!hasValidInput()) return;
    setLoading(true);
    clearResults();
    try {
      const data = await api.qualityScore(getInputParams());
      setQualityResult(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao avaliar qualidade.');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!hasValidInput()) return;
    setLoading(true);
    clearResults();
    try {
      const params: any = { ...getInputParams() };
      if (reviewInstructions.trim()) {
        params.whatToChange = reviewInstructions.trim();
      }
      const data = await api.updateArticle(params);
      setReviewResult(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao revisar artigo.');
    } finally {
      setLoading(false);
    }
  };

  const handleStyleAnalysis = async () => {
    if (inputMode !== 'content' || !articleContent.trim()) {
      setError('A análise de estilo requer o conteúdo do artigo (modo "Conteúdo").');
      return;
    }
    setLoading(true);
    clearResults();
    try {
      const data = await api.analyzeStyle([articleContent.trim()]);
      if (data.length > 0) {
        setStyleResult(data[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Erro na análise de estilo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    switch (activeTab) {
      case 'quality': return handleQualityScore();
      case 'review': return handleReview();
      case 'style': return handleStyleAnalysis();
    }
  };

  const getSubmitLabel = () => {
    switch (activeTab) {
      case 'quality': return 'Avaliar Qualidade';
      case 'review': return 'Revisar Artigo';
      case 'style': return 'Analisar Estilo';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'var(--success)';
    if (score >= 5) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'alta': return 'badge badge-alto';
      case 'media': return 'badge badge-medio';
      case 'baixa': return 'badge badge-baixo';
      default: return 'badge';
    }
  };

  // Review preview mode
  if (showReviewPreview && reviewResult) {
    return (
      <section className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="preview-header">
          <button className="btn btn-secondary" onClick={() => setShowReviewPreview(false)}>
            Voltar
          </button>
          <CopyFreshdeskButton content={reviewResult.revised_content} />
        </div>

        {reviewResult.changes_summary?.length > 0 && (
          <div className="changes-panel">
            <h4>Alterações realizadas</h4>
            <ul>
              {reviewResult.changes_summary.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        {reviewResult.style_violations_fixed?.length > 0 && (
          <div className="changes-panel">
            <h4>Violações de estilo corrigidas</h4>
            <ul>
              {reviewResult.style_violations_fixed.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          </div>
        )}

        {reviewResult.assumptions?.length > 0 && (
          <div className="changes-panel">
            <h4>Premissas assumidas</h4>
            <ul>
              {reviewResult.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        <HelpCenterPreview title="Artigo Revisado" content={reviewResult.revised_content} />
      </section>
    );
  }

  return (
    <>
      <header className="page-header">
        <h1>Revisor de Artigos</h1>
        <p>Avalie a qualidade, revise o conteúdo ou analise o estilo de artigos existentes.</p>
      </header>

      {/* Tabs */}
      <div className="tab-bar">
        <button
          className={`tab-item ${activeTab === 'quality' ? 'active' : ''}`}
          onClick={() => { setActiveTab('quality'); clearResults(); }}
        >
          Quality Score
        </button>
        <button
          className={`tab-item ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => { setActiveTab('review'); clearResults(); }}
        >
          Revisão Completa
        </button>
        <button
          className={`tab-item ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => { setActiveTab('style'); clearResults(); }}
        >
          Análise de Estilo
        </button>
      </div>

      {/* Input */}
      <section className="panel animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        {/* Mode toggle */}
        <div className="input-mode-toggle">
          <button
            className={`mode-btn ${inputMode === 'id' ? 'active' : ''}`}
            onClick={() => setInputMode('id')}
          >
            Por ID
          </button>
          <button
            className={`mode-btn ${inputMode === 'content' ? 'active' : ''}`}
            onClick={() => setInputMode('content')}
          >
            Por Conteúdo
          </button>
        </div>

        {inputMode === 'id' ? (
          <div>
            <label htmlFor="reviewer-id">ID do Artigo (UUID interno ou Freshdesk numérico)</label>
            <input
              id="reviewer-id"
              type="text"
              placeholder="Ex: a1b2c3d4-... ou 1234567890"
              value={articleId}
              onChange={(e) => setArticleId(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
            {articleId.trim() && (
              <span className="hint-text" style={{ marginTop: '4px', display: 'block' }}>
                Detectado: {isNumeric(articleId.trim()) ? 'Freshdesk ID' : 'UUID interno'}
              </span>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="reviewer-content">Conteúdo do Artigo</label>
            <textarea
              id="reviewer-content"
              rows={8}
              placeholder="Cole o conteúdo Markdown do artigo aqui..."
              value={articleContent}
              onChange={(e) => setArticleContent(e.target.value)}
            />
          </div>
        )}

        {activeTab === 'review' && (
          <div>
            <label htmlFor="review-instructions">Instruções adicionais (opcional)</label>
            <textarea
              id="review-instructions"
              rows={3}
              placeholder="Deixe vazio para detecção automática de problemas, ou descreva o que deve ser alterado..."
              value={reviewInstructions}
              onChange={(e) => setReviewInstructions(e.target.value)}
            />
          </div>
        )}

        {activeTab === 'style' && inputMode === 'id' && (
          <div className="notice-inline">
            A análise de estilo requer o conteúdo completo do artigo. Mude para o modo "Por Conteúdo".
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || !hasValidInput() || (activeTab === 'style' && inputMode === 'id')}
          >
            {loading ? <span className="loading-text">Processando...</span> : getSubmitLabel()}
          </button>
        </div>
      </section>

      {error && (
        <div className="status-error animate-in" style={{ marginBottom: '24px' }}>
          <h3>Erro</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Quality Score Result */}
      {qualityResult && (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="score-card">
            <div className="score-main">
              <span className="score-big" style={{ color: getScoreColor(qualityResult.score) }}>
                {qualityResult.score}
              </span>
              <span className="score-max">/10</span>
            </div>
            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{
                  width: `${qualityResult.score * 10}%`,
                  background: getScoreColor(qualityResult.score),
                }}
              />
            </div>
            <div className="score-meta">
              <span>Prioridade de revisão:</span>
              <span className={getPriorityClass(qualityResult.priority)}>
                {qualityResult.priority}
              </span>
            </div>
          </div>

          {qualityResult.issues.length > 0 && (
            <div className="changes-panel">
              <h4>Problemas identificados</h4>
              <ul>
                {qualityResult.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {qualityResult.issues.length === 0 && (
            <div className="status-success">Nenhum problema encontrado. O artigo está em boa forma.</div>
          )}
        </div>
      )}

      {/* Review Result */}
      {reviewResult && (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reviewResult.changes_summary?.length === 1 && reviewResult.changes_summary[0].includes('não necessita') ? (
            <div className="status-success">{reviewResult.changes_summary[0]}</div>
          ) : (
            <>
              <div className="status-success">Revisão concluída com sucesso</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowReviewPreview(true)}>
                  Ver Preview
                </button>
                <div style={{ flex: 1 }}>
                  <CopyFreshdeskButton content={reviewResult.revised_content} />
                </div>
              </div>
              {reviewResult.changes_summary?.length > 0 && (
                <div className="changes-panel">
                  <h4>Resumo das alterações</h4>
                  <ul>
                    {reviewResult.changes_summary.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Style Analysis Result */}
      {styleResult && (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="score-card">
            <div className="score-main">
              <span className="score-big" style={{ color: getScoreColor(styleResult.overall_score) }}>
                {styleResult.overall_score}
              </span>
              <span className="score-max">/10</span>
            </div>
            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{
                  width: `${styleResult.overall_score * 10}%`,
                  background: getScoreColor(styleResult.overall_score),
                }}
              />
            </div>
          </div>

          <div className="style-checks-grid">
            <StyleCheck label="Abertura padrão" value={styleResult.follows_opening} />
            <StyleCheck label="Fechamento padrão" value={styleResult.follows_closing} />
            <StyleCheck label="Tom imperativo" value={styleResult.uses_imperative_tone} />
            <StyleCheck label="Links de ramificação" value={styleResult.has_branching_links} />
            <StyleCheck label="Placeholders visuais" value={styleResult.has_visual_placeholders} />
            <div className="style-check-item">
              <span className="style-check-label">Concisão</span>
              <span className={`conciseness-badge conciseness-${styleResult.conciseness}`}>
                {styleResult.conciseness}
              </span>
            </div>
          </div>

          {styleResult.grammar_issues?.length > 0 && (
            <div className="changes-panel">
              <h4>Problemas gramaticais</h4>
              <ul>
                {styleResult.grammar_issues.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}

          {styleResult.suggested_improvements?.length > 0 && (
            <div className="changes-panel">
              <h4>Sugestões de melhoria</h4>
              <ul>
                {styleResult.suggested_improvements.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {styleResult.suggested_tags?.length > 0 && (
            <div className="panel" style={{ padding: '16px' }}>
              <h4 style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '10px'
              }}>
                Tags sugeridas
              </h4>
              <div className="tags-list">
                {styleResult.suggested_tags.map((tag, i) => (
                  <span key={i} className="tag-item">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function StyleCheck({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="style-check-item">
      <span className="style-check-label">{label}</span>
      <span className={`style-check-value ${value ? 'check-pass' : 'check-fail'}`}>
        {value ? 'Sim' : 'Não'}
      </span>
    </div>
  );
}
