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
export declare class AiService {
    private readonly logger;
    private gemini;
    constructor();
    generateEmbedding(text: string): Promise<number[]>;
    generateEmbeddingBatch(texts: string[]): Promise<number[][]>;
    generateArticleRAG(prompt: string, contextChunks: string[]): Promise<string>;
    updateArticle(currentContent: string, whatToChange: string): Promise<UpdateArticleResult>;
    analyzeStyle(contextChunks: string[]): Promise<any>;
    scoreArticleQuality(articleContent: string): Promise<any>;
    analyzeImpact(productMessage: string, articlesContext: string): Promise<AnalyzeImpactResult>;
}
