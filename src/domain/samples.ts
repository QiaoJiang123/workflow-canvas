import { getApprovalChainTypeLabel } from "./approval-chain-types";
import type { ApprovalChainType, Workflow, WorkflowEdge, WorkflowGroup } from "./types";
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

const approvalProfiles: Record<
  ApprovalChainType,
  {
    owner: string;
    team: string;
    tags: string[];
    requestTitle: string;
    requestSummary: string;
    validationRules: string;
    firstAssignee: string;
    firstRole: string;
    firstInstructions: string;
    secondAssignee: string;
    secondRole: string;
    secondInstructions: string;
    finalApprover: string;
    finalCriteria: string;
  }
> = {
  underwriting: {
    owner: "Qiao Jiang",
    team: "AI Governance",
    tags: ["approval-chain", "underwriting", "governance", "review"],
    requestTitle: "Underwriting Change Request",
    requestSummary: "Business request, proposed routing change, expected benefits, and rollout plan.",
    validationRules: "Confirm owner, risk tier, affected policies, rollout date, evidence packet, and rollback plan are present.",
    firstAssignee: "Qiao Jiang",
    firstRole: "Compliance Lead",
    firstInstructions: "Review fairness impact, audit evidence, consent wording, and retention controls.",
    secondAssignee: "Chad Gordon",
    secondRole: "Legal Counsel",
    secondInstructions: "Review customer-facing wording, vendor obligations, retention, and approval conditions.",
    finalApprover: "Johann Sun",
    finalCriteria: "Compliance and Legal approvals are complete; rollout owner accepts the change window."
  },
  data_engineering: {
    owner: "Data Platform",
    team: "Data Engineering",
    tags: ["approval-chain", "data-engineering", "pipeline", "security"],
    requestTitle: "Data Pipeline Change Request",
    requestSummary: "Schema, pipeline, lineage, access, and downstream dependency review for a data engineering change.",
    validationRules: "Confirm data owner, lineage impact, breaking-schema risk, access class, SLA impact, and rollback plan.",
    firstAssignee: "Chae Won Lee",
    firstRole: "Data Platform Lead",
    firstInstructions: "Review schema compatibility, orchestration impact, lineage, monitoring, and backfill plan.",
    secondAssignee: "Qiao Jiang",
    secondRole: "Security Reviewer",
    secondInstructions: "Review data classification, access controls, secrets handling, and retention requirements.",
    finalApprover: "Qiao Jiang",
    finalCriteria: "Data owner and security approval are complete; pipeline release window is accepted."
  },
  project_approval: {
    owner: "Program Management",
    team: "Project Office",
    tags: ["approval-chain", "project", "finance", "delivery"],
    requestTitle: "Project Approval Request",
    requestSummary: "Project scope, sponsor, timeline, budget, dependency, and risk review before launch.",
    validationRules: "Confirm sponsor, budget, scope, success metric, timeline, dependency owners, and decision record.",
    firstAssignee: "Johann Sun",
    firstRole: "Finance Sponsor",
    firstInstructions: "Review budget, business case, expected value, and funding source.",
    secondAssignee: "Chad Gordon",
    secondRole: "Legal Counsel",
    secondInstructions: "Review contract, vendor, data sharing, and delivery obligation risks.",
    finalApprover: "Johann Sun",
    finalCriteria: "Finance and Legal approvals are complete; delivery owner accepts scope and timeline."
  },
  procurement: {
    owner: "Procurement",
    team: "Vendor Management",
    tags: ["approval-chain", "procurement", "vendor", "security"],
    requestTitle: "Procurement Approval Request",
    requestSummary: "Vendor purchase request with budget, security, legal, and business-owner approvals.",
    validationRules: "Confirm requester, vendor, budget owner, data access, contract path, security review, and renewal terms.",
    firstAssignee: "Johann Sun",
    firstRole: "Budget Owner",
    firstInstructions: "Review purchase amount, business value, cost center, and renewal commitment.",
    secondAssignee: "Qiao Jiang",
    secondRole: "Security Reviewer",
    secondInstructions: "Review vendor access, data handling, security questionnaire, and residual risk.",
    finalApprover: "Chad Gordon",
    finalCriteria: "Budget, Security, and Legal reviews are complete; vendor terms are approved."
  },
  model_governance: {
    owner: "Model Risk",
    team: "AI Governance",
    tags: ["approval-chain", "model-governance", "risk", "release"],
    requestTitle: "Model Governance Approval Request",
    requestSummary: "Model release review with evaluation evidence, risk acceptance, monitoring, and production controls.",
    validationRules: "Confirm model owner, training data, evaluation evidence, bias review, monitoring, approval gates, and rollback plan.",
    firstAssignee: "Qiao Jiang",
    firstRole: "Compliance Lead",
    firstInstructions: "Review policy evidence, fairness notes, audit trail, and monitoring obligations.",
    secondAssignee: "Qiao Jiang",
    secondRole: "Security Reviewer",
    secondInstructions: "Review production access, model endpoint controls, logging, and incident response plan.",
    finalApprover: "Johann Sun",
    finalCriteria: "Compliance and Security approvals are complete; model owner accepts production controls."
  }
};

