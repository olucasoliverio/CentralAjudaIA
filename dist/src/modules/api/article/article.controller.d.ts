import { AiService, UpdateArticleResult, AnalyzeImpactResult } from '../../ai/ai.service';
import { VectorDbService } from '../../vector-db/vector-db.service';
import { PrismaService } from '../../../prisma/prisma.service';
export declare class ArticleController {
    private readonly aiService;
    private readonly vectorDbService;
    private readonly prisma;
    constructor(aiService: AiService, vectorDbService: VectorDbService, prisma: PrismaService);
    generateArticle(body: {
        prompt: string;
    }): Promise<{
        generated_content: string;
        sources: string[];
    }>;
    private fetchContentFromDb;
    updateArticle(body: {
        currentContent?: string;
        articleId?: string;
        freshdeskId?: string;
        whatToChange?: string;
    }): Promise<UpdateArticleResult>;
    analyzeImpact(body: {
        productMessage: string;
    }): Promise<AnalyzeImpactResult>;
    analyzeStyle(body: {
        articleContents: string[];
    }): Promise<any>;
    qualityScore(body: {
        articleContent?: string;
        articleId?: string;
        freshdeskId?: string;
    }): Promise<any>;
}
