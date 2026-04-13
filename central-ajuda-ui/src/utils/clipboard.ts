/**
 * Converte Markdown para HTML limpo e copia para a área de transferência.
 * Ao colar no editor visual do Freshdesk (WYSIWYG), a formatação é preservada.
 *
 * ═══════════════════════════════════════════════════════════
 * GUIA DE ESTILO OFICIAL NEXT FIT (aplicado como inline styles)
 * ═══════════════════════════════════════════════════════════
 * - H1 (Título):             Verdana 18px, bold, #833AB4, justificado
 * - H2/H3 (Subtítulo):       Verdana 16px, bold, #264966, justificado
 * - p (Parágrafo):           Verdana 14px, #264966, justificado
 * - strong (Atenção):        Verdana 14px, bold, #833AB4
 * - em (Matriz/Observação):  Verdana 14px, italic, #264966
 * - li (Listas):             Verdana 14px, #264966
 * ═══════════════════════════════════════════════════════════
 */

// ── Passo 1: Converte Markdown → HTML bruto ───────────────────────────────────
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Negrito: **texto** ou __texto__
  html = html.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/gs, '<strong>$1</strong>');

  // Itálico: *texto* ou _texto_ (somente se não for parte de **)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/gs, '<em>$1</em>');
  html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/gs, '<em>$1</em>');

  // Links: [texto](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Imagens: ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">');

  // Títulos H4 → H1 (ordem importa: do mais específico para o mais geral)
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Listas não ordenadas: - item
  html = html.replace(/^[*\-] (.+)$/gm, '<li-bullet>$1</li-bullet>');
  html = html.replace(/(<li-bullet>[\s\S]*?<\/li-bullet>\n?)+/g, (match) => {
    const items = match.replace(/<li-bullet>([\s\S]*?)<\/li-bullet>/g, '<li>$1</li>');
    return `<ul>${items}</ul>`;
  });

  // Listas ordenadas: 1. item
  html = html.replace(/^\d+\. (.+)$/gm, '<li-ordered>$1</li-ordered>');
  html = html.replace(/(<li-ordered>[\s\S]*?<\/li-ordered>\n?)+/g, (match) => {
    const items = match.replace(/<li-ordered>([\s\S]*?)<\/li-ordered>/g, '<li>$1</li>');
    return `<ol>${items}</ol>`;
  });

  // Linhas horizontais
  html = html.replace(/^---+$/gm, '<hr>');

  // Parágrafos — agrupa linhas que não são tags HTML em <p>
  const lines = html.split('\n');
  const result: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Identifica se a linha é o início/fim de um bloco HTML em nível de raiz
    const isBlock = /^\s*<\/?(h\d|ul|ol|li|hr|img|pre|div|blockquote|table|thead|tbody|tr|td|th|style|script|iframe)(>|\s)/i.test(trimmed);
    const isBr = /^<br\s*\/?>$/.test(trimmed);

    if (isBlock) {
      if (inBlock) { result.push('</p>'); inBlock = false; }
      result.push(trimmed);
    } else if (isBr) {
      if (inBlock) { result.push('</p>'); inBlock = false; }
      result.push('<p><br></p>');
    } else if (!trimmed) {
      // Quando encontrar linha vazia, fecha o bloco atual e insere um parágrafo vazio simulando um Enter
      if (inBlock) { result.push('</p>'); inBlock = false; }
      result.push('<p><br></p>');
    } else if (!inBlock) {
      result.push(`<p>${trimmed}`);
      inBlock = true;
    } else {
      result.push(`<br>${trimmed}`);
    }
  }
  if (inBlock) result.push('</p>');

  let finalHtml = result.join('\n');
  
  // Limpa possíveis duplicações excessivas de parágrafos vazios gerados
  finalHtml = finalHtml.replace(/(<p><br><\/p>\n*){2,}/g, '<p><br></p>\n');

  return finalHtml;
}

