//// filepath: src/createPDFHtml.ts
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { marked } from "marked";

export async function createPDFfromHTML(
  notes: string,
  options: { output: string }
): Promise<string> {
  // Convert the raw Markdown notes to HTML using marked
  const htmlBody = marked.parse(notes);

  // Build a robust HTML template with custom CSS
  const htmlContent = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Video Notes</title>
      <style>
        @page {
          margin: 50px;
        }
        body {
          font-family: Helvetica, Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #333;
          margin: 0;
          padding: 0;
        }
        header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
        }
        header h1 {
          font-size: 24px;
          margin: 0;
          font-weight: bold;
        }
        main {
          margin: 0 50px;
        }
        h1, h2, h3, h4, h5, h6 {
          color: #333;
          margin-top: 20px;
          margin-bottom: 10px;
        }
        p {
          margin: 0 0 10px;
          text-align: justify;
        }
        ul {
          margin: 10px 0 10px 20px;
          padding: 0;
          list-style-type: disc;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>Video Notes</h1>
      </header>
      <main>
        ${htmlBody}
      </main>
    </body>
  </html>
  `;

  const outputFileName = `Notes_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.pdf`;
  const outputPath = path.join(options.output, outputFileName);

  // Launch headless Chrome using Puppeteer
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  // Generate PDF with print background enabled and A4 format
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: { top: "50px", bottom: "50px", left: "50px", right: "50px" },
  });
  await browser.close();

  return outputPath;
}
