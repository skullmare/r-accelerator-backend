import path from 'path';
import { createRequire } from 'module';
import pdfmake from 'pdfmake';

// Рендер документа артефакта в PDF. Модель пишет ТЕКСТ (Markdown), сервер
// отвечает за вёрстку — это сознательное разделение: у всех артефактов R1..R5
// один фирменный шаблон, а кириллица гарантирована встроенным шрифтом, а не
// удачей. Весь pdfmake-специфичный код заперт в этом модуле: наружу торчит
// только renderDocumentToPdf(), поэтому движок можно заменить (например, на
// HTML + headless Chromium), не трогая логику артефактов.

// Путь к шрифтам берётся из самого пакета через штатную резолюцию Node
// (она поднимается вверх по node_modules), а не склейкой относительных путей.
// Базой служит cwd, а не import.meta.url: последний не переживает
// babel-трансформ ESM->CJS, которым Jest прогоняет этот проект.
const require = createRequire(path.join(process.cwd(), 'package.json'));
const FONTS_DIR = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');

// Roboto покрывает кириллицу — это и есть причина выбора pdfmake:
// у стандартных PDF-шрифтов (Helvetica и т.п.) её нет, и русский текст
// выходит квадратиками.
pdfmake.setFonts({
    Roboto: {
        normal: path.join(FONTS_DIR, 'Roboto-Regular.ttf'),
        bold: path.join(FONTS_DIR, 'Roboto-Medium.ttf'),
        italics: path.join(FONTS_DIR, 'Roboto-Italic.ttf'),
        bolditalics: path.join(FONTS_DIR, 'Roboto-MediumItalic.ttf')
    }
});

// Содержимое документа приходит от LLM. Обе политики закрывают доступ наружу:
// определение документа не должно уметь читать произвольные файлы с диска или
// ходить в сеть за картинками. Разрешена ровно папка со шрифтами.
pdfmake.setLocalAccessPolicy((filePath) => path.resolve(filePath).startsWith(FONTS_DIR));
pdfmake.setUrlAccessPolicy(() => false);

// Markdown, который разрешено использовать модели (это же перечислено в
// промпте генерации документа). Намеренно узкое подмножество: чем меньше
// синтаксиса, тем меньше шансов, что модель сгенерирует то, что рендерер
// молча проглотит и потеряет.
const HEADING_RE = /^(#{1,4})\s+(.*)$/;
const BULLET_RE = /^[-*]\s+(.+)$/;
const ORDERED_RE = /^\d+[.)]\s+(.+)$/;
const RULE_RE = /^(-{3,}|\*{3,}|_{3,})$/;
const TABLE_ROW_RE = /^\|(.+)\|$/;
const TABLE_DIVIDER_RE = /^\|[\s:|-]+\|$/;

const HEADING_STYLES = ['h1', 'h2', 'h3', 'h4'];

// Инлайновое форматирование: **жирный**, *курсив*, `код`. Возвращает массив
// «прогонов» текста в формате pdfmake.
function parseInline(text) {
    const parts = [];
    const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ text: text.slice(lastIndex, match.index) });
        }
        if (match[1] !== undefined) parts.push({ text: match[1], bold: true });
        else if (match[2] !== undefined) parts.push({ text: match[2], italics: true });
        else parts.push({ text: match[3], style: 'code' });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex) });

    return parts.length > 0 ? parts : [{ text }];
}

function splitTableRow(line) {
    return line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim());
}

function buildTable(rows) {
    const [headerCells, ...bodyRows] = rows;
    const columnCount = headerCells.length;

    const normalize = (cells) => {
        const row = cells.slice(0, columnCount);
        while (row.length < columnCount) row.push('');
        return row;
    };

    const body = [
        normalize(headerCells).map((cell) => ({ text: parseInline(cell), style: 'tableHeader' })),
        ...bodyRows.map((cells) => normalize(cells).map((cell) => ({ text: parseInline(cell) })))
    ];

    return {
        table: { headerRows: 1, widths: Array(columnCount).fill('*'), body },
        layout: 'lightHorizontalLines',
        margin: [0, 4, 0, 10]
    };
}

