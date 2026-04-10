import { useState } from 'react';
import '../styles/ColorPalette.css';

interface ColorItem {
  name: string;
  hex: string;
  description?: string;
}

interface ColorCategory {
  title: string;
  colors: ColorItem[];
}

interface ColorPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const colorCategories: ColorCategory[] = [
  {
    title: '📌 Módulos',
    colors: [
      { name: 'Roxo', hex: '#940DAC', description: 'Início, Desempenho' },
      { name: 'Azul', hex: '#3F83E1', description: 'Clientes' },
      { name: 'Alaranjado', hex: '#EF6C2F', description: 'Campanhas' },
      { name: 'Roxo Forte', hex: '#62327C', description: 'Agenda' },
      { name: 'Verde', hex: '#17B55F', description: 'Financeiro' },
      { name: 'Marrom', hex: '#79554A', description: 'Estoque' },
      { name: 'Vermelho', hex: '#D62637', description: 'Treinos' },
      { name: 'Roxo (+Exercício)', hex: '#8A049D', description: '+Exercício e tipo' },
      { name: 'Preto', hex: '#000000', description: 'WOD' },
      { name: 'Cinza', hex: '#424242', description: 'Relatórios' },
      { name: 'Cinza Fraco', hex: '#9E9E9E', description: 'Administrativo, Configurações, Loja, Ajuda' },
    ],
  },
  {
    title: '📌 Títulos Financeiros',
    colors: [
      { name: 'Verde', hex: '#17B55F', description: 'Recebido' },
      { name: 'Amarelo', hex: '#FBAB4B', description: 'Aberto, Alerta' },
      { name: 'Vermelho Fraco', hex: '#E77076', description: 'Cancelado' },
      { name: 'Roxo Forte', hex: '#7500A9', description: 'Em andamento' },
      { name: 'Verde Militar', hex: '#00622B', description: 'Renegociado' },
    ],
  },
  {
    title: '📌 Caixa',
    colors: [
      { name: 'Verde', hex: '#17B55F', description: 'Fechar Caixa' },
      { name: 'Amarelo', hex: '#F3C654', description: 'Entrada' },
      { name: 'Vermelho', hex: '#F73C41', description: 'Saída' },
      { name: 'Azul', hex: '#537DDD', description: 'Transferência' },
      { name: 'Marrom', hex: '#79554A', description: 'Listar Caixas' },
    ],
  },
  {
    title: '📌 Status do Cliente',
    colors: [
      { name: 'Verde', hex: '#39B258', description: 'Ativo' },
      { name: 'Vermelho', hex: '#F5403C', description: 'Bloqueado' },
      { name: 'Cinza', hex: '#9E9E9E', description: 'Inativo' },
      { name: 'Amarelo', hex: '#FDA93C', description: 'Suspenso' },
    ],
  },
  {
    title: '📌 Botões e Outros',
    colors: [
      { name: 'Verde', hex: '#17B55F', description: 'Botões de SALVAR, NOVA VENDA, etc.' },
      { name: 'Azulzinho', hex: '#4A99EE', description: 'Abas' },
      { name: 'Cinza', hex: '#424242', description: 'Solicitando cancelamento nota fiscal' },
      { name: 'Goiaba', hex: '#F55F56', description: 'Gympass' },
      { name: 'Rosa', hex: '#F2486A', description: 'Wellhub' },
      { name: 'Verde Água', hex: '#26D17A', description: 'TotalPass' },
    ],
  },
];

export function ColorPalette({ isOpen, onClose }: ColorPaletteProps) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const handleCopyColor = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar cor:', err);
    }
  };

  return (
    <>
      {/* Overlay backdrop */}
      {isOpen && (
        <div className="color-palette-backdrop" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside className={`color-palette-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="color-palette-header">
          <h2>🎨 Paleta de Cores</h2>
          <button className="color-palette-close" onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>

        <div className="color-palette-content">
          {colorCategories.map((category) => (
            <div key={category.title} className="color-section">
              <h3 className="color-section-title">{category.title}</h3>
              <div className="color-grid">
                {category.colors.map((color) => (
                  <div
                    key={`${category.title}-${color.hex}`}
                    className="color-item"
                    onClick={() => handleCopyColor(color.hex)}
                    title={`Clique para copiar: ${color.hex}`}
                  >
                    <div
                      className="color-swatch"
                      style={{ backgroundColor: color.hex }}
                    >
                      {copiedHex === color.hex && (
                        <div className="copy-feedback">✓ Copiado!</div>
                      )}
                    </div>
                    <div className="color-info">
                      <div className="color-name">{color.name}</div>
                      <div className="color-hex">{color.hex}</div>
                      {color.description && (
                        <div className="color-description">{color.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
