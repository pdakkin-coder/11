import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { handleAiAnalyze, handleAiConvert } from "./aiAnalyze.js";
import { handleImportUrl } from "./importUrl.js";
import { handleExportDrive } from "./exportDrive.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // AI routes
  app.post("/api/ai-analyze", handleAiAnalyze);
  app.post("/api/ai-convert", handleAiConvert);

  // Import / Export
  app.post("/api/import-url",    handleImportUrl);
  app.post("/api/export-drive",  handleExportDrive);

  // Storage (kept for future use)
  app.get("/api/documents", async (_req, res) => {
    const docs = await storage.getAllDocuments();
    res.json(docs);
  });

  const httpServer = createServer(app);
  return httpServer;
}
