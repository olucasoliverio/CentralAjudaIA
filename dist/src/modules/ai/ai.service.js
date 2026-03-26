"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const generative_ai_1 = require("@google/generative-ai");
const prompts_1 = require("./prompts");
let AiService = AiService_1 = class AiService {
    logger = new common_1.Logger(AiService_1.name);
    gemini;
    constructor() {
        this.gemini = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');
    }
    async generateEmbedding(text) {
        try {
            const model = this.gemini.getGenerativeModel({
                model: 'gemini-embedding-001',
            });
            const result = await model.embedContent(text);
            return result.embedding.values;
        }
        catch (error) {
            this.logger.error('Erro ao gerar embedding via Gemini', error);
            throw error;
        }
    }
    async generateEmbeddingBatch(texts) {
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
        }
        catch (error) {
            this.logger.error('Erro ao gerar embeddings em batch via Gemini', error);
            throw error;
        }
    }
    async generateArticleRAG(prompt, contextChunks) {
        const context = contextChunks.join('\n\n---\n\n');
        const systemMessage = prompts_1.GENERATE_ARTICLE_SYSTEM_PROMPT.replace('{context}', context);
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
    async updateArticle(currentContent, whatToChange) {
        const model = this.gemini.getGenerativeModel({
            model: 'gemini-2.5-pro',
            systemInstruction: prompts_1.UPDATE_ARTICLE_SYSTEM_PROMPT,
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
        return JSON.parse(content);
    }
    async analyzeStyle(contextChunks) {
        const context = contextChunks.join('\n\n---\n\n');
        const systemMessage = prompts_1.ANALYZE_STYLE_SYSTEM_PROMPT.replace('{context}', context);
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
    async scoreArticleQuality(articleContent) {
        const systemInstruction = prompts_1.QUALITY_SCORE_PROMPT.replace('{article}', articleContent);
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
    async analyzeImpact(productMessage, articlesContext) {
        const systemInstruction = prompts_1.ANALYZE_IMPACT_SYSTEM_PROMPT
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
        return JSON.parse(content);
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AiService);
//# sourceMappingURL=ai.service.js.map