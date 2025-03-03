export interface VideoOptions {
  input: string;
  output: string;
  model?: string;
  language?: string;
  format?: "detailed" | "concise" | "bullet";
  detail?: "standard" | "comprehensive" | "exhaustive";
  vectorStore?: {
    enabled: boolean;
    indexName?: string;
    namespace?: string;
  };
}

export interface FormatMap {
  [key: string]: string;
}

export interface ModelMap {
  [key: string]: {
    provider: string;
    modelName: string;
    contextWindow: number;
  };
}

export interface PDFOptions {
  output: string;
}
