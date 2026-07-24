import type { NodeCategory, NodeDefinition, NodeFieldDefinition } from "./types";
import { getProviderOptionsForNode } from "./providers";

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  data_sources: "Data Sources",
  data_processing: "Data Processing",
  feature_engineering: "Feature Engineering",
  machine_learning: "Machine Learning",
  generative_ai: "Generative AI",
  evaluation: "Evaluation",
  deployment: "Deployment",
  monitoring: "Monitoring",
  human_review: "Human Review",
  outputs: "Outputs",
  documentation: "Documentation"
};

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  data_sources: "#2563eb",
  data_processing: "#0891b2",
  feature_engineering: "#7c3aed",
  machine_learning: "#ea580c",
  generative_ai: "#9333ea",
  evaluation: "#16a34a",
  deployment: "#4f46e5",
  monitoring: "#0f766e",
  human_review: "#d97706",
  outputs: "#e11d48",
  documentation: "#64748b"
};

const commonFields: NodeFieldDefinition[] = [
  { key: "owner", label: "Owner", type: "text", placeholder: "Team or person" },
  { key: "technology", label: "Technology", type: "text", placeholder: "Snowflake, MLflow, GPT-4.1..." },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["not_started", "in_progress", "ready", "needs_review", "blocked"]
  },
  { key: "documentationUrl", label: "Documentation URL", type: "url" },
  { key: "tags", label: "Tags", type: "tags" },
  { key: "notes", label: "Notes", type: "textarea" }
];

const dataFields: NodeFieldDefinition[] = [
  { key: "system", label: "System", type: "text", required: true },
  { key: "format", label: "Format", type: "text" },
  { key: "frequency", label: "Frequency", type: "text" },
  { key: "volume", label: "Volume", type: "text" },
  { key: "sensitivity", label: "Sensitivity", type: "select", options: ["public", "internal", "confidential", "restricted"] }
];

const modelFields: NodeFieldDefinition[] = [
  { key: "modelType", label: "Model type", type: "text", required: true },
  { key: "framework", label: "Framework", type: "text" },
  { key: "target", label: "Target", type: "text" },
  { key: "metrics", label: "Metrics", type: "text" },
  { key: "version", label: "Version", type: "text" }
];

const llmFields: NodeFieldDefinition[] = [
  { key: "provider", label: "Provider", type: "text", required: true },
  { key: "model", label: "Model", type: "text", required: true },
  { key: "prompt", label: "Prompt", type: "textarea" },
  { key: "responseFormat", label: "Response format", type: "text" },
  { key: "guardrails", label: "Guardrails", type: "text" }
];

const evaluationFields: NodeFieldDefinition[] = [
  { key: "dataset", label: "Dataset", type: "text", required: true },
  { key: "metrics", label: "Metrics", type: "text", required: true },
  { key: "thresholds", label: "Thresholds", type: "text" },
  { key: "reviewer", label: "Reviewer", type: "text" }
];

const reviewDocumentFields: NodeFieldDefinition[] = [
  { key: "documentTitle", label: "Document title", type: "text", required: true },
  { key: "documentType", label: "Document type", type: "select", options: ["pdf", "text", "doc", "policy", "contract"] },
  { key: "documentUrl", label: "Document URL", type: "url", required: true },
  { key: "summary", label: "Summary", type: "textarea" }
];

const approverFields: NodeFieldDefinition[] = [
  { key: "assignee", label: "Assignee", type: "text", required: true },
  { key: "role", label: "Role", type: "text" },
  { key: "dueDate", label: "Due date", type: "text" },
  { key: "reviewDocumentUrl", label: "Review document URL", type: "url" },
  { key: "instructions", label: "Instructions", type: "textarea", required: true }
];

const humanReviewFields: NodeFieldDefinition[] = [
  { key: "reviewer", label: "Reviewer", type: "text" },
  { key: "dueDate", label: "Due date", type: "text" },
  { key: "reviewDocumentUrl", label: "Review document URL", type: "url" },
  { key: "reviewCriteria", label: "Review criteria", type: "textarea", required: true }
];

const approvalFields: NodeFieldDefinition[] = [
  { key: "approver", label: "Approver", type: "text" },
  { key: "dueDate", label: "Due date", type: "text" },
  { key: "reviewDocumentUrl", label: "Review document URL", type: "url" },
  { key: "approvalCriteria", label: "Approval criteria", type: "textarea", required: true }
];

