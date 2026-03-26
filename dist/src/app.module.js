"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const freshdesk_module_1 = require("./modules/freshdesk/freshdesk.module");
const content_module_1 = require("./modules/content/content.module");
const ai_module_1 = require("./modules/ai/ai.module");
const vector_db_module_1 = require("./modules/vector-db/vector-db.module");
const queue_module_1 = require("./modules/queue/queue.module");
const api_module_1 = require("./modules/api/api.module");
const prisma_module_1 = require("./prisma/prisma.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            freshdesk_module_1.FreshdeskModule,
            content_module_1.ContentModule,
            ai_module_1.AiModule,
            vector_db_module_1.VectorDbModule,
            queue_module_1.QueueModule,
            api_module_1.ApiModule,
            prisma_module_1.PrismaModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map