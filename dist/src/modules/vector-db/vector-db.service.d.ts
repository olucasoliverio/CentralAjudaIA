import { PrismaService } from '../../prisma/prisma.service';
export declare class VectorDbService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    saveArticleAndChunks(freshdeskId: string, title: string, description: string, category: string | null, tags: string[], chunksData: {
        content: string;
        embedding: number[];
        tokenCount: number;
    }[]): Promise<any>;
    semanticSearch(embedding: number[], topK?: number): Promise<{
        articleId: string;
        content: string;
        distance: number;
    }[]>;
}
