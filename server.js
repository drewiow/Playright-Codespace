import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { spawn } from "child_process";
import { EventEmitter } from "events";
import { encryptEnv } from "./Scripts/common/common.mjs";


export const logEmitter = new EventEmitter();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/scripts", express.static(path.join(__dirname, "scripts")));

const runsDir = path.join(__dirname, "runs");
if (!fs.existsSync(runsDir)) fs.mkdirSync(runsDir, { recursive: true });

// Memory upload for env.enc + CSV
import multerMemory from "multer";
const uploadMemory = multerMemory({
    storage: multerMemory.memoryStorage(),
    limits: { fileSize: 5_000_000 }
});


app.post("/api/env/create", async (req, res) => {
    try {
        const { MASTER_PASSWORD, ...envVars } = req.body;

        if (!MASTER_PASSWORD) {
            return res.status(400).json({ error: "Missing master password" });
        }

        const envText = Object.entries(envVars)
            .map(([k, v]) => `${k}=${v}`)
            .join("\n");

        const encrypted = await encryptEnv(envText, MASTER_PASSWORD);

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", "attachment; filename=env.enc");
        res.send(Buffer.from(encrypted));

    } catch (err) {
        console.error("env create error:", err);
        res.status(500).json({ error: "Failed to create env.enc" });
    }
});

// NEW RUNNER — THIS IS THE ONE YOU WANT
app.post("/api/run/:product/:scriptId",
    uploadMemory.fields([
        { name: "envFile", maxCount: 1 },
        { name: "csvFile", maxCount: 1 }
    ]),
    async (req, res) => {
        try {

            const { product, scriptId } = req.params;

            const passphrase = req.body.passphrase || "";
            const options = req.body.options ? JSON.parse(req.body.options) : {};

            // 1. Create run directory FIRST
            const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const runDir = path.join(runsDir, runId);
            fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });

            const manifestPath = path.join(__dirname, "scripts", product, "Manifest.json");

            if (!fs.existsSync(manifestPath)) {
                return res.status(400).json({ error: `Manifest not found for product ${product}` });
            }

            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
            const scriptMeta = manifest.scripts.find(s => s.id === scriptId);

            // Resolve scriptPath (supports .mjs, .js, or index files)
            let scriptPathBase = path.join(__dirname, "scripts", product, scriptId);

            const tryPaths = [
                scriptPathBase,
                scriptPathBase + ".mjs",
                scriptPathBase + ".js",
                path.join(scriptPathBase, "index.mjs"),
                path.join(scriptPathBase, "index.js")
            ];

            let scriptPath = null;
            for (const p of tryPaths) {
                if (fs.existsSync(p) && fs.statSync(p).isFile()) {
                    scriptPath = p;
                    break;
                }
            }

            if (!scriptPath) {
                return res.status(400).json({ error: `Script file not found for ${product}/${scriptId}` });
            }

            if (!scriptMeta) {
                return res.status(400).json({ error: `Script ${scriptId} not found in manifest` });
            }


            // 3. Now you can safely check env file requirements
            const requiresEnv = scriptMeta.requiresEnvFile === true;
            const optionalEnv = scriptMeta.optionalEnvFile === true;

            if (requiresEnv && !req.files?.envFile?.length) {
                return res.status(400).json({ error: "Missing envFile upload" });
            }

            // 4. Save env.enc only if provided
            let envEncPath = null;
            if (req.files?.envFile?.length) {
                envEncPath = path.join(runDir, "env.enc");
                fs.writeFileSync(envEncPath, req.files.envFile[0].buffer, { mode: 0o600 });
            }

            // 5. Build child environment
            const childEnv = { ...process.env };
            if (envEncPath) {
                childEnv.ENV_ENC_PATH = envEncPath;
                childEnv.ENV_PASSPHRASE = passphrase;
            }

            // ✅ Advanced steps (optional)
            if (req.body.advancedSteps) {
                childEnv.ADVANCED_STEPS = req.body.advancedSteps;
            }

            childEnv.RUN_DIR = runDir;
            childEnv.REGION = req.body.region;   // REQUIRED

            // Map ALL dynamic inputs from meta.json into environment variables
            for (const [key, value] of Object.entries(req.body)) {
                if (key === "region" || key === "passphrase" || key === "options") continue;
                childEnv[key.toUpperCase()] = value;
            }

            if (options.humanMode !== undefined)
                childEnv.CONFIG_HUMAN = options.humanMode ? "true" : "false";
            if (options.showBrowser !== undefined)
                childEnv.CONFIG_HEADLESS = options.showBrowser ? "false" : "true";
            if (options.recordVideo !== undefined)
                childEnv.CONFIG_RECORD_VIDEO = options.recordVideo ? "true" : "false";
            if (options.recordTrace !== undefined)
                childEnv.CONFIG_RECORD_TRACE = options.recordTrace ? "true" : "false";

            // Optional CSV
            if (req.files.csvFile?.[0]) {
                const csvBuf = req.files.csvFile[0].buffer;
                const csvName = req.files.csvFile[0].originalname || "input.csv";

                const scriptInputDir = path.join(path.dirname(scriptPath), "input");
                if (!fs.existsSync(scriptInputDir))
                    fs.mkdirSync(scriptInputDir, { recursive: true, mode: 0o700 });

                const scriptCsvPath = path.join(scriptInputDir, csvName);
                fs.writeFileSync(scriptCsvPath, csvBuf, { mode: 0o600 });

                const csvRunPath = path.join(runDir, csvName);
                fs.writeFileSync(csvRunPath, csvBuf, { mode: 0o600 });

                childEnv.CSV_PATH = scriptCsvPath;
            }

            // Spawn child
            const child = spawn(process.execPath, [scriptPath], {
                env: childEnv,
                cwd: runDir,
                stdio: ["ignore", "pipe", "pipe"]
            });

            // Log files
            const stdoutPath = path.join(runDir, "stdout.log");
            const stderrPath = path.join(runDir, "stderr.log");
            const outStream = fs.createWriteStream(stdoutPath, { flags: "a", mode: 0o600 });
            const errStream = fs.createWriteStream(stderrPath, { flags: "a", mode: 0o600 });

            let stdoutBuffer = "";

            child.stdout.on("data", chunk => {
                const text = chunk.toString();
                outStream.write(text);

                stdoutBuffer += text;

                const lines = stdoutBuffer.split(/\r?\n/);
                stdoutBuffer = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    if (!line.trim()) continue;

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        logEmitter.emit("log", {
                            runId,
                            time: new Date().toISOString(),
                            line,
                            stream: "stdout"
                        });
                    }
                    ``
                }
            });

            let stderrBuffer = "";

            child.stderr.on("data", chunk => {
                const text = chunk.toString();
                errStream.write(text);

                stderrBuffer += text;

                const lines = stderrBuffer.split(/\r?\n/);
                stderrBuffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        logEmitter.emit("log", {
                            runId,
                            time: new Date().toISOString(),
                            line,
                            stream: "stderr"
                        });
                    }
                    ``
                }
            });

            child.on("exit", (code, signal) => {
                outStream.end();
                errStream.end();
                logEmitter.emit("run:finished", { runId, code, signal });
            });

            res.status(202).json({ runId, runDir, message: "Run started" });

        } catch (err) {
            console.error("Run start error:", err);
            res.status(500).json({ error: err.message });
        }
    }
);

