import type { Workflow, WorkflowEdge, WorkflowGroup } from "./types";
import { createEmptyWorkflow, createNodeFromDefinitionId } from "./workflow-factory";

const stageY = 150;
const sampleTimestamp = "2026-01-01T00:00:00.000Z";

const sampleStages = [
  ["Sources", 80, "#dbeafe"],
  ["Ingestion", 330, "#cffafe"],
  ["Feature Development", 580, "#ede9fe"],
  ["Modeling", 830, "#ffedd5"],
  ["Evaluation", 1080, "#dcfce7"],
  ["Deployment", 1330, "#e0e7ff"],
  ["Monitoring", 1580, "#ccfbf1"]
] as const;

export function createInsuranceClaimSeveritySample(): Workflow {
  const workflow = createEmptyWorkflow("Insurance claim severity workflow");
  workflow.id = "workflow-claim-severity-sample";
  workflow.description = "End-to-end claim severity modeling workflow from documents and structured claim data to dashboard monitoring.";
  workflow.owner = "Claims AI";
  workflow.team = "Insurance Analytics";
  workflow.tags = ["claims", "severity", "ml", "llm"];
  workflow.createdAt = sampleTimestamp;
  workflow.updatedAt = sampleTimestamp;
  workflow.groups = sampleStages.map(([title, x, color]) => ({
    id: `group-${slugify(title)}`,
    title,
    description: `${title} stage`,
    position: { x, y: 88 },
    width: 230,
    height: 520,
    color,
    collapsed: false
  })) satisfies WorkflowGroup[];

  const definitions = [
    ["data-lake", 105, stageY, { system: "Claims data lake", format: "Parquet", frequency: "Daily", sensitivity: "confidential" }],
    ["file-storage", 105, stageY + 170, { system: "Claim documents", format: "PDF/TXT", frequency: "Daily", sensitivity: "confidential" }],
    ["data-validation", 355, stageY, { rules: "Required claim id, coverage, loss date, reserve, jurisdiction, and status." }],
    ["data-cleaning", 355, stageY + 170, { steps: "Normalize dates, loss codes, reserves, parties, and document references." }],
    ["ocr", 355, stageY + 340, { engine: "Document OCR" }],
    ["llm", 605, stageY + 340, { provider: "OpenAI", model: "Extraction model", responseFormat: "Claim fact JSON" }],
    ["feature-engineering", 605, stageY + 80, { features: "Loss facts, coverage, jurisdiction, reserve movement, injury/property signals." }],
    ["train-test-split", 855, stageY + 80, { modelType: "Supervised dataset split", framework: "scikit-learn", target: "Claim severity band" }],
    ["model-training", 855, stageY + 250, { modelType: "Gradient boosted classifier", framework: "scikit-learn", target: "Claim severity band" }],
    ["model-evaluation", 1105, stageY + 80, { dataset: "Holdout claims", metrics: "F1, calibration, confusion matrix", thresholds: "F1 >= 0.78" }],
    ["human-review", 1105, stageY + 250, { reviewCriteria: "Low confidence, severe injury indicators, or litigation signals." }],
    ["model-registry", 1355, stageY + 80, { modelType: "Severity model", version: "1.0.0", framework: "MLflow" }],
    ["batch-inference", 1355, stageY + 250, { modelType: "Batch scoring", framework: "Airflow", target: "Open claims" }],
    ["dashboard", 1605, stageY, { audience: "Claims triage managers" }],
    ["monitoring", 1605, stageY + 170, { signals: "Drift, calibration, override rate, severity mix." }],
    ["alert", 1605, stageY + 340, { threshold: "Calibration drift > 8% or high-severity queue spike." }]
  ] as const;

  workflow.nodes = definitions.map(([definitionId, x, y, configuration]) => {
    const node = createNodeFromDefinitionId(definitionId, { x, y });
    node.id = `node-${definitionId}`;
    node.data.configuration = { ...node.data.configuration, ...configuration };
    node.data.status = "ready";
    return node;
  });

  const byDefinition = new Map(workflow.nodes.map((node) => [node.definitionId, node.id]));
  const edgePairs = [
    ["data-lake", "data-validation", "Claim records"],
    ["data-validation", "data-cleaning", "Validated data"],
    ["data-cleaning", "feature-engineering", "Structured features"],
    ["file-storage", "ocr", "Claim files"],
    ["ocr", "llm", "Extracted text"],
    ["llm", "feature-engineering", "Document features"],
    ["feature-engineering", "train-test-split", "Features"],
    ["train-test-split", "model-training", "Training data"],
    ["model-training", "model-evaluation", "Candidate model"],
    ["model-evaluation", "human-review", "Review package"],
    ["human-review", "model-registry", "Approval decision"],
    ["model-evaluation", "model-registry", "Metrics"],
    ["model-registry", "batch-inference", "Registered model"],
    ["batch-inference", "dashboard", "Scores"],
    ["batch-inference", "monitoring", "Telemetry"],
    ["monitoring", "alert", "Threshold breach"]
  ];

  workflow.edges = edgePairs.map(([sourceDefinition, targetDefinition, label]) => ({
    id: `edge-${sourceDefinition}-${targetDefinition}`,
    source: byDefinition.get(sourceDefinition) ?? "",
    target: byDefinition.get(targetDefinition) ?? "",
    sourceHandle: "out",
    targetHandle: "in",
    type: "data",
    label
  })) satisfies WorkflowEdge[];

  return workflow;
}