function node(
  id: string,
  name: string,
  description: string,
  category: NodeCategory,
  icon: string,
  fields: NodeFieldDefinition[],
  frequentlyUsed = false,
  keywords: string[] = []
): NodeDefinition {
  const providerOptions = getProviderOptionsForNode(id);
  const providerFields: NodeFieldDefinition[] = providerOptions.length
    ? [
        {
          key: "providerId",
          label: "Provider",
          type: "select",
          options: ["", ...providerOptions.map((provider) => provider.id)]
        }
      ]
    : [];
  return {
    id,
    name,
    description,
    category,
    icon,
    frequentlyUsed,
    defaultConfiguration: Object.fromEntries([...providerFields, ...fields].map((field) => [field.key, ""])),
    fields: [...providerFields, ...fields, ...commonFields],
    inputs: category === "data_sources" || category === "documentation" ? [] : [{ id: "in", label: "Input" }],
    outputs: category === "outputs" ? [] : [{ id: "out", label: "Output" }],
    keywords
  };
}

export const NODE_DEFINITIONS: NodeDefinition[] = [
  node("database", "Database", "Structured operational or warehouse data.", "data_sources", "Database", dataFields, true),
  node("data-lake", "Data Lake", "Raw and curated object-store data.", "data_sources", "HardDrive", dataFields),
  node("file-storage", "File Storage", "Documents, CSV files, PDFs, and exports.", "data_sources", "FolderOpen", dataFields, true),
  node("api-source", "API", "External or internal REST/GraphQL data source.", "data_sources", "Webhook", dataFields),
  node("message-queue", "Message Queue", "Streaming events and asynchronous messages.", "data_sources", "RadioTower", dataFields),
  node("event-stream", "Event Stream", "Continuous event data from product, IoT, or operational systems.", "data_sources", "Radio", dataFields, false, ["Kafka", "Kinesis", "Pub/Sub"]),
  node("saas-application", "SaaS Application", "Third-party business application used as a workflow source.", "data_sources", "CloudCog", dataFields, false, ["Salesforce", "ServiceNow", "HubSpot"]),
  node("data-validation", "Data Validation", "Schema, quality, and completeness checks.", "data_processing", "ShieldCheck", [{ key: "rules", label: "Rules", type: "textarea", required: true }], true),
  node("data-cleaning", "Data Cleaning", "Deduplication, normalization, and missing-value repair.", "data_processing", "Sparkles", [{ key: "steps", label: "Cleaning steps", type: "textarea" }]),
  node("transformation", "Transformation", "Joins, aggregations, filters, and derived tables.", "data_processing", "GitBranch", [{ key: "logic", label: "Logic", type: "textarea", required: true }]),
  node("join", "Join", "Combine datasets by keys or entity relationships.", "data_processing", "Combine", [{ key: "joinKeys", label: "Join keys", type: "text", required: true }]),
  node("filter", "Filter", "Limit records based on rules, cohorts, or quality checks.", "data_processing", "ListFilter", [{ key: "criteria", label: "Criteria", type: "textarea", required: true }]),
  node("aggregation", "Aggregation", "Summarize records into metrics, windows, or feature tables.", "data_processing", "Sigma", [{ key: "grain", label: "Grain", type: "text", required: true }]),
  node("deduplication", "Deduplication", "Resolve duplicate records and entity matches.", "data_processing", "CopyX", [{ key: "matchLogic", label: "Match logic", type: "textarea", required: true }]),
  node("ocr", "OCR", "Extract machine-readable text from scanned files.", "data_processing", "ScanText", [{ key: "engine", label: "Engine", type: "text" }]),
  node("feature-extraction", "Feature Extraction", "Extract structured variables from text, media, logs, or records.", "feature_engineering", "ScanLine", [{ key: "features", label: "Extracted features", type: "textarea", required: true }]),
  node("feature-engineering", "Feature Engineering", "Create model-ready predictors.", "feature_engineering", "SlidersHorizontal", [{ key: "features", label: "Features", type: "textarea", required: true }], true),
  node("feature-selection", "Feature Selection", "Choose stable and useful features for modeling.", "feature_engineering", "ListChecks", [{ key: "selectionMethod", label: "Selection method", type: "text", required: true }]),
  node("feature-store", "Feature Store", "Reusable online or offline feature repository.", "feature_engineering", "Boxes", [{ key: "entity", label: "Entity", type: "text", required: true }]),
  node("train-test-split", "Train/Test Split", "Split labeled data into training, validation, and test sets.", "machine_learning", "SplitSquareHorizontal", modelFields),
  node("model-training", "Model Training", "Fit a supervised or unsupervised model.", "machine_learning", "BrainCircuit", modelFields, true),
  node("hyperparameter-search", "Hyperparameter Search", "Optimize model parameters across trials.", "machine_learning", "SearchCheck", modelFields),
  node("model-evaluation", "Model Evaluation", "Evaluate performance, calibration, fairness, and drift.", "evaluation", "Gauge", evaluationFields, true),
  node("offline-evaluation", "Offline Evaluation", "Evaluate candidates on curated offline datasets.", "evaluation", "ClipboardCheck", evaluationFields),
  node("human-evaluation", "Human Evaluation", "Reviewer scoring for model, prompt, or output quality.", "evaluation", "UsersRound", evaluationFields),
  node("bias-evaluation", "Bias Evaluation", "Assess subgroup performance and fairness risks.", "evaluation", "Scale", evaluationFields),
  node("safety-evaluation", "Safety Evaluation", "Evaluate harmful outputs, policy violations, and safety controls.", "evaluation", "ShieldQuestion", evaluationFields),
  node("model-registry", "Model Registry", "Register model versions, approvals, and metadata.", "deployment", "Archive", modelFields, false, ["MLflow", "SageMaker", "Azure ML"]),
  node("batch-inference", "Batch Inference", "Scheduled scoring for many records.", "deployment", "CalendarClock", modelFields, false, ["Batch job", "Airflow", "Databricks"]),
  node("online-inference", "Real-Time Inference", "Low-latency model serving endpoint.", "deployment", "Zap", modelFields, false, ["model serving", "endpoint"]),
  node("batch-job", "Batch Job", "Scheduled job that materializes outputs or scores.", "deployment", "CalendarDays", modelFields),
  node("container", "Container", "Containerized model or application runtime.", "deployment", "Container", modelFields, false, ["Docker", "Kubernetes"]),
  node("cloud-service", "Cloud Service", "Managed platform service used by the workflow.", "deployment", "Cloud", modelFields, false, ["AWS", "Azure", "GCP"]),
  node("model-serving", "Model Serving", "Service layer that exposes a model for applications.", "deployment", "ServerCog", modelFields),
  node("prompt-template", "Prompt Template", "Reusable prompt with variables and output expectations.", "generative_ai", "MessageSquareText", llmFields, true),
  node("llm", "LLM", "Large language model call or reasoning step.", "generative_ai", "Bot", llmFields, true),
  node("embedding-model", "Embedding Model", "Generate vector representations.", "generative_ai", "Binary", llmFields),
  node("vector-db", "Vector Database", "Store and search embeddings.", "generative_ai", "Component", [{ key: "index", label: "Index", type: "text", required: true }]),
  node("retrieval", "Retrieval", "Find relevant records, documents, or context snippets.", "generative_ai", "Search", [{ key: "retrievalPolicy", label: "Retrieval policy", type: "textarea", required: true }]),
  node("rag-retrieval", "RAG Retrieval", "Retrieve relevant content for grounded generation.", "generative_ai", "Search", [{ key: "retrievalPolicy", label: "Retrieval policy", type: "textarea", required: true }], false, ["RAG"]),
  node("agent", "Agent", "Tool-using reasoning workflow.", "generative_ai", "Workflow", llmFields),
  node("tool", "Tool", "Callable function or API exposed to an agent.", "generative_ai", "Wrench", [{ key: "contract", label: "Tool contract", type: "textarea", required: true }]),
  node("guardrail", "Guardrail", "Policy checks, safety filters, and allowed-action controls.", "generative_ai", "ShieldAlert", [{ key: "policy", label: "Policy", type: "textarea", required: true }]),
  node("human-review", "Human Review", "Manual review, approval, or exception handling.", "human_review", "UserCheck", humanReviewFields, true),
  node("review-document", "Review Document", "Document, PDF, policy, or packet that a reviewer must inspect.", "documentation", "FileText", reviewDocumentFields, true, ["approval", "pdf", "document", "review"]),
  node("approver-assignment", "Approver Assignment", "Assign a named reviewer to an approval step with due dates and instructions.", "human_review", "UserPlus", approverFields, true, ["approval", "assignee", "reviewer"]),
  node("approval", "Approval", "Formal human approval gate before deployment or action.", "human_review", "BadgeCheck", approvalFields),
  node("escalation", "Escalation", "Route uncertain or high-risk cases to a reviewer.", "human_review", "CircleArrowUp", [{ key: "escalationPolicy", label: "Escalation policy", type: "textarea", required: true }]),
  node("feedback", "Feedback", "Collect human corrections or downstream labels.", "human_review", "MessagesSquare", [{ key: "feedbackLoop", label: "Feedback loop", type: "textarea", required: true }]),
  node("ab-test", "A/B Test", "Compare model, prompt, or experience variants.", "evaluation", "FlaskConical", evaluationFields),
  node("monitoring", "Monitoring", "Observe quality, latency, drift, and incidents.", "monitoring", "Activity", [{ key: "signals", label: "Signals", type: "textarea", required: true }], true),
  node("data-drift", "Data Drift", "Monitor source and feature distribution changes.", "monitoring", "ChartNoAxesCombined", [{ key: "signals", label: "Signals", type: "textarea", required: true }]),
  node("model-drift", "Model Drift", "Monitor prediction, calibration, and performance movement.", "monitoring", "TrendingDown", [{ key: "signals", label: "Signals", type: "textarea", required: true }]),
  node("quality-monitoring", "Quality Monitoring", "Track output quality, reviewer overrides, and acceptance rates.", "monitoring", "BadgeCheck", [{ key: "qualitySignals", label: "Quality signals", type: "textarea", required: true }]),
  node("cost-monitoring", "Cost Monitoring", "Track compute, API, token, or storage cost.", "monitoring", "CircleDollarSign", [{ key: "costSignals", label: "Cost signals", type: "textarea", required: true }]),
  node("logging", "Logging", "Persist events, traces, and operational logs.", "monitoring", "ScrollText", [{ key: "logEvents", label: "Log events", type: "textarea", required: true }]),
  node("alert", "Alert", "Notify owners when thresholds are breached.", "monitoring", "BellRing", [{ key: "threshold", label: "Threshold", type: "text", required: true }]),
  node("dashboard", "Dashboard", "Operational or business-facing metrics surface.", "outputs", "LayoutDashboard", [{ key: "audience", label: "Audience", type: "text", required: true }]),
  node("api-endpoint", "API Endpoint", "Application-facing workflow result endpoint.", "outputs", "Cable", [{ key: "contract", label: "Contract", type: "textarea", required: true }]),
  node("business-app", "Business Application", "Downstream application or decision workflow.", "outputs", "BriefcaseBusiness", [{ key: "process", label: "Process", type: "text", required: true }]),
  node("notification", "Notification", "Message or alert sent to users or systems.", "outputs", "Send", [{ key: "channel", label: "Channel", type: "text", required: true }]),
  node("database-output", "Database Output", "Persist workflow outputs back to a table or store.", "outputs", "DatabaseZap", [{ key: "destination", label: "Destination", type: "text", required: true }]),
  node("report", "Report", "Narrative or tabular workflow output.", "outputs", "FileText", [{ key: "cadence", label: "Cadence", type: "text" }]),
  node("comment", "Comment", "Documentation note attached to the design.", "documentation", "StickyNote", [{ key: "note", label: "Note", type: "textarea", required: true }]),
  node("assumption", "Assumption", "Important assumption that shapes the workflow design.", "documentation", "BadgeHelp", [{ key: "assumption", label: "Assumption", type: "textarea", required: true }]),
  node("risk", "Risk", "Known risk, uncertainty, or operational concern.", "documentation", "TriangleAlert", [{ key: "risk", label: "Risk", type: "textarea", required: true }]),
  node("decision", "Decision", "Architecture, governance, or product decision record.", "documentation", "GitPullRequestArrow", [{ key: "decision", label: "Decision", type: "textarea", required: true }]),
  node("external-reference", "External Reference", "Link to supporting documentation or external system.", "documentation", "ExternalLink", [{ key: "referenceUrl", label: "Reference URL", type: "url", required: true }])
];

export function getNodeDefinition(definitionId: string) {
  return NODE_DEFINITIONS.find((definition) => definition.id === definitionId);
}

export function getDefinitionsByCategory() {
  return NODE_DEFINITIONS.reduce<Record<NodeCategory, NodeDefinition[]>>((groups, definition) => {
    groups[definition.category] = [...(groups[definition.category] ?? []), definition];
    return groups;
  }, {} as Record<NodeCategory, NodeDefinition[]>);
}
