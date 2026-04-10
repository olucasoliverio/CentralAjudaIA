import { Injectable, Logger } from '@nestjs/common';
import { FreshdeskService } from '../freshdesk/freshdesk.service';
import { ContentService } from '../content/content.service';
import { AiService } from '../ai/ai.service';
import { VectorDbService } from '../vector-db/vector-db.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly freshdesk: FreshdeskService,
    private readonly content: ContentService,
    private readonly ai: AiService,
    private readonly vectorDb: VectorDbService,
    private readonly prisma: PrismaService,
  ) {}

  async syncAllArticles() {
    this.logger.log('Starting full sync of Freshdesk articles...');
    
    try {
      const articles = await this.freshdesk.fetchAllArticles();
      this.logger.log(`Encontrados ${articles.length} artigos no total. Processando...`);

      for (const article of articles) {
        await this.syncArticle(article);
      }
      this.logger.log('Sync finished successfully.');
    } catch (e: unknown) {
      const error = e as Error;
      this.logger.error('Error in sync process', error?.message || String(e));
    }
  }

  async syncArticle(article: any) {
    try {
      // BUSCAR SE JÁ EXISTE NO BANCO E O ÚLTIMO UPDATE
      const exists = (await this.prisma.article.findUnique({
        where: { freshdeskId: article.id.toString() },
      })) as any;

      const freshdeskUpdatedAt = new Date(article.updated_at);

      if (exists && exists.freshdeskUpdatedAt) {
        if (freshdeskUpdatedAt <= new Date(exists.freshdeskUpdatedAt)) {
          this.logger.log(`[PULANDO] Article já sincronizado e sem alterações: ${article.title}`);
          return;
        }
        this.logger.log(`[ATUALIZANDO] Article alterado no Freshdesk: ${article.title}`);
      }

      this.logger.log(`Processing article: ${article.title}`);
      const markdown = this.content.processHtmlToMarkdown(article.description);
      const textChunks = this.content.chunkText(markdown, 800);

      const chunksData: {
        content: string;
        embedding: number[];
        tokenCount: number;
      }[] = [];

      // A API gratuita do Gemini tem limite de 15 requests por minuto
      // Usaremos batching para reduzir as requisições drásticamente
      if (textChunks.length > 0) {
        await new Promise((r) => setTimeout(r, 4500)); // Espera 4.5s para não tomar 429
        
        try {
          const embeddings = await this.ai.generateEmbeddingBatch(textChunks);
          
          for (let i = 0; i < textChunks.length; i++) {
            const text = textChunks[i];
            if (!text.trim()) continue;
            chunksData.push({
              content: text,
              embedding: embeddings[i],
              tokenCount: Math.ceil(text.length / 4),
            });
          }
        } catch (embError: unknown) {
          const error = embError as Error;
           this.logger.error(`Gemini embedding failed for article ${article.id}`, error?.message || String(embError));
           throw embError;
        }
      }

      await this.vectorDb.saveArticleAndChunks(
        article.id.toString(),
        article.title,
        markdown,
        article.category_id?.toString() || null,
        article.tags || [],
        freshdeskUpdatedAt,
        chunksData,
      );
    } catch (e: unknown) {
      const error = e as Error;
      this.logger.error(`Failed to process article ${article.id}`, error?.message || String(e));
    }
  }
}
