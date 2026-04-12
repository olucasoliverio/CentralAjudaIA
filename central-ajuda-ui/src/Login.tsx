import { useState } from 'react';

interface Props {
  onLogin: (key: string) => void;
}

export function Login({ onLogin }: Props) {
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      onLogin(key.trim());
    }
  };

  return (
    <div className="login-container">
      {/* Elemento decorativo de fundo extra para o Login */}
      <div className="login-ambient" />
      
      <div className="login-card animate-in">
        <div className="login-header">
          <div className="login-logo-placeholder"></div>
          <h2>Next Fit AI</h2>
          <p>Abertura de Sessão Restrita</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="api-key">Chave de Acesso da API (Vertex/Gemini)</label>
            <input
              id="api-key"
              type="password"
              placeholder="Ex: AIzaSy..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            Autenticar e Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
