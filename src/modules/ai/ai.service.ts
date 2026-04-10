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
    const systemInstruction = UPDATE_ARTICLE_SYSTEM_PROMPT;

    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `ARTIGO ATUAL:\n${currentContent}\n\nALTERAÇÕES SOLICITADAS:\n${whatToChange}\n\nINSTRUÇÃO: Aplique as alterações no artigo e retorne EXATAMENTE no formato de blocos ---CONTENT_START--- e ---META_START--- definido nas instruções de sistema.`,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const text = result.text;
    if (!text) {
      this.logger.warn('Gemini retornou texto vazio no updateArticle.');
      return { revised_content: '', changes_summary: [], style_violations_fixed: [], assumptions: [] };
    }

    const cleanText = this.cleanThinkingTags(text);
    this.logger.debug(`Revisão bruta recebida: ${cleanText.slice(0, 200)}...`);
    
    // Extração robusta via delimitadores (insensível a case)
    // Tenta múltiplas variações de regex para ser mais tolerante
    let contentMatch = cleanText.match(/---CONTENT_START---([\s\S]*?)---CONTENT_END---/i);
    if (!contentMatch) {
      // Fallback: tenta com quebras de linha diferentes
      contentMatch = cleanText.match(/---CONTENT_START---\n([\s\S]*?)\n---CONTENT_END---/i);
    }
    if (!contentMatch) {
      // Fallback: tenta sem os traços
      contentMatch = cleanText.match(/CONTENT_START([\s\S]*?)CONTENT_END/i);
    }

    let revised_content = contentMatch ? contentMatch[1].trim() : '';
    
    // Fallback robusto: se não encontrou delimitadores mas há conteúdo,
    // tenta extrair a parte que parece Markdown (começa com # ou está entre META_END e fim)
    if (!revised_content && cleanText.length > 100) {
      this.logger.warn('Protocolo de blocos falhou, tentando fallback inteligente');
      
      // Tenta extrair tudo após META_END (que é o último bloco)
      const metaEndIdx = cleanText.indexOf('---META_END---');
      if (metaEndIdx > -1) {
        // Há conteúdo antes do META_END, que é o artigo revisado
        const beforeMetaEnd = cleanText.substring(0, metaEndIdx);
        const contentEndIdx = beforeMetaEnd.lastIndexOf('---CONTENT_END---');
        if (contentEndIdx > -1) {
          const contentStartIdx = beforeMetaEnd.lastIndexOf('---CONTENT_START---');
          if (contentStartIdx > -1) {
            revised_content = beforeMetaEnd.substring(contentStartIdx + '---CONTENT_START---'.length, contentEndIdx).trim();
          }
        }
      }
      
      // Último fallback: se ainda assim não encontrou, usa todo o cleanText
      // mas remove blocos de metadados
      if (!revised_content) {
        this.logger.warn('Usando fallback final: texto bruto sem delimitadores');
        revised_content = cleanText
          .replace(/---META_START---([\s\S]*?)---META_END---/i, '')
          .replace(/---CONTENT_START---([\s\S]*?)---CONTENT_END---/i, '')
          .trim();
        // Se ainda está vazio, usa tudo
        if (!revised_content) {
          revised_content = cleanText;
        }
      }
    }

    // Extrai metadados
    let metaMatch = cleanText.match(/---META_START---([\s\S]*?)---META_END---/i);
    if (!metaMatch) {
      metaMatch = cleanText.match(/---META_START---\n([\s\S]*?)\n---META_END---/i);
    }
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
        changes_summary: revised_content 
          ? ['A revisão foi aplicada, mas houve um erro ao processar o resumo das mudanças.']
          : ['Erro: O modelo não retornou conteúdo válido.'],
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
    const systemInstruction = ANALYZE_IMPACT_SYSTEM_PROMPT;

    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `MENSAGEM DE PRODUTO:\n${productMessage}\n\nCONTEXTO DE ARTIGOS:\n${articlesContext}\n\nINSTRUÇÃO: Cruze as informações acima e retorne o relatório de impacto seguindo estritamente os delimitadores definidos.`,
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    const text = result.text;
    
    if (!text) {
      this.logger.warn('Gemini retornou texto vazio na análise de impacto.');
      return { affected_articles: [], summary: 'Não foi possível analisar o impacto' };
    }
    
    const cleanText = this.cleanThinkingTags(text);
    this.logger.debug(`Relatório de impacto bruto: ${cleanText}`);
    
    return this.parseImpactReport(cleanText);
  }

  // ─── VERIFICAÇÃO DE IMPACTO (Passo 2) ─────────────────────────────
  async verifyArticleImpact(
    productMessage: string,
    affectedExcerpt: string,
    preliminaryReason: string,
    fullArticleContent: string,
  ): Promise<VerifyImpactResult> {
    const systemInstruction = VERIFY_IMPACT_SYSTEM_PROMPT;

    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `MENSAGEM DE PRODUTO:\n${productMessage}\n\nANÁLISE PRELIMINAR:\n- Trecho em alerta: ${affectedExcerpt}\n- Motivo preliminar: ${preliminaryReason}\n\nCONTEÚDO COMPLETO DO ARTIGO:\n${fullArticleContent}\n\nINSTRUÇÃO: Confirme ou descarte o impacto lendo o artigo completo. Siga os delimitadores para retorno.`,
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    const text = result.text;
    if (!text) {
      this.logger.warn('Gemini retornou texto vazio na verificação de impacto.');
      return {
        confirmed: false,
        confidence: 'BAIXA',
        reason: 'Não foi possível verificar o impacto',
        affected_excerpt: null,
        suggested_update_instruction: null,
      };
    }

    const cleanText = this.cleanThinkingTags(text);
    this.logger.debug(`Verificação de impacto bruta: ${cleanText}`);

    const metaMatch = cleanText.match(/---META_START---([\s\S]*?)---META_END---/);
    const reasonMatch = cleanText.match(/---REASON_START---([\s\S]*?)---REASON_END---/);
    const excerptMatch = cleanText.match(/---EXCERPT_START---([\s\S]*?)---EXCERPT_END---/);
    const instrMatch = cleanText.match(/---INSTRUCTION_START---([\s\S]*?)---INSTRUCTION_END---/);

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