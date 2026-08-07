import type { Workflow, WorkflowEdge, WorkflowNode } from "@/domain/types";

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
const NODE_WIDTH = 148;
const NODE_HEIGHT = 134;
const NODE_TILE = {
  left: 30,
  right: 118,
  top: 18,
  bottom: 94,
  centerX: 74,
  centerY: 56
};
const APPROVAL_TILE = {
  left: 8,
  right: 140,
  top: 24,
  bottom: 106,
  centerX: 74,
  centerY: 65
};
const EXPORT_PADDING = 88;

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

export async function createFullWorkflowImage(workflow: Workflow) {
  const bounds = getWorkflowBounds(workflow);
  const logicalWidth = Math.max(900, bounds.width + EXPORT_PADDING * 2);
  const logicalHeight = Math.max(560, bounds.height + EXPORT_PADDING * 2);
  const maxDimension = 3600;
  const pixelRatio = Math.min(2, maxDimension / Math.max(logicalWidth, logicalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(logicalWidth * pixelRatio);
  canvas.height = Math.round(logicalHeight * pixelRatio);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF export could not create a drawing context.");

  context.scale(pixelRatio, pixelRatio);
  context.translate(EXPORT_PADDING - bounds.minX, EXPORT_PADDING - bounds.minY);
  drawWorkflowBackground(context, bounds);
  drawGroups(context, workflow);
  drawEdges(context, workflow);
  drawNodes(context, workflow);

  return {
    imageDataUrl: canvas.toDataURL("image/jpeg", 0.92),
    imageWidth: canvas.width,
    imageHeight: canvas.height
  };
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

function getWorkflowBounds(workflow: Workflow) {
  const items = [
    ...workflow.groups.map((group) => ({
      minX: group.position.x,
      minY: group.position.y,
      maxX: group.position.x + group.width,
      maxY: group.position.y + group.height
    })),
    ...workflow.nodes.map((node) => ({
      minX: node.position.x,
      minY: node.position.y,
      maxX: node.position.x + NODE_WIDTH,
      maxY: node.position.y + NODE_HEIGHT
    }))
  ];
  if (!items.length) return { minX: 0, minY: 0, maxX: 900, maxY: 560, width: 900, height: 560 };
  const minX = Math.min(...items.map((item) => item.minX));
  const minY = Math.min(...items.map((item) => item.minY));
  const maxX = Math.max(...items.map((item) => item.maxX));
  const maxY = Math.max(...items.map((item) => item.maxY));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function drawWorkflowBackground(context: CanvasRenderingContext2D, bounds: ReturnType<typeof getWorkflowBounds>) {
  context.save();
  context.fillStyle = "#f8fafc";
  context.fillRect(bounds.minX - EXPORT_PADDING, bounds.minY - EXPORT_PADDING, bounds.width + EXPORT_PADDING * 2, bounds.height + EXPORT_PADDING * 2);
  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 1;
  for (let x = Math.floor((bounds.minX - EXPORT_PADDING) / 48) * 48; x < bounds.maxX + EXPORT_PADDING; x += 48) {
    context.beginPath();
    context.moveTo(x, bounds.minY - EXPORT_PADDING);
    context.lineTo(x, bounds.maxY + EXPORT_PADDING);
    context.stroke();
  }
  for (let y = Math.floor((bounds.minY - EXPORT_PADDING) / 48) * 48; y < bounds.maxY + EXPORT_PADDING; y += 48) {
    context.beginPath();
    context.moveTo(bounds.minX - EXPORT_PADDING, y);
    context.lineTo(bounds.maxX + EXPORT_PADDING, y);
    context.stroke();
  }
  context.restore();
}

function drawGroups(context: CanvasRenderingContext2D, workflow: Workflow) {
  workflow.groups.forEach((group) => {
    context.save();
    context.fillStyle = hexToRgba(group.color, 0.34);
    context.strokeStyle = hexToRgba(group.color, 0.74);
    context.setLineDash([4, 4]);
    roundRect(context, group.position.x, group.position.y, group.width, group.height, 8);
    context.fill();
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#334155";
    context.font = "700 14px Arial, sans-serif";
    context.fillText(group.title, group.position.x + 16, group.position.y + 26);
    if (group.description && !group.collapsed) {
      context.fillStyle = "#64748b";
      context.font = "12px Arial, sans-serif";
      context.fillText(group.description, group.position.x + 16, group.position.y + 48);
    }
    context.restore();
  });
}

function drawEdges(context: CanvasRenderingContext2D, workflow: Workflow) {
  const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
  workflow.edges.forEach((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) return;
    const start = getHandlePoint(source, edge.sourceHandle, "source", workflow.flowKind === "approval_chain");
    const end = getHandlePoint(target, edge.targetHandle, "target", workflow.flowKind === "approval_chain");
    const color = getEdgeColor(edge.type);
    context.save();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 2.2;
    context.lineCap = "round";
    drawCurvedEdge(context, start, end, edge.curvature ?? 0.42);
    drawArrow(context, start, end);
    if (edge.label) drawEdgeLabel(context, edge.label, (start.x + end.x) / 2, (start.y + end.y) / 2);
    context.restore();
  });
}

function drawNodes(context: CanvasRenderingContext2D, workflow: Workflow) {
  workflow.nodes.forEach((node) => {
    if (workflow.flowKind === "approval_chain") drawApprovalNode(context, node);
    else drawAiNode(context, node);
  });
}

function drawApprovalNode(context: CanvasRenderingContext2D, node: WorkflowNode) {
  const status = String(node.data.configuration.approvalStatus ?? node.data.configuration.status ?? node.data.status ?? "not_reviewed");
  const x = node.position.x + 8;
  const y = node.position.y + 24;
  context.save();
  context.shadowColor = getApprovalGlow(status);
  context.shadowBlur = status === "not_reviewed" ? 4 : 13;
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 1.2;
  roundRect(context, x, y, 132, 82, 8);
  context.fill();
  context.shadowBlur = 0;
  context.stroke();
  context.fillStyle = "#0f172a";
  context.font = "800 13px Arial, sans-serif";
  drawWrappedText(context, node.data.label, x + 13, y + 34, 106, 16, 2, "center");
  context.restore();
}

function drawAiNode(context: CanvasRenderingContext2D, node: WorkflowNode) {
  const x = node.position.x + 30;
  const y = node.position.y + 18;
  context.save();
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 1.2;
  context.shadowColor = "rgba(15, 23, 42, 0.16)";
  context.shadowBlur = 10;
  roundRect(context, x, y, 88, 76, 8);
  context.fill();
  context.shadowBlur = 0;
  context.stroke();
  context.fillStyle = "#64748b";
  context.font = "700 9px Arial, sans-serif";
  context.fillText(String(node.data.technology ?? node.data.category).slice(0, 18), x + 9, y + 16);
  context.fillStyle = "#0f172a";
  context.font = "800 12px Arial, sans-serif";
  drawWrappedText(context, node.data.label, x + 10, y + 43, 68, 14, 2, "center");
  context.restore();
}

function getHandlePoint(node: WorkflowNode, handle: string | undefined, kind: "source" | "target", isApprovalChain: boolean) {
  const tile = isApprovalChain ? APPROVAL_TILE : NODE_TILE;
  const side = handleToSide(handle, kind);
  if (side === "left") return { x: node.position.x + tile.left, y: node.position.y + tile.centerY };
  if (side === "right") return { x: node.position.x + tile.right, y: node.position.y + tile.centerY };
  if (side === "top") return { x: node.position.x + tile.centerX, y: node.position.y + tile.top };
  return { x: node.position.x + tile.centerX, y: node.position.y + tile.bottom };
}

function handleToSide(handle: string | undefined, kind: "source" | "target") {
  if (handle?.includes("left")) return "left";
  if (handle?.includes("right")) return "right";
  if (handle?.includes("top")) return "top";
  if (handle?.includes("bottom")) return "bottom";
  return kind === "source" ? "right" : "left";
}

function drawCurvedEdge(context: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }, curvature: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const controlDistance = Math.max(30, Math.hypot(dx, dy) * curvature * 0.45);
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  context.beginPath();
  context.moveTo(start.x, start.y);
  if (curvature <= 0.01) {
    context.lineTo(end.x, end.y);
  } else if (horizontal) {
    context.bezierCurveTo(start.x + Math.sign(dx || 1) * controlDistance, start.y, end.x - Math.sign(dx || 1) * controlDistance, end.y, end.x, end.y);
  } else {
    context.bezierCurveTo(start.x, start.y + Math.sign(dy || 1) * controlDistance, end.x, end.y - Math.sign(dy || 1) * controlDistance, end.x, end.y);
  }
  context.stroke();
}

function drawArrow(context: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const size = 8;
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
  context.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
}

function drawEdgeLabel(context: CanvasRenderingContext2D, label: string, x: number, y: number) {
  context.save();
  context.font = "11px Arial, sans-serif";
  const text = label.slice(0, 34);
  const width = context.measureText(text).width + 16;
  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  context.strokeStyle = "#e2e8f0";
  roundRect(context, x - width / 2, y - 13, width, 22, 6);
  context.fill();
  context.stroke();
  context.fillStyle = "#475569";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, x, y - 2);
  context.restore();
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number, align: CanvasTextAlign = "left") {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  context.textAlign = align;
  context.textBaseline = "middle";
  const drawX = align === "center" ? x + maxWidth / 2 : x;
  lines.slice(0, maxLines).forEach((line, index) => {
    const suffix = index === maxLines - 1 && lines.length > maxLines ? "..." : "";
    context.fillText(`${line.slice(0, 32)}${suffix}`, drawX, y + index * lineHeight);
  });
}

function getEdgeColor(type: WorkflowEdge["type"]) {
  if (type === "approval") return "#7c3aed";
  if (type === "feedback") return "#ca8a04";
  if (type === "control") return "#0284c7";
  if (type === "dependency") return "#475569";
  return "#64748b";
}

function getApprovalGlow(status: string) {
  if (status === "approved") return "rgba(22, 163, 74, 0.5)";
  if (status === "rejected") return "rgba(220, 38, 38, 0.5)";
  if (status === "in_review") return "rgba(202, 138, 4, 0.5)";
  return "rgba(15, 23, 42, 0.12)";
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(226, 232, 240, ${alpha})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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
