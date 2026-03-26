"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var FreshdeskService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreshdeskService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
let FreshdeskService = FreshdeskService_1 = class FreshdeskService {
    logger = new common_1.Logger(FreshdeskService_1.name);
    get baseUrl() {
        return process.env.FRESHDESK_URL || '';
    }
    get apiKey() {
        return process.env.FRESHDESK_API_KEY || '';
    }
    get auth() {
        return { username: this.apiKey, password: 'X' };
    }
    async sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async fetchAllArticles() {
        this.logger.log('Buscando arvore de categorias e folders do Freshdesk...');
        const allArticles = [];
        try {
            const categoriesRes = await axios_1.default.get(`${this.baseUrl}/solutions/categories`, { auth: this.auth });
            const categories = categoriesRes.data;
            for (const category of categories) {
                await this.sleep(1000);
                const foldersRes = await axios_1.default.get(`${this.baseUrl}/solutions/categories/${category.id}/folders`, { auth: this.auth });
                const folders = foldersRes.data;
                for (const folder of folders) {
                    let page = 1;
                    while (true) {
                        await this.sleep(1000);
                        const articlesRes = await axios_1.default.get(`${this.baseUrl}/solutions/folders/${folder.id}/articles`, {
                            params: { page, per_page: 30 },
                            auth: this.auth
                        });
                        const articles = articlesRes.data;
                        if (articles.length === 0)
                            break;
                        allArticles.push(...articles);
                        page++;
                    }
                }
            }
            return allArticles;
        }
        catch (error) {
            this.logger.error('Erro ao buscar artigos no Freshdesk', error?.message || error);
            throw error;
        }
    }
};
exports.FreshdeskService = FreshdeskService;
exports.FreshdeskService = FreshdeskService = FreshdeskService_1 = __decorate([
    (0, common_1.Injectable)()
], FreshdeskService);
//# sourceMappingURL=freshdesk.service.js.map