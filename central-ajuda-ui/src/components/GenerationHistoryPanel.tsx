import { useState } from 'react';
import type { GenerationEntry } from '../hooks/useGenerationHistory';
import { HelpCenterPreview } from './HelpCenterPreview';
import { CopyFreshdeskButton } from './CopyFreshdeskButton';

interface GenerationHistoryPanelProps {
  history: GenerationEntry[];
  onRestore: (entry: GenerationEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hoje · ${time}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${time}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

export function GenerationHistoryPanel({
  history,
  onRestore,
  onRemove,
  onClear,
}: GenerationHistoryPanelProps) {
  const [previewEntry, setPreviewEntry] = useState<GenerationEntry | null>(null);

  if (previewEntry) {
    return (
      <div className="history-preview-wrap animate-in">
        <div className="history-preview-bar">
          <button className="btn btn-secondary btn-sm" onClick={() => setPreviewEntry(null)}>
            ← Voltar ao histórico
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <CopyFreshdeskButton content={previewEntry.content} />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { onRestore(previewEntry); setPreviewEntry(null); }}
            >
              Restaurar este artigo
            </button>
          </div>
        </div>
        <div className="history-preview-meta">
          <span className="history-timestamp">{formatDate(previewEntry.timestamp)}</span>
          <span className="history-prompt-label">"{truncate(previewEntry.prompt, 120)}"</span>
        </div>
        <HelpCenterPreview title="Artigo do Histórico" content={previewEntry.content} />
      </div>
    );
  }

  return (
    <div className="history-panel animate-in">
      <div className="history-panel-header">
        <span className="history-panel-title">
          Histórico de Gerações
          <span className="history-badge">{history.length}</span>
        </span>
        {history.length > 0 && (
          <button
            className="btn-ghost-danger"
            onClick={() => { if (confirm('Limpar todo o histórico?')) onClear(); }}
          >
            Limpar tudo
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="history-empty">
          <span>Nenhuma geração ainda.</span>
          <small>Os artigos gerados aparecerão aqui automaticamente.</small>
        </div>
      ) : (
        <ul className="history-list">
          {history.map((entry) => (
            <li key={entry.id} className="history-item">
              <div className="history-item-top">
                <span className="history-timestamp">{formatDate(entry.timestamp)}</span>
                <button
                  className="history-remove-btn"
                  title="Remover do histórico"
                  onClick={() => onRemove(entry.id)}
                >
                  ×
                </button>
              </div>
              <p className="history-prompt">{truncate(entry.prompt, 100)}</p>
              {entry.sources.length > 0 && (
                <p className="history-sources">
                  {entry.sources.length} fonte{entry.sources.length > 1 ? 's' : ''} RAG
                </p>
              )}
              <div className="history-item-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPreviewEntry(entry)}
                >
                  Ver
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onRestore(entry)}
                >
                  Restaurar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
