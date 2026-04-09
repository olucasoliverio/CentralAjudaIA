import { useState } from 'react';
import { api, type GenerateResult } from '../api';
import { CopyFreshdeskButton } from './CopyFreshdeskButton';
import { HelpCenterPreview } from './HelpCenterPreview';

export function ArticleGenerator() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await api.generate(prompt);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar artigo.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError('');
  };

  return (
    <>
      <header className="page-header">
        <h1>Gerador de Artigos</h1>
        <p>Gere novos artigos para a Central de Ajuda usando RAG + modelo fine-tuned Next Fit.</p>
      </header>

      {!result ? (
        <section className="panel animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="generator-input">PRD / Prompt de Geração</label>
            <textarea
              id="generator-input"
              rows={8}
              placeholder="Descreva a funcionalidade ou cole a PRD completa. Quanto mais detalhada a descrição, melhor o artigo gerado..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate();
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="hint-text">Ctrl + Enter para gerar</span>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
            >
              {loading ? <span className="loading-text">Gerando artigo...</span> : 'Gerar Artigo'}
            </button>
          </div>

          {error && (
            <div className="status-error animate-in">
              <h3>Erro</h3>
              <p>{error}</p>
            </div>
          )}
        </section>
      ) : (
        <section className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="preview-header">
            <button className="btn btn-secondary" onClick={handleReset}>
              Novo artigo
            </button>
            <CopyFreshdeskButton content={result.generated_content} />
          </div>

          <div className="preview-tip">
            <strong>Artigo gerado com sucesso.</strong> Revise o conteúdo, copie para o Freshdesk e faça os ajustes finais necessários.
          </div>

          {result.sources.length > 0 && (
            <div className="sources-panel">
              <h4>Fontes de referência utilizadas (RAG)</h4>
              <div className="source-list">
                {result.sources.map((source) => (
                  <div key={source.id} className="source-item">
                    <span className="source-title">{source.title}</span>
                    <span className="source-id">{source.id.slice(0, 8)}...</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <HelpCenterPreview
            title="Artigo Gerado"
            content={result.generated_content}
          />
        </section>
      )}
    </>
  );
}
