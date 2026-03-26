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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorDbService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let VectorDbService = class VectorDbService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async saveArticleAndChunks(freshdeskId, title, description, category, tags, chunksData) {
        return this.prisma.$transaction(async (tx) => {
            const article = await tx.article.upsert({
                where: { freshdeskId },
                update: { title, description, category, tags: { set: tags } },
                create: {
                    freshdeskId,
                    title,
                    description,
                    category,
                    tags: { set: tags },
                },
            });
            await tx.chunk.deleteMany({ where: { articleId: article.id } });
            for (const chunk of chunksData) {
                const formattedEmbedding = `[${chunk.embedding.join(',')}]`;
                await tx.$executeRawUnsafe(`INSERT INTO chunks (id, "articleId", content, embedding, "tokenCount", "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3::vector, $4, NOW())`, article.id, chunk.content, formattedEmbedding, chunk.tokenCount);
            }
            return article;
        });
    }
    async semanticSearch(embedding, topK = 3) {
        const formattedEmbedding = `[${embedding.join(',')}]`;
        const results = await this.prisma.$queryRawUnsafe(`SELECT "articleId", content, embedding <=> $1::vector as distance
       FROM chunks
       ORDER BY distance ASC
       LIMIT $2`, formattedEmbedding, topK);
        return results;
    }
};
exports.VectorDbService = VectorDbService;
exports.VectorDbService = VectorDbService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], VectorDbService);
//# sourceMappingURL=vector-db.service.js.map