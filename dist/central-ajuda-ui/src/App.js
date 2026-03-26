import { useState } from 'react';
import './index.css';
function App() {
    const [productMessage, setProductMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [applyingUpdate, setApplyingUpdate] = useState(null);
    const [updateSuccess, setUpdateSuccess] = useState(null);
    const handleAnalyze = async () => {
        if (!productMessage.trim())
            return;
        setLoading(true);
        setError('');
        setResult(null);
        setUpdateSuccess(null);
        setApplyingUpdate(null);
        try {
            const response = await fetch('http://localhost:3000/api/article/analyze-impact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productMessage }),
            });
            if (!response.ok) {
                throw new Error('Falha ao comunicar com a API');
            }
            const data = await response.json();
            setResult(data);
        }
        catch (err) {
            setError(err.message || 'Erro inesperado.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleApplyUpdate = async (article) => {
        setApplyingUpdate(article.articleId);
        try {
            const response = await fetch('http://localhost:3000/api/article/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    articleId: article.articleId,
                    whatToChange: article.suggested_update_instruction
                }),
            });
            if (!response.ok)
                throw new Error('Falha ao atualizar o artigo.');
            setUpdateSuccess(article.articleId);
        }
        catch (err) {
            alert('Erro ao tentar atualizar o artigo de ID: ' + article.articleId);
        }
        finally {
            setApplyingUpdate(null);
        }
    };
    const getImpactColor = (impact) => {
        switch (impact) {
            case 'ALTO': return 'var(--danger)';
            case 'MEDIO': return 'var(--warning)';
            case 'BAIXO': return 'var(--success)';
            default: return 'var(--text-secondary)';
        }
    };
    return (<div style={{ display: 'flex', minHeight: '100vh' }}>
      
      <aside className="glass-panel" style={{ width: '280px', margin: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Next Fit AI</h2>
        <p style={{ fontSize: '0.85rem', marginBottom: '32px' }}>Assistente da Base de Conhecimento</p>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ padding: '10px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontWeight: 500, color: 'var(--accent-primary)', borderLeft: '3px solid var(--accent-primary)' }}>
            📊 Impact Analyzer
          </div>
          <div style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'not-allowed', opacity: 0.6 }}>
            ⚙️ Configuration
          </div>
        </nav>
      </aside>

      
      <main style={{ flex: 1, padding: '16px 32px 32px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <header style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
          <h1 style={{ fontSize: '1.8rem' }}>Análise de Impacto de Produto</h1>
          <p style={{ marginTop: '4px' }}>Cole as PRDs ou mensagens do time de Produto para cruzar com a base de conhecimento.</p>
        </header>

        
        <section className="glass-panel animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '8px' }}>Nova Atualização de Produto</label>
            <textarea rows={6} placeholder="Cole as novidades, changelogs ou especificações da PRD aqui..." value={productMessage} onChange={(e) => setProductMessage(e.target.value)} style={{ resize: 'vertical' }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleAnalyze} disabled={loading || !productMessage.trim()}>
              {loading ? '🧠 Analisando 12k+ Tokens...' : '✨ Analisar Impacto'}
            </button>
          </div>
        </section>

        
        {error && (<div className="glass-panel animate-fade-in" style={{ padding: '16px', borderLeft: '4px solid var(--danger)', background: 'rgba(239, 68, 68, 0.1)' }}>
            <h3 style={{ color: 'var(--danger)', marginBottom: '4px' }}>Erro</h3>
            <p>{error}</p>
          </div>)}

        
        {result && (<section className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel" style={{ padding: '20px', background: 'var(--bg-tertiary)' }}>
              <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Resumo da IA</h3>
              <p style={{ color: 'var(--text-secondary)' }}>{result.summary}</p>
            </div>

            <h2 style={{ fontSize: '1.4rem', marginTop: '8px' }}>
              Artigos Afetados ({result.affected_articles.length})
            </h2>

            {result.affected_articles.length === 0 ? (<div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Nenhum artigo da base de conhecimento atual precisa ser alterado com base nessa atualização.
              </div>) : (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
                {result.affected_articles.map((article) => (<div key={article.articleId} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ fontSize: '1.1rem', flex: 1, paddingRight: '12px' }}>{article.title}</h3>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        color: getImpactColor(article.impact),
                        border: `1px solid ${getImpactColor(article.impact)}`
                    }}>
                        {article.impact}
                      </span>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Por que foi afetado?</h4>
                      <p style={{ fontSize: '0.9rem' }}>{article.reason}</p>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                      <h4 style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '6px' }}>Instrução para a IA</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{article.suggested_update_instruction}"</p>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                      {updateSuccess === article.articleId ? (<div style={{ padding: '10px', textAlign: 'center', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                           ✅ Atualização Aplicada!
                         </div>) : (<button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => handleApplyUpdate(article)} disabled={applyingUpdate === article.articleId}>
                          {applyingUpdate === article.articleId ? '⏳ Gerando Artigo (Draft)...' : '🪄 Aplicar Atualização (Draft)'}
                        </button>)}
                    </div>
                  </div>))}
              </div>)}
          </section>)}
      </main>
    </div>);
}
export default App;
//# sourceMappingURL=App.js.map