export interface ProviderOption {
  id: string;
  name: string;
  icon: string;
  appliesTo: string[];
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: "azure",
    name: "Azure",
    icon: "/provider-icons/azure-app-service.svg",
    appliesTo: [
      "database",
      "data-lake",
      "file-storage",
      "ocr",
      "api-source",
      "message-queue",
      "event-stream",
      "feature-store",
      "model-training",
      "model-registry",
      "batch-inference",
      "online-inference",
      "batch-job",
      "container",
      "cloud-service",
      "model-serving",
      "monitoring",
      "logging",
      "dashboard",
      "api-endpoint",
      "database-output"
    ]
  },
  {
    id: "aws",
    name: "AWS",
    icon: "/provider-icons/aws-s3.svg",
    appliesTo: [
      "database",
      "data-lake",
      "file-storage",
      "api-source",
      "message-queue",
      "event-stream",
      "feature-store",
      "model-training",
      "model-registry",
      "batch-inference",
      "online-inference",
      "batch-job",
      "container",
      "cloud-service",
      "model-serving",
      "monitoring",
      "logging",
      "dashboard",
      "api-endpoint",
      "database-output"
    ]
  },
  {
    id: "azure-app-service",
    name: "Azure App Service",
    icon: "/provider-icons/azure-app-service.svg",
    appliesTo: ["api-source", "api-endpoint", "cloud-service", "container", "online-inference", "model-serving"]
  },
  {
    id: "azure-apim",
    name: "Azure API Management",
    icon: "/provider-icons/azure-apim.svg",
    appliesTo: ["api-source", "api-endpoint", "tool", "agent"]
  },
  {
    id: "azure-data-lake",
    name: "Azure Data Lake",
    icon: "/provider-icons/azure-data-lake.svg",
    appliesTo: ["data-lake", "file-storage", "database-output"]
  },
  {
    id: "azure-synapse",
    name: "Azure Synapse",
    icon: "/provider-icons/azure-synapse.svg",
    appliesTo: ["database", "data-lake", "transformation", "feature-store"]
  },
  {
    id: "aws-s3",
    name: "Amazon S3",
    icon: "/provider-icons/aws-s3.svg",
    appliesTo: ["data-lake", "file-storage", "database-output"]
  },
  {
    id: "aws-api-gateway",
    name: "AWS API Gateway",
    icon: "/provider-icons/aws-api-gateway.svg",
    appliesTo: ["api-source", "api-endpoint", "tool"]
  },
  {
    id: "gcp-cloud-storage",
    name: "Google Cloud Storage",
    icon: "/provider-icons/gcp-cloud-storage.svg",
    appliesTo: ["data-lake", "file-storage", "database-output"]
  },
  {
    id: "snowflake",
    name: "Snowflake",
    icon: "/provider-icons/snowflake.svg",
    appliesTo: ["database", "data-lake", "feature-store", "database-output"]
  },
  {
    id: "databricks",
    name: "Databricks",
    icon: "/provider-icons/databricks.svg",
    appliesTo: [
      "database",
      "data-lake",
      "file-storage",
      "data-validation",
      "data-cleaning",
      "transformation",
      "join",
      "aggregation",
      "feature-extraction",
      "feature-engineering",
      "feature-store",
      "train-test-split",
      "model-training",
      "hyperparameter-search",
      "model-evaluation",
      "model-registry",
      "batch-inference",
      "batch-job",
      "monitoring",
      "data-drift",
      "model-drift",
      "quality-monitoring",
      "cost-monitoring",
      "dashboard",
      "database-output"
    ]
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "/provider-icons/openai.svg",
    appliesTo: ["ocr", "llm", "prompt-template", "embedding-model", "agent"]
  }
];

export const PROVIDER_ICON_LIBRARY = PROVIDER_OPTIONS.filter((provider, index, providers) => providers.findIndex((item) => item.id === provider.id) === index);

export function getProviderOption(id?: unknown) {
  return PROVIDER_OPTIONS.find((provider) => provider.id === id);
}

export function getProviderOptionsForNode(definitionId: string) {
  if (definitionId === "data-lake") {
    return PROVIDER_OPTIONS.filter((provider) => ["azure", "aws", "databricks"].includes(provider.id));
  }
  if (definitionId === "ocr") {
    return PROVIDER_OPTIONS.filter((provider) => ["azure", "openai"].includes(provider.id));
  }
  return PROVIDER_OPTIONS.filter((provider) => provider.appliesTo.includes(definitionId));
}

export function normalizeProviderIdForNode(definitionId: string, providerId?: unknown) {
  if (definitionId !== "data-lake") return typeof providerId === "string" ? providerId : "";
  if (providerId === "azure-data-lake" || providerId === "azure-synapse") return "azure";
  if (providerId === "aws-s3") return "aws";
  if (providerId === "databricks" || providerId === "azure" || providerId === "aws") return providerId;
  return "";
}
