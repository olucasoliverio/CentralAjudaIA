import { Controller, Post, Body, NotFoundException } from '@nestjs/common';
import { AiService, UpdateArticleResult, AnalyzeImpactResult } from '../../ai/ai.service';
import { VectorDbService } from '../../vector-db/vector-db.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('api/article')
export class ArticleController {
  constructor(
    private readonly aiService: AiService,
    private readonly vectorDbService: VectorDbService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('generate')
  async generateArticle(@Body() body: { prompt: string }) {
    // 1. Embedding da intenção via Gemini (grátis)
    const promptEmbedding = await this.aiService.generateEmbedding(body.prompt);

    // 2. Busca semântica no banco vetorial (RAG)
    const similarChunks = await this.vectorDbService.semanticSearch(promptEmbedding, 5);
    const context = similarChunks.map((c) => c.content);

    // 3. Geração com contexto RAG + Guia de Estilo Next Fit via OpenAI
    const content = await this.aiService.generateArticleRAG(body.prompt, context);

    return {
      generated_content: content,
      sources: similarChunks.map((c) => c.articleId),
    };
  }

  private async fetchContentFromDb(body: any): Promise<string> {
    if (body.currentContent || body.articleContent) {
      return body.currentContent || body.articleContent;
    }
    
    if (body.articleId || body.freshdeskId) {
      const article = await this.prisma.article.findFirst({
        where: body.articleId 
          ? { id: body.articleId } 
          : { freshdeskId: body.freshdeskId.toString() }
      });
      if (!article) throw new NotFoundException('Artigo não encontrado no banco de dados');
      return article.description;
    }
    
    throw new Error('Forneça currentContent/articleContent ou articleId/freshdeskId');
  }

  @Post('update')
  async updateArticle(
    @Body() body: { currentContent?: string; articleId?: string; freshdeskId?: string; whatToChange?: string },
  ): Promise<UpdateArticleResult> {
    const content = await this.fetchContentFromDb(body);

    // Se nenhuma instrução específica foi fornecida, detecta os problemas automaticamente
    let instruction = body.whatToChange;
    if (!instruction) {
      const score = await this.aiService.scoreArticleQuality(content);
      const issues: string[] = score?.issues ?? [];
      instruction = issues.length > 0
        ? `Corrija os seguintes problemas detectados: ${issues.join('; ')}`
        : 'Revisar formatação e aplicar o guia de estilo Next Fit';
    }

    return this.aiService.updateArticle(content, instruction);
  }

  @Post('analyze-impact')
  async analyzeImpact(@Body() body: { productMessage: string }): Promise<AnalyzeImpactResult> {
    if (!body.productMessage) {
      throw new Error('Forneça a MENSAGEM DO TIME DE PRODUTO (productMessage)');
    }

    // 1. Gera o embedding da mensagem
    const embedding = await this.aiService.generateEmbedding(body.productMessage);

    // 2. Busca na base os 5 trechos mais relevantes para evitar dispersão e economizar contexto
    const similarChunks = await this.vectorDbService.semanticSearch(embedding, 5);

    if (!similarChunks.length) {
      return { affected_articles: [], summary: 'Nenhum contexto encontrado na base de conhecimento para essa mensagem.' };
    }

    // 3. Busca os títulos dos artigos correspondentes no banco para dar contexto melhor à IA
    const articleIds = [...new Set(similarChunks.map(c => c.articleId))];
    const articlesInDb = await this.prisma.article.findMany({
      where: { id: { in: articleIds } },
      select: { id: true, title: true }
    });

    // 4. Formata o contexto
    const articlesContext = similarChunks.map((chunk, idx) => {
      const article = articlesInDb.find(a => a.id === chunk.articleId);
      return `--- TRECHO ${idx + 1} ---\nArtigo ID: ${chunk.articleId}\nTítulo do Artigo: ${article?.title}\nConteúdo: ${chunk.content}\n`;
    }).join('\n');

    // 5. Pede pro Gemini fazer o cruzamento e análise crítica
    return this.aiService.analyzeImpact(body.productMessage, articlesContext);
  }

  @Post('analyze-style')
  async analyzeStyle(@Body() body: { articleContents: string[] }) {
    const analysis = await this.aiService.analyzeStyle(body.articleContents);
    return analysis;
  }

  @Post('quality-score')
  async qualityScore(
    @Body() body: { articleContent?: string; articleId?: string; freshdeskId?: string }
  ) {
    const content = await this.fetchContentFromDb(body);
    const score = await this.aiService.scoreArticleQuality(content);
    return score;
  }
}
