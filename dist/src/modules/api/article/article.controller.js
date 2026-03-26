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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArticleController = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("../../ai/ai.service");
const vector_db_service_1 = require("../../vector-db/vector-db.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
let ArticleController = class ArticleController {
    aiService;
    vectorDbService;
    prisma;
    constructor(aiService, vectorDbService, prisma) {
        this.aiService = aiService;
        this.vectorDbService = vectorDbService;
        this.prisma = prisma;
    }
    async generateArticle(body) {
        const promptEmbedding = await this.aiService.generateEmbedding(body.prompt);
        const similarChunks = await this.vectorDbService.semanticSearch(promptEmbedding, 5);
        const context = similarChunks.map((c) => c.content);
        const content = await this.aiService.generateArticleRAG(body.prompt, context);
        return {
            generated_content: content,
            sources: similarChunks.map((c) => c.articleId),
        };
    }
    async fetchContentFromDb(body) {
        if (body.currentContent || body.articleContent) {
            return body.currentContent || body.articleContent;
        }
        if (body.articleId || body.freshdeskId) {
            const article = await this.prisma.article.findFirst({
                where: body.articleId
                    ? { id: body.articleId }
                    : { freshdeskId: body.freshdeskId.toString() }
            });
            if (!article)
                throw new common_1.NotFoundException('Artigo não encontrado no banco de dados');
            return article.description;
        }
        throw new Error('Forneça currentContent/articleContent ou articleId/freshdeskId');
    }
    async updateArticle(body) {
        const content = await this.fetchContentFromDb(body);
        let instruction = body.whatToChange;
        if (!instruction) {
            const score = await this.aiService.scoreArticleQuality(content);
            const issues = score?.issues ?? [];
            instruction = issues.length > 0
                ? `Corrija os seguintes problemas detectados: ${issues.join('; ')}`
                : 'Revisar formatação e aplicar o guia de estilo Next Fit';
        }
        return this.aiService.updateArticle(content, instruction);
    }
    async analyzeImpact(body) {
        if (!body.productMessage) {
            throw new Error('Forneça a MENSAGEM DO TIME DE PRODUTO (productMessage)');
        }
        const embedding = await this.aiService.generateEmbedding(body.productMessage);
        const similarChunks = await this.vectorDbService.semanticSearch(embedding, 5);
        if (!similarChunks.length) {
            return { affected_articles: [], summary: 'Nenhum contexto encontrado na base de conhecimento para essa mensagem.' };
        }
        const articleIds = [...new Set(similarChunks.map(c => c.articleId))];
        const articlesInDb = await this.prisma.article.findMany({
            where: { id: { in: articleIds } },
            select: { id: true, title: true }
        });
        const articlesContext = similarChunks.map((chunk, idx) => {
            const article = articlesInDb.find(a => a.id === chunk.articleId);
            return `--- TRECHO ${idx + 1} ---\nArtigo ID: ${chunk.articleId}\nTítulo do Artigo: ${article?.title}\nConteúdo: ${chunk.content}\n`;
        }).join('\n');
        return this.aiService.analyzeImpact(body.productMessage, articlesContext);
    }
    async analyzeStyle(body) {
        const analysis = await this.aiService.analyzeStyle(body.articleContents);
        return analysis;
    }
    async qualityScore(body) {
        const content = await this.fetchContentFromDb(body);
        const score = await this.aiService.scoreArticleQuality(content);
        return score;
    }
};
exports.ArticleController = ArticleController;
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArticleController.prototype, "generateArticle", null);
__decorate([
    (0, common_1.Post)('update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArticleController.prototype, "updateArticle", null);
__decorate([
    (0, common_1.Post)('analyze-impact'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArticleController.prototype, "analyzeImpact", null);
__decorate([
    (0, common_1.Post)('analyze-style'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArticleController.prototype, "analyzeStyle", null);
__decorate([
    (0, common_1.Post)('quality-score'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArticleController.prototype, "qualityScore", null);
exports.ArticleController = ArticleController = __decorate([
    (0, common_1.Controller)('api/article'),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        vector_db_service_1.VectorDbService,
        prisma_service_1.PrismaService])
], ArticleController);
//# sourceMappingURL=article.controller.js.map