// ── Passo 2: Aplica estilos inline do Guia Next Fit ─────────────────────────
function applyNextFitStyles(html: string): string {
  // H1 — Título: Verdana 18px, bold, roxo #833AB4, justificado
  html = html.replace(
    /<h1>([\s\S]*?)<\/h1>/g,
    '<h1 style="font-family:Verdana,sans-serif;font-size:18px;font-weight:bold;color:#833AB4;text-align:justify;margin:0 0 14px 0;line-height:1.4;">$1</h1>'
  );

  // H2 — Subtítulo: Verdana 16px, bold, #264966, justificado
  html = html.replace(
    /<h2>([\s\S]*?)<\/h2>/g,
    '<h2 style="font-family:Verdana,sans-serif;font-size:16px;font-weight:bold;color:#264966;text-align:justify;margin:20px 0 10px 0;line-height:1.4;">$1</h2>'
  );

  // H3 — mesmo estilo do H2
  html = html.replace(
    /<h3>([\s\S]*?)<\/h3>/g,
    '<h3 style="font-family:Verdana,sans-serif;font-size:16px;font-weight:bold;color:#264966;text-align:justify;margin:18px 0 8px 0;line-height:1.4;">$1</h3>'
  );

  // H4
  html = html.replace(
    /<h4>([\s\S]*?)<\/h4>/g,
    '<h4 style="font-family:Verdana,sans-serif;font-size:14px;font-weight:bold;color:#264966;text-align:justify;margin:14px 0 6px 0;line-height:1.4;">$1</h4>'
  );

  // p — Parágrafo: Verdana 14px, #264966, justificado, margem 0 para evitar herança ao dar Enter
  html = html.replace(
    /<p>([\s\S]*?)<\/p>/g,
    '<p style="font-family:Verdana,sans-serif;font-size:14px;color:#264966;text-align:justify;margin:0;line-height:1.5;">$1</p>'
  );

  // strong — Texto de atenção: Verdana 14px, bold, roxo #833AB4
  html = html.replace(
    /<strong>([\s\S]*?)<\/strong>/g,
    '<strong style="font-family:Verdana,sans-serif;font-size:14px;font-weight:bold;color:#833AB4;">$1</strong>'
  );

  // em — Texto de matriz: Verdana 14px, italic, #264966
  html = html.replace(
    /<em>([\s\S]*?)<\/em>/g,
    '<em style="font-family:Verdana,sans-serif;font-size:14px;font-style:italic;color:#264966;">$1</em>'
  );

  // ul / ol — Listas
  html = html.replace(
    /<ul>/g,
    '<ul style="font-family:Verdana,sans-serif;font-size:14px;color:#264966;margin:8px 0 14px 24px;padding:0;">'
  );
  html = html.replace(
    /<ol>/g,
    '<ol style="font-family:Verdana,sans-serif;font-size:14px;color:#264966;margin:8px 0 14px 24px;padding:0;">'
  );
  html = html.replace(
    /<li>/g,
    '<li style="font-family:Verdana,sans-serif;font-size:14px;color:#264966;margin-bottom:6px;line-height:1.6;">'
  );

  // Links
  html = html.replace(
    /<a href="([^"]+)">/g,
    '<a href="$1" style="color:#264966;text-decoration:underline;font-family:Verdana,sans-serif;font-size:14px;">'
  );

  // HR
  html = html.replace(
    /<hr>/g,
    '<hr style="border:none;border-top:1px solid #264966;margin:20px 0;opacity:0.25;">'
  );

  return html;
}

/**
 * Copia o conteúdo Markdown como HTML rico para a área de transferência.
 * Funciona no editor WYSIWYG do Freshdesk: ao colar, mantém negrito, links, listas, etc.
 */
export async function copyMarkdownAsFreshdeskHtml(markdown: string): Promise<boolean> {
  const rawHtml = markdownToHtml(markdown);
  const styledHtml = applyNextFitStyles(rawHtml);

  // Inline styles garantem compatibilidade total — Freshdesk ignora <style> global
  const fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Verdana,sans-serif;font-size:14px;color:#264966;line-height:1.6;">
${styledHtml}
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
    // Fallback: tenta copiar só o texto puro
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
    (h as HTMLElement).style.color = '#833AB4';
    (h as HTMLElement).style.fontFamily = 'Verdana, sans-serif';
    (h as HTMLElement).style.fontWeight = 'bold';
  });
  return clone.innerHTML;
}