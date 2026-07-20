export interface ProviderOption {
  id: string;
  name: string;
  icon: string;
  appliesTo: string[];
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
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
    appliesTo: ["data-lake", "feature-engineering", "model-training", "batch-inference", "batch-job"]
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "/provider-icons/openai.svg",
    appliesTo: ["llm", "prompt-template", "embedding-model", "agent"]
  }
];

export function getProviderOption(id?: unknown) {
  return PROVIDER_OPTIONS.find((provider) => provider.id === id);
}

export function getProviderOptionsForNode(definitionId: string) {
  return PROVIDER_OPTIONS.filter((provider) => provider.appliesTo.includes(definitionId));
}
