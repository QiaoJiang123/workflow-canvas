interface WorkflowPdfOptions {
  title: string;
  subtitle: string;
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
}

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 36;

export function createWorkflowPdf({ title, subtitle, imageDataUrl, imageWidth, imageHeight }: WorkflowPdfOptions) {
  const imageBytes = dataUrlToBytes(imageDataUrl);
  const imageStream = `${bytesToHex(imageBytes)}>`;
  const content = buildPageContent(title, subtitle, imageWidth, imageHeight);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /XObject << /Im1 4 0 R >> /Font << /F1 5 0 R >> >> /Contents 6 0 R >>`,
    `<< /Type /XObject /Subtype /Image /Width ${Math.round(imageWidth)} /Height ${Math.round(imageHeight)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${imageStream.length} >>\nstream\n${imageStream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stringByteLength(content)} >>\nstream\n${content}\nendstream`
  ];

  return new Blob([serializePdf(objects)], { type: "application/pdf" });
}

function buildPageContent(title: string, subtitle: string, imageWidth: number, imageHeight: number) {
  const maxImageWidth = PAGE_WIDTH - MARGIN * 2;
  const maxImageHeight = PAGE_HEIGHT - 112;
  const scale = Math.min(maxImageWidth / imageWidth, maxImageHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const x = (PAGE_WIDTH - drawWidth) / 2;
  const y = 34;

  return [
    "q",
    "0.98 0.99 1 rg",
    `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`,
    "Q",
    "BT",
    "/F1 18 Tf",
    "0.09 0.13 0.2 rg",
    `${MARGIN} ${PAGE_HEIGHT - 40} Td`,
    `(${escapePdfText(title)}) Tj`,
    "ET",
    "BT",
    "/F1 10 Tf",
    "0.38 0.44 0.52 rg",
    `${MARGIN} ${PAGE_HEIGHT - 58} Td`,
    `(${escapePdfText(subtitle)}) Tj`,
    "ET",
    "q",
    `${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`,
    "/Im1 Do",
    "Q"
  ].join("\n");
}

function serializePdf(objects: string[]) {
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(stringByteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = stringByteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToHex(bytes: Uint8Array) {
  let output = "";
  bytes.forEach((byte) => {
    output += byte.toString(16).padStart(2, "0");
  });
  return output;
}

function stringByteLength(value: string) {
  return new Blob([value]).size;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").slice(0, 180);
}
