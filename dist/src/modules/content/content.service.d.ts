export declare class ContentService {
    private readonly logger;
    private turndownService;
    constructor();
    processHtmlToMarkdown(htmlContent: string): string;
    chunkText(text: string, maxTokens?: number): string[];
}
