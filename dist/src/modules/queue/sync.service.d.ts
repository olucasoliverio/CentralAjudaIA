import { FreshdeskService } from '../freshdesk/freshdesk.service';
import { ContentService } from '../content/content.service';
import { AiService } from '../ai/ai.service';
import { VectorDbService } from '../vector-db/vector-db.service';
import { PrismaService } from '../../prisma/prisma.service';
export declare class SyncService {
    private readonly freshdesk;
    private readonly content;
    private readonly ai;
    private readonly vectorDb;
    private readonly prisma;
    private readonly logger;
    constructor(freshdesk: FreshdeskService, content: ContentService, ai: AiService, vectorDb: VectorDbService, prisma: PrismaService);
    syncAllArticles(): Promise<void>;
    syncArticle(article: any): Promise<void>;
}
