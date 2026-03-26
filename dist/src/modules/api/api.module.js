"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiModule = void 0;
const common_1 = require("@nestjs/common");
const article_controller_1 = require("./article/article.controller");
const sync_controller_1 = require("./sync/sync.controller");
const ai_module_1 = require("../ai/ai.module");
const vector_db_module_1 = require("../vector-db/vector-db.module");
const queue_module_1 = require("../queue/queue.module");
let ApiModule = class ApiModule {
};
exports.ApiModule = ApiModule;
exports.ApiModule = ApiModule = __decorate([
    (0, common_1.Module)({
        imports: [ai_module_1.AiModule, vector_db_module_1.VectorDbModule, queue_module_1.QueueModule],
        controllers: [article_controller_1.ArticleController, sync_controller_1.SyncController],
    })
], ApiModule);
//# sourceMappingURL=api.module.js.map