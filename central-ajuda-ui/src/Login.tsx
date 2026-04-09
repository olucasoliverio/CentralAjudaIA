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
      <div className="login-card animate-in">
        <div className="login-header">
          <h2>Next Fit AI</h2>
          <p>Central de Ajuda — Acesso Restrito</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div>
            <label htmlFor="api-key">Chave de Acesso</label>
            <input
              id="api-key"
              type="password"
              placeholder="Digite a chave da API..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
            Acessar Sistema
          </button>
        </form>
      </div>
    </div>
  );
}
