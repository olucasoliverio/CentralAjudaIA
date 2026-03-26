import { SyncService } from '../../../modules/queue/sync.service';
export declare class SyncController {
    private readonly syncService;
    constructor(syncService: SyncService);
    sync(): Promise<{
        message: string;
    }>;
}
