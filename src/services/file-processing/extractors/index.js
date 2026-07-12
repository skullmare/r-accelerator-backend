import { extractTextChunks } from './text.extractor.js';
import { extractPdfChunks } from './pdf.extractor.js';
import { extractDocxChunks } from './docx.extractor.js';

const EXTRACTORS_BY_MIMETYPE = {
    'text/plain': extractTextChunks,
    'text/markdown': extractTextChunks,
    'text/x-markdown': extractTextChunks,
    'application/pdf': extractPdfChunks,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': extractDocxChunks
};

export function getExtractor(mimetype) {
    return EXTRACTORS_BY_MIMETYPE[mimetype] ?? null;
}
