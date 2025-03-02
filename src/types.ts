export interface VideoOptions {
  input: string;
  output: string;
  model: string;
  language: string;
  format: string;
  detail: string; // New option for controlling detail level
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
