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

  // ─── Helper: Parse de Resumo de Impacto (XML/JSON) ──────────
  private parseImpactReport(text: string): AnalyzeImpactResult {
    const summaryMatch = text.match(/<summary>([\s\S]*?)<\/summary>/i);
    const articlesMatch = text.match(/<affected_articles>([\s\S]*?)<\/affected_articles>/i);

    const summary = summaryMatch ? summaryMatch[1].trim() : 'Sem resumo disponível.';
    const articlesJsonStr = articlesMatch ? articlesMatch[1].trim() : '[]';

    let affected_articles: AnalyzeImpactResult['affected_articles'] = [];

    try {
      const parsed = JSON.parse(articlesJsonStr);
      if (Array.isArray(parsed)) {
        affected_articles = parsed.map((item: any) => ({
          articleId: item.ARTICLE_ID || '0',
          title: item.TITLE || 'Sem título',
          impact: (item.IMPACT?.toUpperCase() || 'BAIXO') as any,
          reason: item.REASON || 'Sem motivo especificado.',
          affected_excerpt: item.EXCERPT,
          suggested_update_instruction: item.UPDATE_INSTRUCTION || 'Atualizar conforme PRD.',
        }));
      }
    } catch (e: any) {
      this.logger.error(`Failed to parse affected_articles JSON: ${e.message}`);
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
    // Monta contexto expandido — 1500 chars para capturar contexto técnico completo
    const context = contextChunks
      .map((chunk, i) => `[Referência ${i + 1}]\n${chunk.slice(0, 1500)}`)
      .join('\n\n---\n\n');

    const systemInstruction = GENERATE_ARTICLE_SYSTEM_PROMPT.replace('{context}', context);

    this.logger.log('Iniciando generateArticleRAG...');
    this.logger.debug(`Prompt original enviado: ${prompt}`);

    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `DADOS BRUTOS / PRD (fonte de verdade):\n${prompt}\n\n---\n\nINSTRUÇÃO: Gere um artigo completo para a Central de Ajuda Next Fit seguindo EXATAMENTE o padrão do guia de estilo. Baseie-se nas referências abaixo apenas para ESTRUTURA e VOCABULÁRIO, nunca para copiar paths ou regras de negócio. Tudo o que você precisa saber sobre a funcionalidade está nos DADOS BRUTOS acima.`,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    let text = result.text ?? '';
    const candidates = (result as any).candidates || [];
    if (!text && candidates.length > 0 && candidates[0].content?.parts?.length > 0) {
      text = candidates[0].content.parts.map((p: any) => p.text || '').join('');
    }

    this.logger.log(`Tamanho do texto retornado pelo LLM: ${text.length} caracteres`);
    this.logger.debug(`Texto Bruto LLM: ${text}`);

    if (!text || text.trim() === '') {
      this.logger.warn('⚠️ Gemini retornou texto VAZIO! Verifique os Safety filters ou falha do prompt.');
      return '';
    }

    // Remove bloco <thinking>
    const cleanText = this.cleanThinkingTags(text);
    const articleMatch = cleanText.match(/<article>([\s\S]*?)<\/article>/i);

    if (articleMatch) {
      const extracted = articleMatch[1].trim();
      this.logger.log(`Tamanho do extrato dentro de <article>: ${extracted.length} caracteres.`);
      if (extracted.length > 0) {
        return extracted;
      } else {
        this.logger.warn(`Tag <article> estava VAZIA! Retornando o cleanText bruto.`);
      }
    }

    return cleanText;
  }

  // ─── REVISÃO DE ARTIGO ──────────────────────────────────────────────
  async updateArticle(
    currentContent: string,
    whatToChange: string,
  ): Promise<UpdateArticleResult> {
    const systemInstruction = UPDATE_ARTICLE_SYSTEM_PROMPT;

    try {
      // Log COMPLETO estruturado do que será enviado ao Gemini
      this.logger.warn('╔════════════════════════════════════════════════════════════════════');
      this.logger.warn('║ INICIANDO REVISÃO DE ARTIGO (updateArticle)');
      this.logger.warn('╚════════════════════════════════════════════════════════════════════');

      this.logger.log(`📝 Tamanho do artigo: ${currentContent.length} caracteres`);
      this.logger.log(`📝 Tamanho da instrução: ${whatToChange.length} caracteres`);
      this.logger.log(`📝 Instrução solicitada: "${whatToChange}"`);

      const fullPrompt = `ARTIGO ATUAL:\n${currentContent}\n\nALTERAÇÕES SOLICITADAS:\n${whatToChange}\n\nINSTRUÇÃO: Aplique as alterações no artigo e retorne EXATAMENTE no formato de blocos <revised_content> e <metadata> definido nas instruções de sistema.`;
      this.logger.log(`📊 Tamanho total do prompt (artigo + instrução): ${fullPrompt.length} caracteres`);

      // PRIMEIRA TENTATIVA: com systemInstruction
      this.logger.log('🔄 Tentativa #1: Com systemInstruction');
      const result = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      // Acessa o texto corretamente na estrutura de resposta do Gemini
      const candidates = (result as any).candidates || [];
      let text = '';
      if (candidates.length > 0 && candidates[0].content?.parts?.length > 0) {
        text = candidates[0].content.parts[0].text || '';
      }

      // Log estruturado da resposta
      this.logger.warn('╔════════════════════════════════════════════════════════════════════');
      this.logger.warn('║ RESPOSTA RECEBIDA DO GEMINI');
      this.logger.warn('╚════════════════════════════════════════════════════════════════════');
      this.logger.log(`🔍 Tamanho do texto retornado: ${text.length} caracteres`);
      this.logger.log(`🔍 finishReason: ${candidates[0]?.finishReason}`);
      this.logger.log(`🔍 candidates.length: ${candidates.length}`);

      // SE RETORNOU VAZIO, TENTA SEGUNDA CHAMADA SEM systemInstruction
      if (!text) {
        this.logger.warn('⚠️  Gemini retornou vazio na tentativa #1. Tentando #2 SEM systemInstruction...');

        // Prompt simplificado e direto
        const simplifiedPrompt = `Você é um revisor de artigos especializado em documentação técnica.

Artigo atual:
${currentContent}

Alterações solicitadas:
${whatToChange}

Faça as alterações solicitadas no artigo e retorne EXATAMENTE neste formato:

<revised_content>
[artigo revisado completo]
</revised_content>

<metadata>
{"changes_summary": ["mudança 1", "mudança 2"], "style_violations_fixed": [], "assumptions": []}
</metadata>

Não adicione nenhum texto fora desses blocos.`;

        const result2 = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: simplifiedPrompt,
          config: {
            temperature: 0.2,
            // SEM systemInstruction nesta tentativa
          },
        });

        const candidates2 = (result2 as any).candidates || [];
        if (candidates2.length > 0 && candidates2[0].content?.parts?.length > 0) {
          text = candidates2[0].content.parts[0].text || '';
        }

        this.logger.log(`🔄 Tentativa #2 retornou: ${text.length > 0 ? `✅ ${text.length} caracteres` : '❌ vazio'}`);

        if (!text) {
          this.logger.error('❌ Ambas as tentativas retornaram vazio. Problema pode ser:');
          this.logger.error('   1. Safety filter do Gemini bloqueando conteúdo');
          this.logger.error('   2. Instrução confundindo o modelo');
          this.logger.error('   3. Problema na API do Vertex AI');
          this.logger.error(`Result keys: ${Object.keys(result).join(', ')}`);
          this.logger.error(`finishReason: ${candidates[0]?.finishReason}, ${candidates2[0]?.finishReason}`);
          return { revised_content: '', changes_summary: ['Falha ao processar revisão em ambas as tentativas'], style_violations_fixed: [], assumptions: [] };
        }
      }

      const cleanText = this.cleanThinkingTags(text);
      this.logger.debug(`Revisão bruta recebida: ${cleanText.slice(0, 200)}...`);

      // Extração robusta via delimitadores (insensível a case)
      let contentMatch: RegExpMatchArray | null = cleanText.match(/<revised_content>([\s\S]*?)<\/revised_content>/i);
      let revised_content = contentMatch?.[1]?.trim() ?? '';

      // Fallback robusto: se não encontrou delimitadores mas há conteúdo
      if (!revised_content && cleanText.length > 100) {
        this.logger.warn('Protocolo de blocos falhou, tentando fallback genérico bruto');
        revised_content = cleanText
          .replace(/<metadata>([\s\S]*?)<\/metadata>/i, '')
          .trim();

        if (!revised_content) {
          revised_content = cleanText;
        }
      }

      // Extrai metadados
      let metaMatch: RegExpMatchArray | null = cleanText.match(/<metadata>([\s\S]*?)<\/metadata>/i);
      const metaText = metaMatch?.[1]?.trim() ?? '{}';

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
      };
    } catch (e: unknown) {
      const error = e as Error;
      this.logger.error('Erro ao chamar Gemini para updateArticle:', error?.message || String(e));
      return {
        revised_content: '',
        changes_summary: ['Erro ao conectar com a IA. Verifique as credenciais da Google Cloud.'],
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

    const evalMatch = cleanText.match(/<evaluation>([\s\S]*?)<\/evaluation>/i);
    const evalText = evalMatch ? evalMatch[1].trim() : cleanText;

    let evaluation: any = { confirmed: false, confidence: 'BAIXA' };
    try {
      evaluation = this.extractJson<any>(evalText);
    } catch {
      this.logger.error('Failed to parse evaluation JSON');
    }

    return {
      confirmed: evaluation.confirmed ?? false,
      confidence: evaluation.confidence ?? 'BAIXA',
      reason: evaluation.reason ?? 'Sem explicação.',
      affected_excerpt: evaluation.excerpt ?? null,
      suggested_update_instruction: evaluation.instruction ?? null,
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