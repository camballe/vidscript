export interface VideoOptions {
  input: string;
  output: string;
  model: string;
  language: string;
  format: string;
}

export interface FormatMap {
  [key: string]: string;
}
