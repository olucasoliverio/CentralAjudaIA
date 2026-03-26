export interface FreshdeskArticle {
    id: number;
    title: string;
    description: string;
    category_id?: number;
    tags?: string[];
    created_at: string;
    updated_at: string;
}
export declare class FreshdeskService {
    private readonly logger;
    private get baseUrl();
    private get apiKey();
    private get auth();
    private sleep;
    fetchAllArticles(): Promise<FreshdeskArticle[]>;
}