// Markdown -> content-массив pdfmake. Всё, что не опознано как заголовок,
// список, таблица или разделитель, попадает в документ обычным абзацем —
// текст модели не теряется, даже если она отступила от инструкции.
export function markdownToContent(markdown) {
    const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n');
    const content = [];

    let paragraph = [];
    let list = null;
    let tableRows = null;

    const flushParagraph = () => {
        if (paragraph.length === 0) return;
        content.push({ text: parseInline(paragraph.join(' ')), style: 'paragraph' });
        paragraph = [];
    };

    const flushList = () => {
        if (!list) return;
        content.push({ [list.type]: list.items.map((item) => ({ text: parseInline(item) })), style: 'list' });
        list = null;
    };

    const flushTable = () => {
        if (!tableRows) return;
        if (tableRows.length > 0) content.push(buildTable(tableRows));
        tableRows = null;
    };

    const flushAll = () => {
        flushParagraph();
        flushList();
        flushTable();
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line === '') {
            flushAll();
            continue;
        }

        // Таблица: строка вида | a | b |. Строка-разделитель (|---|---|)
        // синтаксическая, в тело не попадает.
        if (TABLE_ROW_RE.test(line)) {
            flushParagraph();
            flushList();
            if (TABLE_DIVIDER_RE.test(line)) continue;
            tableRows = tableRows || [];
            tableRows.push(splitTableRow(line));
            continue;
        }
        flushTable();

        const heading = line.match(HEADING_RE);
        if (heading) {
            flushParagraph();
            flushList();
            content.push({
                text: parseInline(heading[2]),
                style: HEADING_STYLES[heading[1].length - 1] || 'h4'
            });
            continue;
        }

        if (RULE_RE.test(line)) {
            flushAll();
            content.push({
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#d0d5dd' }],
                margin: [0, 6, 0, 12]
            });
            continue;
        }

        const bullet = line.match(BULLET_RE);
        if (bullet) {
            flushParagraph();
            if (list?.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
            list.items.push(bullet[1]);
            continue;
        }

        const ordered = line.match(ORDERED_RE);
        if (ordered) {
            flushParagraph();
            if (list?.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
            list.items.push(ordered[1]);
            continue;
        }

        flushList();
        paragraph.push(line);
    }

    flushAll();

    return content;
}

function buildDocDefinition({ markdown, title, subtitle, meta }) {
    const metaLine = [meta?.projectName, meta?.agentName, meta?.generatedAt]
        .filter(Boolean)
        .join('  ·  ');

    return {
        info: { title, author: meta?.agentName || 'R-Акселератор' },
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 50],
        defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.25, color: '#1d2939' },
        header: (currentPage) => (currentPage === 1 ? null : {
            text: title,
            style: 'runningHead',
            margin: [40, 24, 40, 0]
        }),
        footer: (currentPage, pageCount) => ({
            columns: [
                { text: meta?.projectName || '', style: 'footer' },
                { text: `${currentPage} / ${pageCount}`, style: 'footer', alignment: 'right' }
            ],
            margin: [40, 16, 40, 0]
        }),
        content: [
            { text: title, style: 'title' },
            ...(subtitle ? [{ text: subtitle, style: 'subtitle' }] : []),
            ...(metaLine ? [{ text: metaLine, style: 'meta' }] : []),
            {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#2970ff' }],
                margin: [0, 8, 0, 18]
            },
            ...markdownToContent(markdown)
        ],
        styles: {
            title: { fontSize: 24, bold: true, color: '#101828' },
            subtitle: { fontSize: 13, color: '#475467', margin: [0, 6, 0, 0] },
            meta: { fontSize: 9, color: '#98a2b3', margin: [0, 8, 0, 0] },
            h1: { fontSize: 17, bold: true, color: '#101828', margin: [0, 16, 0, 8] },
            h2: { fontSize: 14, bold: true, color: '#101828', margin: [0, 14, 0, 6] },
            h3: { fontSize: 12, bold: true, color: '#344054', margin: [0, 12, 0, 4] },
            h4: { fontSize: 11, bold: true, color: '#344054', margin: [0, 10, 0, 4] },
            paragraph: { margin: [0, 0, 0, 8], alignment: 'justify' },
            list: { margin: [0, 0, 0, 10] },
            tableHeader: { bold: true, color: '#101828' },
            code: { font: 'Roboto', color: '#475467' },
            runningHead: { fontSize: 8, color: '#98a2b3' },
            footer: { fontSize: 8, color: '#98a2b3' }
        }
    };
}

export class PdfRenderError extends Error {
    constructor(message) {
        super(message);
        this.code = 'ARTIFACT_RENDER_FAILED';
    }
}

// Единственная публичная точка модуля: Markdown -> Buffer с PDF.
export async function renderDocumentToPdf({ markdown, title, subtitle, meta }) {
    try {
        const doc = pdfmake.createPdf(buildDocDefinition({ markdown, title, subtitle, meta }));
        return await doc.getBuffer();
    } catch (error) {
        throw new PdfRenderError(`Не удалось отрендерить PDF артефакта: ${error.message}`);
    }
}