export function createSimpleDemoWorkflow(): Workflow {
  const workflow = createEmptyWorkflow("Simple document approval demo");
  workflow.id = "workflow-simple-document-approval";
  workflow.description = "A compact demo showing intake, AI classification, human approval, publishing, and monitoring.";
  workflow.owner = "Operations";
  workflow.team = "Workflow Design";
  workflow.tags = ["demo", "approval", "agent"];
  workflow.createdAt = sampleTimestamp;
  workflow.updatedAt = sampleTimestamp;
  workflow.groups = [
    ["Input", 80, "#dbeafe"],
    ["AI Step", 360, "#ede9fe"],
    ["Review", 640, "#dcfce7"],
    ["Output", 920, "#ffedd5"]
  ].map(([title, x, color]) => ({
    id: `group-simple-${slugify(String(title))}`,
    title: String(title),
    description: `${title} stage`,
    position: { x: Number(x), y: 88 },
    width: 230,
    height: 420,
    color: String(color),
    collapsed: false
  })) satisfies WorkflowGroup[];

  const definitions = [
    ["file-storage", "Document Inbox", 110, 175, { system: "Shared inbox", format: "PDF/DOCX", frequency: "On demand" }],
    ["llm", "Classify Request", 390, 175, { provider: "OpenAI", model: "gpt-5", responseFormat: "Approval category JSON" }],
    ["human-review", "Approve Exception", 670, 175, { reviewCriteria: "Low confidence, restricted content, or policy exception." }],
    ["dashboard", "Publish Status", 950, 175, { audience: "Request owners" }],
    ["monitoring", "Monitor Queue", 950, 340, { signals: "Cycle time, rework rate, and exception volume." }]
  ] as const;

  workflow.nodes = definitions.map(([definitionId, label, x, y, configuration]) => {
    const node = createNodeFromDefinitionId(definitionId, { x, y });
    node.id = `node-simple-${slugify(label)}`;
    node.data.label = label;
    node.data.configuration = { ...node.data.configuration, ...configuration };
    node.data.status = "ready";
    return node;
  });

  workflow.edges = [
    ["node-simple-document-inbox", "node-simple-classify-request", "Documents"],
    ["node-simple-classify-request", "node-simple-approve-exception", "Needs review"],
    ["node-simple-approve-exception", "node-simple-publish-status", "Approved"],
    ["node-simple-publish-status", "node-simple-monitor-queue", "Operational telemetry"]
  ].map(([source, target, label]) => ({
    id: `edge-${source.replace("node-simple-", "")}-${target.replace("node-simple-", "")}`,
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
    type: "data",
    label
  })) satisfies WorkflowEdge[];

  return workflow;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
