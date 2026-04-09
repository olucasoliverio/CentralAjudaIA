import { useState } from 'react';
import { copyMarkdownAsFreshdeskHtml } from '../utils/clipboard';

interface Props {
  content: string;
  label?: string;
}

export function CopyFreshdeskButton({ content, label = 'Copiar para Freshdesk' }: Props) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleCopy = async () => {
    const ok = await copyMarkdownAsFreshdeskHtml(content);
    setStatus(ok ? 'success' : 'error');
    setTimeout(() => setStatus('idle'), 2500);
  };

  return (
    <button className="btn btn-primary" onClick={handleCopy} style={{ width: '100%' }}>
      {status === 'idle' && label}
      {status === 'success' && 'Copiado — Cole no Freshdesk com Ctrl+V'}
      {status === 'error' && 'Falha — Tente selecionar manualmente'}
    </button>
  );
}
