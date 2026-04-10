import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

export interface RagCtxChunk {
  articleId: string;
  title: string;
  content: string;
  distance: number;
  recencyScore: number;
  isGolden: boolean;
  finalScore: number;
  category: string | null;
  tags: string[];
}

export interface RagContext {
  chunks: RagCtxChunk[];
  formattedContext: string;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  // IDs das golden articles (referência de qualidade)
  private readonly GOLDEN_ARTICLE_IDS = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {
    // Inicializa golden articles (podem ser carregados de um config, DB, ou ENV)
    this.loadGoldenArticles();
  }

  private async loadGoldenArticles() {
    try {
      // TODO: Carregar de config ou de uma tabela de metadata
      // Por agora, vazio — pode ser populado manualmente
      this.logger.log('Golden articles carregadas.');
    } catch (error) {
      this.logger.warn('Erro ao carregar golden articles', error);
    }
  }

  /**
   * Obtém contexto RAG com re-ranking inteligente
   * - Busca 20 chunks por relevância semântica
   * - Re-ranking por: distância, recência, tamanho, golden status
   * - Agrupa por artigo e seleciona melhor chunk por artigo
   */
  async buildContext(query: string, topK: number = 5): Promise<RagContext> {
    try {
      // 1. Gera embedding do query
      const queryEmbedding = await this.aiService.generateEmbedding(query);

      // 2. Busca 20 chunks (recall amplo)
      const candidates = await this.semanticSearchWithMetadata(queryEmbedding, 20);

      if (candidates.length === 0) {
        this.logger.warn('Nenhum chunk encontrado no RAG');
        return {
          chunks: [],
          formattedContext: '[Sem artigos similares na base de conhecimento]',
        };
      }

      // 3. Re-ranking com scoring multi-critério
      const scoredChunks = candidates.map((chunk) => {
        const score = this.calculateRelevanceScore(chunk);
        return { ...chunk, finalScore: score };
      });

      // 4. Agrupa por artigo e seleciona melhor chunk por artigo
      const groupedByArticle = this.groupAndSelectTopChunks(scoredChunks);

      // 5. Ordena pelo score final e limita ao topK
      const topChunks = groupedByArticle
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, topK);

      // 6. Formata contexto para o prompt
      const formattedContext = this.formatContextForPrompt(topChunks);

      this.logger.debug(
        `RAG: Selecionados ${topChunks.length}/${candidates.length} chunks após re-ranking`,
      );

      return {
        chunks: topChunks,
        formattedContext,
      };
    } catch (error) {
      this.logger.error('Erro ao construir contexto RAG', error);
      throw error;
    }
  }

  /**
   * Busca chunks com metadados de artigo (para re-ranking)
   */
  private async semanticSearchWithMetadata(
    embedding: number[],
    topK: number,
  ): Promise<RagCtxChunk[]> {
    const formattedEmbedding = `[${embedding.join(',')}]`;

    const results = await this.prisma.$queryRawUnsafe<
      Array<{
        articleId: string;
        title: string;
        content: string;
        distance: number;
        freshdeskUpdatedAt: Date | null;
        category: string | null;
        tags: string[];
      }>
    >(
      `SELECT 
        c."articleId", 
        a.title, 
        c.content, 
        (embedding <=> $1::vector) as distance,
        a."freshdeskUpdatedAt",
        a.category,
        a.tags
       FROM chunks c
       JOIN articles a ON c."articleId" = a.id
       ORDER BY distance ASC
       LIMIT $2`,
      formattedEmbedding,
      topK,
    );

    return results.map((r) => ({
      articleId: r.articleId,
      title: r.title,
      content: r.content,
      distance: r.distance,
      recencyScore: this.calculateRecencyScore(r.freshdeskUpdatedAt),
      isGolden: this.GOLDEN_ARTICLE_IDS.has(r.articleId) || r.tags?.includes('golden'),
      finalScore: 0, // Será calculado depois
      category: r.category,
      tags: r.tags || [],
    }));
  }

  /**
   * Scoring multi-critério: combina distância, recência e golden status
   */
  private calculateRelevanceScore(chunk: RagCtxChunk): number {
    // Normaliza distância (quanto menor, melhor)
    // Distance no cos similarity varia de 0 (idêntico) a 2 (oposto)
    const semanticScore = Math.max(0, 1 - chunk.distance / 2); // 0-1, onde 1 é melhor
    const recencyBoost = chunk.recencyScore; // 0-0.2 boost
    const goldenBoost = chunk.isGolden ? 0.15 : 0; // 15% boost se golden

    const finalScore = semanticScore * 0.7 + recencyBoost + goldenBoost;
    return finalScore;
  }

  /**
   * Calcula score de recência (artigos mais novos recebem boost)
   * Escala: último mês = 0.2, decresce para 0 após 6 meses
   */
  private calculateRecencyScore(updatedAt: Date | null): number {
    if (!updatedAt) return 0;

    const ageMs = Date.now() - new Date(updatedAt).getTime();
    const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000);

    // Boost linear: 0.2 no primeiro mês, 0 após 6 meses
    if (ageMonths <= 1) return 0.2;
    if (ageMonths >= 6) return 0;
    return 0.2 * (1 - ageMonths / 6);
  }

  /**
   * Agrupa chunks por artigo e seleciona o melhor chunk por artigo
   * Evita dominar contexto com múltiplos chunks do mesmo artigo
   */
  private groupAndSelectTopChunks(
    scoredChunks: RagCtxChunk[],
  ): RagCtxChunk[] {
    const grouped = new Map<string, RagCtxChunk[]>();

    for (const chunk of scoredChunks) {
      if (!grouped.has(chunk.articleId)) {
        grouped.set(chunk.articleId, []);
      }
      grouped.get(chunk.articleId)!.push(chunk);
    }

    // Seleciona o melhor chunk de cada artigo
    const bestChunks: RagCtxChunk[] = [];
    for (const [, chunks] of grouped) {
      chunks.sort((a, b) => b.finalScore - a.finalScore);
      bestChunks.push(chunks[0]);
    }

    return bestChunks;
  }

  /**
   * Formata chunks para inserir no sistema de prompt da IA
   */
  private formatContextForPrompt(chunks: RagCtxChunk[]): string {
    if (chunks.length === 0) {
      return '[Nenhum artigo similar encontrado para usar como referência]';
    }

    return chunks
      .map((chunk, idx) => {
        const goldenLabel = chunk.isGolden ? ' [GOLDEN]' : '';
        const scoreLabel = `(relevância: ${(chunk.finalScore * 100).toFixed(0)}%)`;
        const categoryLabel = chunk.category ? `\n<article_category>${chunk.category}</article_category>` : '';
        const tagsLabel = chunk.tags.length > 0 ? `\n<article_tags>${chunk.tags.join(', ')}</article_tags>` : '';
        return (
          `<rag_reference index="${idx + 1}"${chunk.isGolden ? ' golden="true"' : ''}>\n` +
          `<article_title>${chunk.title}${goldenLabel}</article_title>\n` +
          `<article_id>${chunk.articleId}</article_id>` +
          categoryLabel +
          tagsLabel +
          `\n<relevance_score>${scoreLabel}</relevance_score>\n` +
          `<content>\n${chunk.content.slice(0, 800)}\n</content>\n` +
          `</rag_reference>`
        );
      })
      .join('\n\n');
  }

  /**
   * Extrai links markdown do tipo [texto](slug-ou-url) do artigo
   * Usado para descobrir artigos relacionados que podem ser impactados
   */
  extractLinksFromArticle(content: string): string[] {
    // Regex para [texto](url) em markdown
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links: string[] = [];
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const [, text, url] = match;
      // Remove https://... para pegar só a parte relevante
      const slug = url.replace(/^https?:\/\/[^/]+\/(pt-BR\/)?/i, '').replace(/\?.*/, '');
      if (slug && slug.length > 0 && !slug.startsWith('http')) {
        links.push(slug);
      }
    }

    return [...new Set(links)]; // Remove duplicatas
  }

  /**
   * Encontra artigos pelo padrão do slug/título
   * Usado para resolver links mencionados na análise
   */
  async findArticlesByPattern(pattern: string): Promise<RagCtxChunk[]> {
    const articles = await this.prisma.article.findMany({
      where: {
        OR: [
          { title: { contains: pattern, mode: 'insensitive' } },
          { description: { contains: pattern, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        tags: true,
        freshdeskUpdatedAt: true,
      },
      take: 3, // Top 3 matches
    });

    return articles.map((a) => ({
      articleId: a.id,
      title: a.title,
      content: a.description.slice(0, 1000), // Primeiro 1000 chars
      distance: 0, // Não é busca semântica
      recencyScore: this.calculateRecencyScore(a.freshdeskUpdatedAt),
      isGolden: this.GOLDEN_ARTICLE_IDS.has(a.id) || a.tags?.includes('golden'),
      finalScore: 0.8, // Boost por ser descoberto via link
      category: a.category,
      tags: a.tags || [],
    }));
  }
}
