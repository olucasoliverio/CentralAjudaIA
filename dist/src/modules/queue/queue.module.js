"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const sync_service_1 = require("./sync.service");
const freshdesk_module_1 = require("../freshdesk/freshdesk.module");
const content_module_1 = require("../content/content.module");
const ai_module_1 = require("../ai/ai.module");
const vector_db_module_1 = require("../vector-db/vector-db.module");
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Module)({
        imports: [freshdesk_module_1.FreshdeskModule, content_module_1.ContentModule, ai_module_1.AiModule, vector_db_module_1.VectorDbModule],
        providers: [sync_service_1.SyncService],
        exports: [sync_service_1.SyncService],
    })
], QueueModule);
//# sourceMappingURL=queue.module.js.map