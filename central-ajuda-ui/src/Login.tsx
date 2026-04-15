import { useState } from 'react';
import { api } from './api';

interface Props {
  onLogin: (key: string) => void;
}

export function Login({ onLogin }: Props) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    setLoading(true);
    setError(false);

    const isValid = await api.validateKey(key.trim());
    if (isValid) {
      onLogin(key.trim());
    } else {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-ambient" />

      <div className="login-card animate-in">
        <div className="login-header">
          <div className="login-logo"> <img src="../public/Icon.png"></img></div>
          <h2>Olive Articles AI</h2>
          <p>Central de Ajuda Inteligente</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="api-key">Insira a senha</label>
            <input
              id="api-key"
              type="password"
              placeholder="Digite a senha aqui"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError(false); // remove feedback de erro ao digitar
              }}
              autoFocus
              className={error ? 'input-error' : ''}
              style={error ? { borderColor: 'var(--danger)' } : {}}
            />
            {error && <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px' }}>Chave incorreta ou sem permissão de acesso.</span>}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Validando Acesso...' : 'Autenticar e Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
