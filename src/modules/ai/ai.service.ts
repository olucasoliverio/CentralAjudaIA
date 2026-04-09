import { Injectable, Logger } from '@nestjs/common';

import { GoogleGenAI } from '@google/genai';
import {
  GENERATE_ARTICLE_SYSTEM_PROMPT,
  ANALYZE_STYLE_SYSTEM_PROMPT,
  UPDATE_ARTICLE_SYSTEM_PROMPT,
  QUALITY_SCORE_PROMPT,
  ANALYZE_IMPACT_SYSTEM_PROMPT,
  VERIFY_IMPACT_SYSTEM_PROMPT,
  AGENTIC_SEARCH_SYSTEM_PROMPT,
} from './prompts';

export interface AnalyzeImpactResult {
  affected_articles: {
    articleId: string;
    title: string;
    impact: 'ALTO' | 'MEDIO' | 'BAIXO';
    reason: string;
    affected_excerpt?: string;
    suggested_update_instruction: string;
  }[];
  summary: string;
}

export interface UpdateArticleResult {
  revised_content: string;
  changes_summary: string[];
  style_violations_fixed: string[];
  assumptions: string[];
}

export interface VerifyImpactResult {
  confirmed: boolean;
  confidence: 'ALTA' | 'MEDIA' | 'BAIXA';
  reason: string;
  affected_excerpt: string | null;
  suggested_update_instruction: string | null;
}