export function createInsuranceClaimSeveritySample(): Workflow {
  const workflow = createEmptyWorkflow("Insurance claim severity workflow");
  workflow.id = "workflow-claim-severity-sample";
  workflow.description = "End-to-end claim severity modeling workflow from documents and structured claim data to dashboard monitoring.";
  workflow.flowKind = "ai_workflow";
  workflow.owner = "Claims AI";
  workflow.team = "Insurance Analytics";
  workflow.tags = ["claims", "severity", "ml", "llm"];
  workflow.reviewDocuments = [];
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
    defaultColor: color,
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

export function createApprovalChainSample(approvalChainType: ApprovalChainType = "underwriting"): Workflow {
  const profile = approvalProfiles[approvalChainType];
  const chainLabel = getApprovalChainTypeLabel(approvalChainType);
  const workflow = createEmptyWorkflow(`${chainLabel} approval chain`);
  workflow.id = approvalChainType === "underwriting" ? "flow-underwriting-approval-chain-sample" : `flow-${approvalChainType.replaceAll("_", "-")}-approval-chain-sample`;
  workflow.description = `Approval chain for ${chainLabel.toLowerCase()} changes with assigned reviewers and linked review documents.`;
  workflow.flowKind = "approval_chain";
  workflow.approvalChainType = approvalChainType;
  workflow.owner = profile.owner;
  workflow.team = profile.team;
  workflow.tags = profile.tags;
  workflow.createdAt = sampleTimestamp;
  workflow.updatedAt = sampleTimestamp;
  workflow.reviewDocuments = [];
  workflow.groups = [
    ["Request", 80, "#dbeafe"],
    ["Triage", 340, "#cffafe"],
    ["Compliance", 600, "#fef3c7"],
    ["Legal", 860, "#ede9fe"],
    ["Final Approval", 1120, "#dcfce7"],
    ["Publish", 1380, "#ffedd5"],
    ["Audit", 1640, "#e0e7ff"]
  ].map(([title, x, color]) => ({
    id: `group-approval-${slugify(String(title))}`,
    title: String(title),
    description: `${title} stage`,
    position: { x: Number(x), y: 88 },
    width: 225,
    height: 560,
    color: String(color),
    defaultColor: String(color),
    collapsed: false
  })) satisfies WorkflowGroup[];

  const definitions = [
    [
      "review-document",
      "Change Request Packet",
      105,
      165,
      {
        documentTitle: profile.requestTitle,
        documentType: "pdf",
        documentUrl: "/review-documents/underwriting-change-request.pdf",
        summary: profile.requestSummary
      }
    ],
    [
      "data-validation",
      "Completeness Check",
      365,
      165,
      {
        rules: profile.validationRules
      }
    ],
    [
      "approver-assignment",
      "Assign Compliance",
      625,
      125,
      {
        assignee: profile.firstAssignee,
        role: profile.firstRole,
        dueDate: "2026-08-05",
        reviewDocumentUrl: "/review-documents/compliance-checklist.pdf",
        instructions: profile.firstInstructions
      }
    ],
    [
      "human-review",
      "Compliance Review",
      625,
      305,
      {
        reviewer: profile.firstAssignee,
        reviewDocumentUrl: "/review-documents/compliance-checklist.pdf",
        reviewCriteria: "Approve only if the packet includes policy evidence, fairness notes, and monitoring commitments.",
        approvalStatus: "in_review"
      }
    ],
    [
      "approval",
      "Compliance Approval",
      625,
      485,
      {
        approver: profile.firstAssignee,
        approvalCriteria: "Compliance checklist is complete and no unresolved high-risk item remains.",
        approvalStatus: "not_reviewed"
      }
    ],
    [
      "approver-assignment",
      "Assign Legal",
      885,
      125,
      {
        assignee: profile.secondAssignee,
        role: profile.secondRole,
        dueDate: "2026-08-07",
        reviewDocumentUrl: "/review-documents/legal-terms-review.pdf",
        instructions: profile.secondInstructions
      }
    ],
    [
      "human-review",
      "Legal Review",
      885,
      305,
      {
        reviewer: profile.secondAssignee,
        reviewDocumentUrl: "/review-documents/legal-terms-review.pdf",
        reviewCriteria: "Confirm legal terms, data handling, and customer notice language are acceptable.",
        approvalStatus: "not_reviewed"
      }
    ],
    [
      "approval",
      "Legal Approval",
      885,
      485,
      {
        approver: profile.secondAssignee,
        approvalCriteria: "Legal review has no blocking issue and conditional changes are recorded.",
        approvalStatus: "not_reviewed"
      }
    ],
    [
      "approval",
      "Business Owner Approval",
      1145,
      305,
      {
        approver: profile.finalApprover,
        approvalCriteria: profile.finalCriteria,
        approvalStatus: "not_reviewed"
      }
    ],
    [
      "escalation",
      "Escalate Exception",
      1145,
      485,
      {
        escalationPolicy: "Send rejected or overdue approval items to the AI Governance weekly review queue."
      }
    ],
    [
      "notification",
      "Notify Request Owner",
      1405,
      305,
      {
        channel: "Email and Teams",
        audience: "Request owner, approvers, and release coordinator"
      }
    ],
    [
      "report",
      "Approval Audit Record",
      1665,
      305,
      {
        cadence: "On approval",
        destination: "Governance evidence repository"
      }
    ]
  ] as const;

  workflow.nodes = definitions.map(([definitionId, label, x, y, configuration]) => {
    const node = createNodeFromDefinitionId(definitionId, { x, y });
    node.id = `node-approval-${slugify(label)}`;
    node.data.label = label;
    node.data.configuration = { ...node.data.configuration, ...configuration, creator: "Qiao Jiang", documents: createApprovalNodeDocuments(label) };
    node.data.status = "ready";
    return node;
  });

  workflow.edges = [
    ["node-approval-change-request-packet", "node-approval-completeness-check", "Packet", "dependency", "out", "in"],
    ["node-approval-completeness-check", "node-approval-assign-compliance", "Complete", "approval", "out", "in"],
    ["node-approval-assign-compliance", "node-approval-compliance-review", "Assigned", "approval", "out-bottom", "in-top"],
    ["node-approval-compliance-review", "node-approval-compliance-approval", "Review notes", "approval", "out-bottom", "in-top"],
    ["node-approval-compliance-approval", "node-approval-assign-legal", "Compliance approved", "approval", "out", "in"],
    ["node-approval-assign-legal", "node-approval-legal-review", "Assigned", "approval", "out-bottom", "in-top"],
    ["node-approval-legal-review", "node-approval-legal-approval", "Legal notes", "approval", "out-bottom", "in-top"],
    ["node-approval-legal-approval", "node-approval-business-owner-approval", "Legal approved", "approval", "out", "in"],
    ["node-approval-business-owner-approval", "node-approval-notify-request-owner", "Approved", "approval", "out", "in"],
    ["node-approval-notify-request-owner", "node-approval-approval-audit-record", "Evidence", "data", "out", "in"],
    ["node-approval-compliance-approval", "node-approval-escalate-exception", "Rejected", "feedback", "out", "in"],
    ["node-approval-legal-approval", "node-approval-escalate-exception", "Rejected", "feedback", "out-bottom", "in-top"],
    ["node-approval-business-owner-approval", "node-approval-escalate-exception", "Overdue", "feedback", "out-bottom", "in-top"]
  ].map(([source, target, label, type, sourceHandle, targetHandle]) => ({
    id: `edge-${source.replace("node-approval-", "")}-${target.replace("node-approval-", "")}`,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: type as WorkflowEdge["type"],
    label,
    curvature: type === "feedback" ? 0.68 : 0.34
  })) satisfies WorkflowEdge[];

  return workflow;
}

export function createSimpleDemoWorkflow(): Workflow {
  const workflow = createEmptyWorkflow("Simple document approval demo");
  workflow.id = "workflow-simple-document-approval";
  workflow.description = "A compact demo showing intake, AI classification, human approval, publishing, and monitoring.";
  workflow.flowKind = "ai_workflow";
  workflow.owner = "Operations";
  workflow.team = "Workflow Design";
  workflow.tags = ["demo", "approval", "agent"];
  workflow.reviewDocuments = [];
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
    defaultColor: String(color),
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

function createApprovalNodeDocuments(label: string) {
  const slug = slugify(label);
  return [
    {
      id: `doc-${slug}-pdf`,
      title: `${label} SOP`,
      type: "pdf",
      url: `/review-documents/approval-chain/${slug}.pdf`,
      summary: `PDF SOP and review checklist for ${label}.`
    },
    {
      id: `doc-${slug}-docx`,
      title: `${label} review packet`,
      type: "doc",
      url: `/review-documents/approval-chain/${slug}.docx`,
      summary: `Word review packet for approver notes on ${label}.`
    }
  ];
}
