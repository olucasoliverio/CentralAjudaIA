/**
 * Utility to copy content to clipboard as HTML and Plain Text.
 * This ensures that when pasting into CMS editors, the formatting (bold, colors, etc.) is preserved.
 */
export async function copyToClipboardWithFormatting(htmlContent: string, plainText: string) {
  try {
    const blobHtml = new Blob([htmlContent], { type: 'text/html' });
    const blobText = new Blob([plainText], { type: 'text/plain' });
    
    const data = [
      new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText,
      }),
    ];

    await navigator.clipboard.write(data);
    return true;
  } catch (err) {
    console.error('Failed to copy formatted text: ', err);
    // Fallback to simple text copy
    try {
      await navigator.clipboard.writeText(plainText);
      return true;
    } catch (err2) {
      return false;
    }
  }
}

/**
 * Converts basic Markdown-ish preview HTML to a cleaner version for the clipboard.
 * Adds inline styles to ensure the CMS picks up the colors and fonts.
 */
export function prepareHtmlForCms(elementId: string): string {
  const element = document.getElementById(elementId);
  if (!element) return '';

  // Clone the element to avoid modifying the UI
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Apply inline styles to help CMS editors understand the formatting
  const headers = clone.querySelectorAll('h1, h2, h3, h4');
  headers.forEach(h => {
    (h as HTMLElement).style.color = '#1a1a1a';
    (h as HTMLElement).style.fontWeight = 'bold';
    (h as HTMLElement).style.marginTop = '24px';
  });

  const paragraphs = clone.querySelectorAll('p');
  paragraphs.forEach(p => {
    (p as HTMLElement).style.marginBottom = '12px';
    (p as HTMLElement).style.lineHeight = '1.6';
  });

  const bolds = clone.querySelectorAll('strong, b');
  bolds.forEach(b => {
    (b as HTMLElement).style.fontWeight = 'bold';
  });

  const highlights = clone.querySelectorAll('.highlight-block');
  highlights.forEach(h => {
    (h as HTMLElement).style.backgroundColor = '#f8fafc';
    (h as HTMLElement).style.borderLeft = '4px solid #3B82F6';
    (h as HTMLElement).style.padding = '12px';
    (h as HTMLElement).style.fontStyle = 'italic';
  });

  return clone.innerHTML;
}
