import { Injectable, Logger } from '@nestjs/common';

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  GENERATE_ARTICLE_SYSTEM_PROMPT,
  ANALYZE_STYLE_SYSTEM_PROMPT,
  UPDATE_ARTICLE_SYSTEM_PROMPT,
  QUALITY_SCORE_PROMPT,
  ANALYZE_IMPACT_SYSTEM_PROMPT,
  VERIFY_IMPACT_SYSTEM_PROMPT,
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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private gemini: GoogleGenerativeAI;

  constructor() {
    this.gemini = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || 'dummy_key',
    );
  }

  // ─── EMBEDDINGS VIA GEMINI (CUSTO ZERO) ────────────────────────────
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.gemini.getGenerativeModel({
        model: 'gemini-embedding-001',
      });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      this.logger.error('Erro ao gerar embedding via Gemini', error);
      throw error;
    }
  }

  async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
    try {
      const model = this.gemini.getGenerativeModel({
        model: 'gemini-embedding-001',
      });
      const result = await model.batchEmbedContents({
        requests: texts.map((text) => ({
          content: { role: 'user', parts: [{ text }] },
        })),
      });
      return result.embeddings.map((e) => e.values);
    } catch (error) {
      this.logger.error('Erro ao gerar embeddings em batch via Gemini', error);
      throw error;
    }
  }

  // ─── GERAÇÃO DE ARTIGO RAG VIA GEMINI ──────────────────────────────
  async generateArticleRAG(
    prompt: string,
    contextChunks: string[],
  ): Promise<string> {
    const context = contextChunks.join('\n\n---\n\n');
    const systemMessage = GENERATE_ARTICLE_SYSTEM_PROMPT.replace(
      '{context}',
      context,
    );

    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-pro',
      systemInstruction: systemMessage,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    });

    const text = result.response.text() || '';
    return this.cleanThinkingTags(text);
  }

  // Helper para limpar tags de pensamento e extrair apenas o conteúdo final
  private cleanThinkingTags(text: string): string {
    const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/);
    if (thinkingMatch) {
      this.logger.debug(`AI Thought Process: ${thinkingMatch[1].trim()}`);
    }
    return text.replace(/<thinking>([\s\S]*?)<\/thinking>/, '').trim();
  }

  // Helper para extrair JSON de respostas que podem conter tags ou markdown
  private extractJson<T>(text: string): T {
    this.cleanThinkingTags(text); // Loga o pensamento no debug
    const cleanText = text.replace(/<thinking>([\s\S]*?)<\/thinking>/, '').trim();

    const jsonMatch = cleanText.match(/```json\s*([\s\S]*?)\s*```/) || cleanText.match(/{[\s\S]*}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]) as T;
      } catch (e) {
        this.logger.error(`Erro ao parsear JSON da IA: ${e.message}`, cleanText);
        throw e;
      }
    }
    throw new Error('Não foi possível encontrar um JSON válido na resposta da IA.');
  }

  // ─── REVISÃO DE ARTIGO VIA GEMINI ──────────────────────────────────
  async updateArticle(
    currentContent: string,
    whatToChange: string,
  ): Promise<UpdateArticleResult> {
    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: UPDATE_ARTICLE_SYSTEM_PROMPT,
    });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `ARTIGO ATUAL:\n${currentContent}\n\nALTERAÇÕES SOLICITADAS:\n${whatToChange}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    });

    const content = result.response.text();
    if (!content) {
      return { revised_content: '', changes_summary: [], style_violations_fixed: [], assumptions: [] };
    }
    return this.extractJson<UpdateArticleResult>(content);
  }

  // ─── ANÁLISE DE ESTILO / PADRÃO ───────────────────────────────────
  async analyzeStyle(contextChunks: string[]): Promise<any> {
    const context = contextChunks.join('\n\n---\n\n');
    const systemMessage = ANALYZE_STYLE_SYSTEM_PROMPT.replace(
      '{context}',
      context,
    );

    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemMessage,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Analise os artigos do contexto e forneça o JSON de avaliação.' }] }],
    });

    const content = result.response.text();
    return content ? this.extractJson<any>(content) : {};
  }

  // ─── QUALITY SCORING ───────────────────────────────────────────────
  async scoreArticleQuality(articleContent: string): Promise<any> {
    const systemInstruction = QUALITY_SCORE_PROMPT.replace('{article}', articleContent);

    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemInstruction,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Avalie este artigo de acordo com as instruções fornecidas e retorne um JSON.' }] }],
    });

    const content = result.response.text();
    return content ? this.extractJson<any>(content) : {};
  }

  // ─── ANÁLISE DE IMPACTO DE PRODUTO (Passo 1 — busca semântica) ─────
  async analyzeImpact(
    productMessage: string,
    articlesContext: string,
  ): Promise<AnalyzeImpactResult> {
    const systemInstruction = ANALYZE_IMPACT_SYSTEM_PROMPT
      .replace('{productMessage}', productMessage)
      .replace('{articlesContext}', articlesContext);

    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Cruze as informações e retorne o JSON de impacto. Seja conservador: só inclua artigos com conteúdo diretamente desatualizado.' }] }],
      generationConfig: {
        temperature: 0.1,
      },
    });

    const content = result.response.text();
    if (!content) {
      return { affected_articles: [], summary: 'Não foi possível analisar o impacto' };
    }
    return this.extractJson<AnalyzeImpactResult>(content);
  }

  // ─── VERIFICAÇÃO DE IMPACTO (Passo 2 — artigo completo) ────────────
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

    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Confirme ou descarte o impacto lendo o artigo completo. Seja rigoroso.' }] }],
      generationConfig: {
        temperature: 0.1,
      },
    });

    const content = result.response.text();
    if (!content) {
      return {
        confirmed: false,
        confidence: 'BAIXA',
        reason: 'Não foi possível verificar o impacto',
        affected_excerpt: null,
        suggested_update_instruction: null,
      };
    }
    return this.extractJson<VerifyImpactResult>(content);
  }
}