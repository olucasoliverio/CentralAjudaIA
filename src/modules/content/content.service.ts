import { Injectable, Logger } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import TurndownService from 'turndown';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({ headingStyle: 'atx' });
  }

  processHtmlToMarkdown(htmlContent: string): string {
    if (!htmlContent) return '';
    const cleanHtml = sanitizeHtml(htmlContent, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3']),
      allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt'] },
    });
    return this.turndownService.turndown(cleanHtml);
  }

  chunkText(text: string, maxTokens: number = 800): string[] {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const p of paragraphs) {
      if ((currentChunk.length + p.length) / 4 > maxTokens) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = p;
      } else {
        currentChunk += currentChunk ? '\n\n' + p : p;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks;
  }
}
