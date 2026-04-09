import { Injectable, Logger } from '@nestjs/common';

import { GoogleGenAI } from '@google/genai';
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
    this.cleanThinkingTags(text);
    const cleanText = text.replace(/<thinking>([\s\S]*?)<\/thinking>/, '').trim();

    const jsonMatch =
      cleanText.match(/```json\s*([\s\S]*?)\s*```/) || cleanText.match(/{[\s\S]*}/);
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
    const context = contextChunks.join('\n\n---\n\n');
    
    // O modelo Fine-Tunned (SFT) surta se o System Prompt for muito diferente do que ele viu no treino.
    // Usamos o system prompt original do treinamento.
    const systemInstruction = "Você é o redator oficial da Central de Ajuda da Next Fit. Geração de artigos técnicos. Seja conciso, use tom imperativo e estruture os passos em narrativa flúida sem listas numeradas.";

    const userPrompt = `
Gere APENAS 1 ÚNICO artigo sobre a intenção/PRD abaixo. 
Siga o tom da Next Fit. NUNCA resuma ou liste os artigos de referência do RAG.
Seu corpo de texto DEVE ser sobre a "Mensagem do Usuário".

[MENSAGEM DO USUÁRIO / PRD]
${prompt}

[ARTIGOS DE REFERÊNCIA ANTIGOS / VOCABULÁRIO RAG]
${context}
`;

    const result = await this.ai.models.generateContent({
      model: 'projects/548093153407/locations/us-central1/endpoints/8189391851850039296',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    const text = result.text ?? '';
    return this.cleanThinkingTags(text);
  }

  // ─── REVISÃO DE ARTIGO ──────────────────────────────────────────────
  async updateArticle(
    currentContent: string,
    whatToChange: string,
  ): Promise<UpdateArticleResult> {
    const result = await this.ai.models.generateContent({
      model: 'projects/548093153407/locations/us-central1/endpoints/8189391851850039296',
      contents: `ARTIGO ATUAL:\n${currentContent}\n\nALTERAÇÕES SOLICITADAS:\n${whatToChange}`,
      config: {
        systemInstruction: UPDATE_ARTICLE_SYSTEM_PROMPT,
        temperature: 0.2,
      },
    });

    const content = result.text;
    if (!content) {
      return { revised_content: '', changes_summary: [], style_violations_fixed: [], assumptions: [] };
    }
    return this.extractJson<UpdateArticleResult>(content);
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
      contents: 'Cruze as informações e retorne o JSON de impacto. Seja conservador: só inclua artigos com conteúdo diretamente desatualizado.',
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    const content = result.text;
    if (!content) {
      return { affected_articles: [], summary: 'Não foi possível analisar o impacto' };
    }
    return this.extractJson<AnalyzeImpactResult>(content);
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
      contents: 'Confirme ou descarte o impacto lendo o artigo completo. Seja rigoroso.',
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    const content = result.text;
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