export interface AgenticSearchResult {
  filtered_articles: {
    articleId: string;
    extracted_answer: string;
  }[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    });
  }

  // ─── Helper: limpar tags de pensamento ─────────────────────────────
  private cleanThinkingTags(text: string): string {
    const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/);
    if (thinkingMatch) {
      this.logger.debug(`AI Thought Process: ${thinkingMatch[1].trim()}`);
    }
    return text.replace(/<thinking>([\s\S]*?)<\/thinking>/, '').trim();
  }

  // ─── Helper: extrair JSON de resposta da IA ─────────────────────────
  private extractJson<T>(text: string): T {
    // Loga o <thinking> e retorna o texto sem ele
    const cleanText = this.cleanThinkingTags(text);

    const jsonMatch =
      cleanText.match(/```json\s*([\s\S]*?)\s*```/) || cleanText.match(/{[\s\S]*}/);
    if (jsonMatch) {
      try {
        let jsonString = jsonMatch[1] || jsonMatch[0];
        // Remove escape sequences inválidas que o LLM usa para Markdown dentro de JSON
        jsonString = jsonString.replace(/\\([^"\\\/bfnrtu])/g, '$1');

        return JSON.parse(jsonString) as T;
      } catch (e) {
        this.logger.error(`Erro ao parsear JSON da IA: ${e.message}`, cleanText);
        throw e;
      }
    }
    throw new Error('Não foi possível encontrar um JSON válido na resposta da IA.');
  }

  // ─── Helper: Parse de Resumo de Impacto (Texto Estruturado) ──────────
  private parseImpactReport(text: string): AnalyzeImpactResult {
    const summaryMatch = text.match(/---SUMMARY_START---([\s\S]*?)---SUMMARY_END---/);
    const articlesMatch = text.match(/---AFFECTED_ARTICLES_START---([\s\S]*?)---AFFECTED_ARTICLES_END---/);

    const summary = summaryMatch ? summaryMatch[1].trim() : 'Sem resumo disponível.';
    const articlesText = articlesMatch ? articlesMatch[1].trim() : '';

    const affected_articles: AnalyzeImpactResult['affected_articles'] = [];

    if (articlesText) {
      const blocks = articlesText.split('---').map(b => b.trim()).filter(Boolean);
      for (const block of blocks) {
        const idMatch = block.match(/ARTICLE_ID:\s*(.*)/);
        const titleMatch = block.match(/TITLE:\s*(.*)/);
        const impactMatch = block.match(/IMPACT:\s*(.*)/);
        const reasonMatch = block.match(/REASON:\s*([\s\S]*?)(?=EXCERPT:|$)/);
        const excerptMatch = block.match(/EXCERPT:\s*([\s\S]*?)(?=UPDATE_INSTRUCTION:|$)/);
        const instrMatch = block.match(/UPDATE_INSTRUCTION:\s*([\s\S]*?)$/);

        if (idMatch) {
          affected_articles.push({
            articleId: idMatch[1].trim(),
            title: titleMatch ? titleMatch[1].trim() : 'Sem título',
            impact: (impactMatch ? impactMatch[1].trim().toUpperCase() : 'BAIXO') as any,
            reason: reasonMatch ? reasonMatch[1].trim() : 'Sem motivo especificado.',
            affected_excerpt: excerptMatch ? excerptMatch[1].trim() : undefined,
            suggested_update_instruction: instrMatch ? instrMatch[1].trim() : 'Atualizar conforme PRD.',
          });
        }
      }
    }

    return { summary, affected_articles };
  }

  // ─── EMBEDDINGS VIA VERTEX AI (text-multilingual-embedding-002) ────
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.ai.models.embedContent({
        model: 'text-multilingual-embedding-002',
        contents: text,
      });
      return result.embeddings?.[0]?.values ?? [];
    } catch (error) {
      this.logger.error('Erro ao gerar embedding via Vertex AI', error);
      throw error;
    }
  }

  async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
    try {
      const results = await Promise.all(
        texts.map((text) =>
          this.ai.models.embedContent({
            model: 'text-multilingual-embedding-002',
            contents: text,
          }),
        ),
      );
      return results.map((r) => r.embeddings?.[0]?.values ?? []);
    } catch (error) {
      this.logger.error('Erro ao gerar embeddings em batch via Vertex AI', error);
      throw error;
    }
  }

  // ─── GERAÇÃO DE ARTIGO RAG ──────────────────────────────────────────
  async generateArticleRAG(prompt: string, contextChunks: string[]): Promise<string> {
    // Monta contexto resumido — evita dump de artigos completos com imagens
    const context = contextChunks
      .map((chunk, i) => `[Referência ${i + 1}]\n${chunk.slice(0, 600)}`)
      .join('\n\n---\n\n');

    const systemInstruction = GENERATE_ARTICLE_SYSTEM_PROMPT.replace('{context}', context);

    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Escreva um artigo completo para a Central de Ajuda Next Fit com base nesta PRD/instrução:\n\n${prompt}`,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const text = result.text ?? '';
    // Remove bloco <thinking> e retorna apenas o artigo em Markdown
    return this.cleanThinkingTags(text);
  }

  // ─── REVISÃO DE ARTIGO ──────────────────────────────────────────────
  async updateArticle(
    currentContent: string,
    whatToChange: string,
  ): Promise<UpdateArticleResult> {
    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `ARTIGO ATUAL:\n${currentContent}\n\nALTERAÇÕES SOLICITADAS:\n${whatToChange}`,
      config: {
        systemInstruction: UPDATE_ARTICLE_SYSTEM_PROMPT,
        temperature: 0.2,
      },
    });

    const text = result.text;
    if (!text) {
      return { revised_content: '', changes_summary: [], style_violations_fixed: [], assumptions: [] };
    }

    // Extração robusta via delimitadores para evitar quebras de JSON.parse com Markdown longo
    const contentMatch = text.match(/---CONTENT_START---([\s\S]*?)---CONTENT_END---/);
    const metaMatch = text.match(/---META_START---([\s\S]*?)---META_END---/);

    const revised_content = contentMatch ? contentMatch[1].trim() : '';
    const metaText = metaMatch ? metaMatch[1].trim() : '{}';

    try {
      const meta = this.extractJson<any>(metaText);
      return {
        revised_content,
        changes_summary: meta.changes_summary ?? [],
        style_violations_fixed: meta.style_violations_fixed ?? [],
        assumptions: meta.assumptions ?? [],
      };
    } catch (e) {
      this.logger.error(`Erro ao processar metadados da revisão: ${e.message}`);
      return {
        revised_content,
        changes_summary: ['A revisão foi aplicada, mas houve um erro ao processar o resumo das mudanças.'],
        style_violations_fixed: [],
        assumptions: [],
      };
    }
  }

  // ─── ANÁLISE DE ESTILO / PADRÃO ────────────────────────────────────
  async analyzeStyle(contextChunks: string[]): Promise<any[]> {
    const systemInstruction = ANALYZE_STYLE_SYSTEM_PROMPT;

    const results = await Promise.all(
      contextChunks.map(async (content) => {
        const result = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Artigo a ser analisado:\n\n${content}`,
          config: { systemInstruction },
        });
        const text = result.text;
        return text ? this.extractJson<any>(text) : {};
      })
    );

    return results;
  }

  // ─── QUALITY SCORING ───────────────────────────────────────────────
  async scoreArticleQuality(articleContent: string): Promise<any> {
    const systemInstruction = QUALITY_SCORE_PROMPT;

    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Avalie este artigo de acordo com as instruções fornecidas e retorne um JSON.\n\nArtigo:\n${articleContent}`,
      config: { systemInstruction },
    });

    const content = result.text;
    return content ? this.extractJson<any>(content) : {};
  }

  // ─── ANÁLISE DE IMPACTO DE PRODUTO (Passo 1) ───────────────────────
  async analyzeImpact(
    productMessage: string,
    articlesContext: string,
  ): Promise<AnalyzeImpactResult> {
    const systemInstruction = ANALYZE_IMPACT_SYSTEM_PROMPT
      .replace('{productMessage}', productMessage)
      .replace('{articlesContext}', articlesContext);

    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Cruze as informações e retorne o relatório de impacto seguindo estritamente os delimitadores definidos.',
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    const text = result.text;
    if (!text) {
      return { affected_articles: [], summary: 'Não foi possível analisar o impacto' };
    }
    
    return this.parseImpactReport(text);
  }

  // ─── VERIFICAÇÃO DE IMPACTO (Passo 2) ─────────────────────────────
  async verifyArticleImpact(
    productMessage: string,
    affectedExcerpt: string,
    preliminaryReason: string,
    fullArticleContent: string,
  ): Promise<VerifyImpactResult> {
    const systemInstruction = VERIFY_IMPACT_SYSTEM_PROMPT
      .replace('{productMessage}', productMessage)
      .replace('{affectedExcerpt}', affectedExcerpt)
      .replace('{preliminaryReason}', preliminaryReason)
      .replace('{fullArticleContent}', fullArticleContent);

    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Confirme ou descarte o impacto lendo o artigo completo. Siga os delimitadores para retorno.',
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    const text = result.text;
    if (!text) {
      return {
        confirmed: false,
        confidence: 'BAIXA',
        reason: 'Não foi possível verificar o impacto',
        affected_excerpt: null,
        suggested_update_instruction: null,
      };
    }

    const metaMatch = text.match(/---META_START---([\s\S]*?)---META_END---/);
    const reasonMatch = text.match(/---REASON_START---([\s\S]*?)---REASON_END---/);
    const excerptMatch = text.match(/---EXCERPT_START---([\s\S]*?)---EXCERPT_END---/);
    const instrMatch = text.match(/---INSTRUCTION_START---([\s\S]*?)---INSTRUCTION_END---/);

    const metaText = metaMatch ? metaMatch[1].trim() : '{"confirmed":false}';
    let meta: any = { confirmed: false, confidence: 'BAIXA' };
    try {
      meta = this.extractJson<any>(metaText);
    } catch { /* ignora erro de meta, usa default */ }

    return {
      confirmed: meta.confirmed ?? false,
      confidence: meta.confidence ?? 'BAIXA',
      reason: reasonMatch ? reasonMatch[1].trim() : 'Sem explicação.',
      affected_excerpt: excerptMatch ? excerptMatch[1].trim() : null,
      suggested_update_instruction: instrMatch ? instrMatch[1].trim() : null,
    };
  }

  // ─── BUSCA AGÊNTICA ─────────────────────────────────────────────
  async filterArticlesByInstruction(
    userInstruction: string,
    articlesContext: string,
  ): Promise<AgenticSearchResult> {
    const systemInstruction = AGENTIC_SEARCH_SYSTEM_PROMPT
      .replace('{userInstruction}', userInstruction)
      .replace('{articlesCandidates}', articlesContext);

    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Avalie os artigos com base na instrução requerida.',
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    const content = result.text;
    if (!content) {
      return { filtered_articles: [] };
    }
    
    return this.extractJson<AgenticSearchResult>(content);
  }
}