// SSE log stream for the new runner
app.get("/api/run/:product/:scriptId/logs", (req, res) => {

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendLog = (entry) => {
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    const onLog = (entry) => sendLog(entry);
    const onFinish = (entry) => sendLog(entry);

    logEmitter.on("log", onLog);
    logEmitter.on("run:finished", onFinish);

    req.on("close", () => {
        logEmitter.off("log", onLog);
        logEmitter.off("run:finished", onFinish);
        res.end();
    });
});

// List scripts for a product
app.get("/api/scripts/:product", (req, res) => {
    const product = req.params.product;
    const dir = path.join(__dirname, "scripts", product);

    fs.readdir(dir, { withFileTypes: true }, (err, entries) => {
        if (err) return res.json([]);
        const scripts = entries.filter(e => e.isDirectory()).map(e => e.name);
        res.json(scripts);
    });
});

// Product manifests
app.get("/api/products", async (req, res) => {
    const base = path.join(__dirname, "scripts");
    const folders = await fs.promises.readdir(base);

    const products = [];
    for (const folder of folders) {
        const manifestPath = path.join(base, folder, "manifest.json");
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
            products.push(manifest);
        }
    }
    res.json(products);
});

app.get("/api/products/:id/manifest", async (req, res) => {
    const manifestPath = path.join(__dirname, "scripts", req.params.id, "manifest.json");
    if (!fs.existsSync(manifestPath)) return res.status(404).json({ error: "Not found" });
    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
    res.json(manifest);
});

// Script description
app.get("/api/products/:product/scripts/:script/description", async (req, res) => {
    const filePath = path.join(__dirname, "scripts", req.params.product, req.params.script, "description.md");
    if (!fs.existsSync(filePath)) return res.status(404).send("Description not found");
    res.send(await fs.promises.readFile(filePath, "utf8"));
});

// Video listing
app.get("/api/videos/:product/:run", (req, res) => {
    const dir = path.join(__dirname, "runs", req.params.product, req.params.run, "videos");
    fs.readdir(dir, (err, files) => {
        if (err) return res.json([]);
        res.json(files.filter(f => f.endsWith(".webm") || f.endsWith(".mp4")));
    });
});

// Serve artifacts
app.use("/runs", express.static(path.join(__dirname, "runs")));

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});