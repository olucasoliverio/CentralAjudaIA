import { Injectable, Logger } from '@nestjs/common';

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  GENERATE_ARTICLE_SYSTEM_PROMPT,
  ANALYZE_STYLE_SYSTEM_PROMPT,
  UPDATE_ARTICLE_SYSTEM_PROMPT,
  QUALITY_SCORE_PROMPT,
  ANALYZE_IMPACT_SYSTEM_PROMPT,
} from './prompts';

export interface AnalyzeImpactResult {
  affected_articles: {
    articleId: string;
    title: string;
    impact: 'ALTO' | 'MEDIO' | 'BAIXO';
    reason: string;
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
      generationConfig: { temperature: 0.7 },
    });
    return result.response.text() || '';
  }

  // ─── REVISÃO DE ARTIGO VIA GEMINI ──────────────────────────────────
  async updateArticle(
    currentContent: string,
    whatToChange: string,
  ): Promise<UpdateArticleResult> {
    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-pro',
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
        responseMimeType: 'application/json',
      },
    });

    const content = result.response.text();
    if (!content) {
      return { revised_content: '', changes_summary: [], style_violations_fixed: [], assumptions: [] };
    }
    return JSON.parse(content) as UpdateArticleResult;
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
      generationConfig: { responseMimeType: 'application/json' },
    });
    
    const content = result.response.text();
    return content ? JSON.parse(content) : {};
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
      generationConfig: { responseMimeType: 'application/json' },
    });
    
    const content = result.response.text();
    return content ? JSON.parse(content) : {};
  }

  // ─── ANÁLISE DE IMPACTO DE PRODUTO ─────────────────────────────────
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
      contents: [{ role: 'user', parts: [{ text: 'Cruze as informações e me retorne o JSON de impacto.' }] }],
      generationConfig: { 
        temperature: 0.1,
        responseMimeType: 'application/json' 
      },
    });
    
    const content = result.response.text();
    if (!content) {
       return { affected_articles: [], summary: 'Não foi possível analisar o impacto' };
    }
    return JSON.parse(content) as AnalyzeImpactResult;
  }
}
