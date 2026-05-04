import { PDFParse } from "pdf-parse";
function looksLikePdf(input) {
    return input.mimeType === "application/pdf" || input.fileName?.toLowerCase().endsWith(".pdf") === true;
}
export async function parseDocumentInput(input) {
    const sourceFile = input.fileName ?? "Claude prompt upload";
    if (input.documentText?.trim()) {
        return {
            sourceFile,
            text: input.documentText,
            parser: "text"
        };
    }
    if (!input.documentBase64?.trim()) {
        throw new Error("Provide documentText or documentBase64.");
    }
    if (!looksLikePdf(input)) {
        throw new Error("documentBase64 is currently supported for PDF documents only.");
    }
    const parser = new PDFParse({ data: Buffer.from(input.documentBase64, "base64") });
    try {
        const result = await parser.getText();
        const text = result.text.trim();
        if (!text) {
            throw new Error("No extractable text found in the PDF. Scanned PDFs need OCR before intake.");
        }
        return {
            sourceFile,
            text,
            parser: "pdf"
        };
    }
    finally {
        await parser.destroy();
    }
}
