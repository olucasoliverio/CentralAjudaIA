/**
 * Converte Markdown para HTML limpo e copia para a área de transferência.
 * Ao colar no editor visual do Freshdesk (WYSIWYG), a formatação é preservada.
 */

// Converte Markdown para HTML limpo sem dependências externas
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Negrito: **texto** ou __texto__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Itálico: *texto* ou _texto_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Links: [texto](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Imagens: ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">');

  // Títulos H1–H4
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Listas não ordenadas (- item ou * item)
  html = html.replace(/^(?:[*-]) (.+)$/gm, '<li-bullet>$1</li-bullet>');
  html = html.replace(/(<li-bullet>.*<\/li-bullet>\n?)+/g, (match) => {
    const items = match.replace(/<li-bullet>(.*?)<\/li-bullet>/g, '<li>$1</li>');
    return `<ul>${items}</ul>`;
  });

  // Listas ordenadas (1. item)
  html = html.replace(/^\d+\. (.+)$/gm, '<li-ordered>$1</li-ordered>');
  html = html.replace(/(<li-ordered>.*<\/li-ordered>\n?)+/g, (match) => {
    const items = match.replace(/<li-ordered>(.*?)<\/li-ordered>/g, '<li>$1</li>');
    return `<ol>${items}</ol>`;
  });

  // Linhas horizontais
  html = html.replace(/^---+$/gm, '<hr>');

  // Parágrafos — linhas que não são tags HTML
  const lines = html.split('\n');
  const result: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      inBlock = false;
      continue;
    }
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<li') || trimmed.startsWith('<hr') || trimmed.startsWith('<img')) {
      if (inBlock) result.push('</p>');
      inBlock = false;
      result.push(trimmed);
    } else if (!inBlock) {
      result.push(`<p>${trimmed}`);
      inBlock = true;
    } else {
      result.push(`<br>${trimmed}`);
    }
  }
  if (inBlock) result.push('</p>');

  return result.join('\n');
}

/**
 * Copia o conteúdo Markdown como HTML rico para a área de transferência.
 * Funciona no editor WYSIWYG do Freshdesk: ao colar, mantém negrito, links, listas, etc.
 */
export async function copyMarkdownAsFreshdeskHtml(markdown: string): Promise<boolean> {
  const html = markdownToHtml(markdown);

  // HTML completo com estilos básicos que o Freshdesk vai respeitar
  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
    h1 { font-size: 22px; font-weight: bold; margin-bottom: 12px; }
    h2 { font-size: 18px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; }
    h3 { font-size: 15px; font-weight: bold; margin-top: 20px; margin-bottom: 6px; }
    p { margin-bottom: 12px; }
    strong { font-weight: bold; }
    ul, ol { margin: 8px 0 12px 24px; }
    li { margin-bottom: 4px; }
    a { color: #3B82F6; text-decoration: none; }
    img { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  </style>
</head>
<body>
${html}
</body>
</html>`;

  try {
    const blobHtml = new Blob([fullHtml], { type: 'text/html' });
    const blobText = new Blob([markdown], { type: 'text/plain' });

    const data = [
      new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText,
      }),
    ];

    await navigator.clipboard.write(data);
    return true;
  } catch {
    // Fallback: tenta copiar só o texto
    try {
      await navigator.clipboard.writeText(markdown);
      return true;
    } catch {
      return false;
    }
  }
}

// Mantém compatibilidade com o código existente
export async function copyToClipboardWithFormatting(htmlContent: string, plainText: string): Promise<boolean> {
  try {
    const blobHtml = new Blob([htmlContent], { type: 'text/html' });
    const blobText = new Blob([plainText], { type: 'text/plain' });
    const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
    await navigator.clipboard.write(data);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(plainText);
      return true;
    } catch {
      return false;
    }
  }
}

export function prepareHtmlForCms(elementId: string): string {
  const element = document.getElementById(elementId);
  if (!element) return '';
  const clone = element.cloneNode(true) as HTMLElement;
  const headers = clone.querySelectorAll('h1, h2, h3, h4');
  headers.forEach(h => {
    (h as HTMLElement).style.color = '#1a1a1a';
    (h as HTMLElement).style.fontWeight = 'bold';
  });
  return clone.innerHTML;
}