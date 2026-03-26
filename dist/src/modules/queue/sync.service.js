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
var SyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
const common_1 = require("@nestjs/common");
const freshdesk_service_1 = require("../freshdesk/freshdesk.service");
const content_service_1 = require("../content/content.service");
const ai_service_1 = require("../ai/ai.service");
const vector_db_service_1 = require("../vector-db/vector-db.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let SyncService = SyncService_1 = class SyncService {
    freshdesk;
    content;
    ai;
    vectorDb;
    prisma;
    logger = new common_1.Logger(SyncService_1.name);
    constructor(freshdesk, content, ai, vectorDb, prisma) {
        this.freshdesk = freshdesk;
        this.content = content;
        this.ai = ai;
        this.vectorDb = vectorDb;
        this.prisma = prisma;
    }
    async syncAllArticles() {
        this.logger.log('Starting full sync of Freshdesk articles...');
        try {
            const articles = await this.freshdesk.fetchAllArticles();
            this.logger.log(`Encontrados ${articles.length} artigos no total. Processando...`);
            for (const article of articles) {
                await this.syncArticle(article);
            }
            this.logger.log('Sync finished successfully.');
        }
        catch (e) {
            this.logger.error('Error in sync process', e?.message || e);
        }
    }
    async syncArticle(article) {
        try {
            const exists = await this.prisma.article.findUnique({
                where: { freshdeskId: article.id.toString() },
                include: { _count: { select: { chunks: true } } }
            });
            if (exists && exists._count.chunks > 0) {
                this.logger.log(`[PULANDO] Article já sincronizado e vetorizado: ${article.title}`);
                return;
            }
            this.logger.log(`Processing article: ${article.title}`);
            const markdown = this.content.processHtmlToMarkdown(article.description);
            const textChunks = this.content.chunkText(markdown, 800);
            const chunksData = [];
            if (textChunks.length > 0) {
                await new Promise((r) => setTimeout(r, 4500));
                try {
                    const embeddings = await this.ai.generateEmbeddingBatch(textChunks);
                    for (let i = 0; i < textChunks.length; i++) {
                        const text = textChunks[i];
                        if (!text.trim())
                            continue;
                        chunksData.push({
                            content: text,
                            embedding: embeddings[i],
                            tokenCount: Math.ceil(text.length / 4),
                        });
                    }
                }
                catch (embError) {
                    this.logger.error(`Gemini embedding failed for article ${article.id}`);
                    throw embError;
                }
            }
            await this.vectorDb.saveArticleAndChunks(article.id.toString(), article.title, markdown, article.category_id?.toString() || null, article.tags || [], chunksData);
        }
        catch (e) {
            this.logger.error(`Failed to process article ${article.id}`, e?.message || e);
        }
    }
};
exports.SyncService = SyncService;
exports.SyncService = SyncService = SyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [freshdesk_service_1.FreshdeskService,
        content_service_1.ContentService,
        ai_service_1.AiService,
        vector_db_service_1.VectorDbService,
        prisma_service_1.PrismaService])
], SyncService);
//# sourceMappingURL=sync.service.js.map