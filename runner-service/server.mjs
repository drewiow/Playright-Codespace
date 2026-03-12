// runner-service/server.mjs
import express from "express";
import cors from "cors";
import { createJob, runJob } from "./jobManager.mjs";

const app = express();
const PORT = 3210;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", runner: "local" });
});

app.post("/jobs", async (req, res) => {
  try {
    const job = await createJob(req.body);
    runJob(job); // fire-and-forget for now
    res.json({ jobId: job.id });
  } catch (err) {
    console.error("Job creation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Local Automation Runner listening on http://localhost:${PORT}`);
});