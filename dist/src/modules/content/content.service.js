"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ContentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentService = void 0;
const common_1 = require("@nestjs/common");
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const turndown_1 = __importDefault(require("turndown"));
let ContentService = ContentService_1 = class ContentService {
    logger = new common_1.Logger(ContentService_1.name);
    turndownService;
    constructor() {
        this.turndownService = new turndown_1.default({ headingStyle: 'atx' });
    }
    processHtmlToMarkdown(htmlContent) {
        if (!htmlContent)
            return '';
        const cleanHtml = (0, sanitize_html_1.default)(htmlContent, {
            allowedTags: sanitize_html_1.default.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3']),
            allowedAttributes: { ...sanitize_html_1.default.defaults.allowedAttributes, img: ['src', 'alt'] },
        });
        return this.turndownService.turndown(cleanHtml);
    }
    chunkText(text, maxTokens = 800) {
        const paragraphs = text.split(/\n\s*\n/);
        const chunks = [];
        let currentChunk = '';
        for (const p of paragraphs) {
            if ((currentChunk.length + p.length) / 4 > maxTokens) {
                if (currentChunk)
                    chunks.push(currentChunk.trim());
                currentChunk = p;
            }
            else {
                currentChunk += currentChunk ? '\n\n' + p : p;
            }
        }
        if (currentChunk)
            chunks.push(currentChunk.trim());
        return chunks;
    }
};
exports.ContentService = ContentService;
exports.ContentService = ContentService = ContentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ContentService);
//# sourceMappingURL=content.service.js.map