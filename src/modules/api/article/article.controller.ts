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
  ) { }

  @Post('generate')
  async generateArticle(@Body() body: { prompt: string }) {
    // 1. Embedding da intenção via Gemini (grátis)
    const promptEmbedding = await this.aiService.generateEmbedding(body.prompt);

    // 2. Busca semântica — 5 chunks resumidos como referência de vocabulário/estrutura
    const similarChunks = await this.vectorDbService.semanticSearch(promptEmbedding, 5);
    const context = similarChunks.map((c) => c.content);

    // 3. Geração com contexto RAG + Guia de Estilo Next Fit via Gemini
    const content = await this.aiService.generateArticleRAG(body.prompt, context);

    const articleIds = [...new Set(similarChunks.map(c => c.articleId))];
    const articlesDb = await this.prisma.article.findMany({
      where: { id: { in: articleIds } },
      select: { id: true, title: true }
    });

    return {
      generated_content: content,
      sources: articlesDb,
    };
  }

  @Post('search')
  async search(@Body() body: { query: string; topK?: number }) {
    if (!body.query) throw new Error('Forneça a query de busca.');
    
    // 1. O gargalo estava aqui: se a UI pedisse top 15, podiam vir só 15 chunks
    // que as vezes pertenciam apenas a 3 artigos. Vamos forçar um Recall profundo na base vetorial.
    const embedding = await this.aiService.generateEmbedding(body.query);
    const results = await this.vectorDbService.semanticSearch(embedding, 80); // Busca 80 chunks para varredura
    
    if (!results.length) return [];

    const articleIds = [...new Set(results.map(c => c.articleId))];
    const articlesDb = await this.prisma.article.findMany({
      where: { id: { in: articleIds } },
      select: { id: true, title: true }
    });

    // 2. Transforma em formato para o LLM avaliar
    const articlesContext = results.map((chunk, idx) => {
      const article = articlesDb.find(a => a.id === chunk.articleId);
      return `--- TRECHO ${idx + 1} ---\nArtigo ID: ${chunk.articleId}\nTítulo: ${article?.title ?? 'Desconhecido'}\nConteúdo do trecho: ${chunk.content}\n`;
    }).join('\n');

    // 3. Aplica o filtro de instrução via IA
    const agenticResult = await this.aiService.filterArticlesByInstruction(body.query, articlesContext);

    if (!agenticResult.filtered_articles || agenticResult.filtered_articles.length === 0) {
      return [];
    }

    // 4. Retorna no formato esperado pelo UI (`SearchResult[]`) e respeita o topK final
    const finalData = agenticResult.filtered_articles.map(f => {
      const article = articlesDb.find(a => a.id === f.articleId);
      const originalChunk = results.find(c => c.articleId === f.articleId);
      
      return {
        articleId: f.articleId,
        title: article?.title ?? 'Desconhecido',
        content: f.extracted_answer, // Substitui o chunk cru pela resposta/extração do LLM
        distance: originalChunk?.distance ?? 1
      };
    });

    return finalData.slice(0, body.topK || 15);
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
      
      // Early return se a qualidade já está alta e prioridade é baixa
      if (score?.score >= 8 && score?.priority === 'baixa') {
        return {
          revised_content: content,
          changes_summary: [`Artigo não necessita de revisão. Score: ${score.score}/10.`],
          style_violations_fixed: [],
          assumptions: []
        };
      }

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

    // 2. Busca recall profundo na base vetorial
    const similarChunks = await this.vectorDbService.semanticSearch(embedding, 80);

    if (!similarChunks.length) {
      return { affected_articles: [], summary: 'Nenhum contexto encontrado na base de conhecimento para essa mensagem.' };
    }

    // 3. Busca títulos e conteúdo dos artigos correspondentes
    const articleIds = [...new Set(similarChunks.map(c => c.articleId))];
    const articlesInDb = await this.prisma.article.findMany({
      where: { id: { in: articleIds } },
      select: { id: true, title: true, description: true }
    });

    // 4. Garante representação de todos os artigos únicos antes de cortar por tamanho
    // Estratégia: 1 chunk por artigo (o melhor) primeiro, depois preenche com demais até o limite
    const seenArticles = new Set<string>();
    const priorityChunks: typeof similarChunks = [];
    const restChunks: typeof similarChunks = [];

    for (const chunk of similarChunks) {
      if (!seenArticles.has(chunk.articleId)) {
        seenArticles.add(chunk.articleId);
        priorityChunks.push(chunk); // Primeiro chunk de cada artigo (mais relevante)
      } else {
        restChunks.push(chunk);
      }
    }

    // Combina: artigos únicos primeiro, depois chunks extras, limitado a 80k chars
    const MAX_CONTEXT_CHARS = 80_000;
    let totalChars = 0;
    const filteredChunks = [...priorityChunks, ...restChunks].filter(chunk => {
      if (totalChars >= MAX_CONTEXT_CHARS) return false;
      totalChars += chunk.content.length;
      return true;
    });

    // 5. Formata o contexto para o Passo 1 (inclui título junto ao trecho para melhor contexto)
    const articlesContext = filteredChunks.map((chunk, idx) => {
      const article = articlesInDb.find(a => a.id === chunk.articleId);
      return `--- TRECHO ${idx + 1} ---\nArtigo ID: ${chunk.articleId}\nTítulo: ${article?.title ?? 'Desconhecido'}\nConteúdo do trecho: ${chunk.content}\n`;
    }).join('\n');

    // 6. Passo 1: análise conservadora com os chunks
    const preliminaryResult = await this.aiService.analyzeImpact(body.productMessage, articlesContext);

    if (!preliminaryResult.affected_articles.length) {
      return preliminaryResult;
    }

    // 7. [MELHORIA #14] Passo 2: verificações em PARALELO usando Promise.allSettled
    // Antes: sequencial (5 artigos = ~30s). Agora: paralelo (~8s)
    const verificationTasks = preliminaryResult.affected_articles.map(async (candidate) => {
      const fullArticle = articlesInDb.find(a => a.id === candidate.articleId);

      // Se não tem artigo completo, mantém o candidato sem verificação
      if (!fullArticle?.description) {
        return { candidate, verification: null };
      }

      const verification = await this.aiService.verifyArticleImpact(
        body.productMessage,
        candidate.affected_excerpt ?? candidate.reason,
        candidate.reason,
        fullArticle.description,
      );

      return { candidate, verification };
    });

    const settledResults = await Promise.allSettled(verificationTasks);

    const verifiedArticles: AnalyzeImpactResult['affected_articles'] = [];

    for (const result of settledResults) {
      if (result.status === 'rejected') continue; // ignora falhas pontuais

      const { candidate, verification } = result.value;

      if (!verification) {
        // Sem artigo completo no DB — mantém o candidato original
        verifiedArticles.push(candidate);
        continue;
      }

      if (verification.confirmed) {
        verifiedArticles.push({
          ...candidate,
          reason: verification.reason,
          affected_excerpt: verification.affected_excerpt ?? candidate.affected_excerpt,
          suggested_update_instruction: verification.suggested_update_instruction ?? candidate.suggested_update_instruction,
          impact: verification.confidence === 'BAIXA' ? 'BAIXO' : candidate.impact,
        });
      }
    }

    // 8. Monta o resumo final
    let finalSummary = preliminaryResult.summary;
    if (verifiedArticles.length === 0) {
      finalSummary = `${preliminaryResult.summary}\n\n**Atualização Pós-Verificação:** Após a leitura profunda dos artigos completos, a IA revisora concluiu que nenhum deles possui desatualização crítica que demande alteração de texto.`;
    } else if (verifiedArticles.length < preliminaryResult.affected_articles.length) {
      finalSummary = `${preliminaryResult.summary}\n\n**Atualização Pós-Verificação:** Dos artigos citados neste resumo, apenas ${verifiedArticles.length} foram confirmados como críticos após a leitura completa. Os demais foram descartados por não conflitarem diretamente com a atualização.`;
    }

    return {
      affected_articles: verifiedArticles,
      summary: finalSummary,
    };
  }

  @Post('analyze-style')
  // [MELHORIA #11] Aceita agora articleId/freshdeskId além de conteúdo direto
  async analyzeStyle(@Body() body: {
    articleContents?: string[];
    articleId?: string;
    freshdeskId?: string;
  }) {
    let contents: string[] = [];

    if (body.articleContents?.length) {
      contents = body.articleContents;
    } else if (body.articleId || body.freshdeskId) {
      // Busca o artigo pelo ID e usa sua descrição (já em Markdown)
      const content = await this.fetchContentFromDb(body);
      contents = [content];
    } else {
      throw new Error('Forneça articleContents, articleId ou freshdeskId.');
    }

    const analysis = await this.aiService.analyzeStyle(contents);
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