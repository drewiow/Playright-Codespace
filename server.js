import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";
import fsp from "fsp";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { EventEmitter } from "events";
import { encryptEnv, decryptEnv } from "./Scripts/common/common.mjs";
import cookieParser from "cookie-parser";
import { parseAdvancedSteps } from "./Scripts/advanced/parseAdvancedSteps.mjs";


console.log("SERVER INSTANCE STARTED", Date.now());

// Memory session store
const sessions = new Map();

// Multer for file upload
const upload = multer({ dest: "uploads/" });

export const logEmitter = new EventEmitter();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runningProcesses = {};
const app = express();
const port = 3000;

app.use(cookieParser());
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

function requireAuth(req, res, next) {
    const sessionId = req.cookies?.session;
    const session = sessions.get(sessionId);

    console.log(req.cookies);
    console.log(session);
    console.log(sessionId);

    if (!sessionId) {
        return res.status(401).json({ error: "No session cookie" });
    }

    if (!session) {
        return res.status(401).json({ error: "Session not found" });
    }

    req.user = session;
    next();
}

app.get("/api/session/me", requireAuth, (req, res) => {

    res.json({
        user: req.user,
        role: req.user.role,
        thumbprint: req.user.thumbprint
    });
});

app.post("/api/login", upload.single("envFile"), async (req, res) => {
    try {
        console.log("Logging in");
        const file = req.file;
        const passphrase = req.body.passphrase;

        if (!file) {
            return res.status(400).json({ error: "Missing encrypted file" });
        }

        if (!passphrase) {
            return res.status(400).json({ error: "Missing passphrase" });
        }

        // 1. Decrypt the env.enc file
        let decryptedText;
        try {
            decryptedText = await decryptEnv(file.path, passphrase);
        } catch (err) {
            console.error("Decryption failed:", err);
            return res.status(401).json({ error: "Invalid file or passphrase" });
        }

        // 2. Parse decrypted env into an object
        const envVars = {};
        decryptedText.split(/\r?\n/).forEach(line => {
            const [key, ...rest] = line.split("=");
            if (!key) return;
            envVars[key.trim()] = rest.join("=").trim();
        });

        // 3. Build session object
        const sessionId = crypto.randomUUID();

        const session = {
            sessionId,
            userId: envVars.USER_ID || "unknown",
            displayName: envVars.DISPLAY_NAME || "User",
            email: envVars.EMAIL || "",
            roles: (envVars.ROLES || "").split(",").map(r => r.trim()).filter(Boolean),
            envFingerprint: crypto.createHash("sha256").update(decryptedText).digest("hex"),
            loginTime: new Date().toISOString()
        };

        // 4. Store session in memory
        sessions.set(sessionId, session);
        console.log("Stored session:", sessionId, sessions.has(sessionId));

        // 5. Set session cookie
        res.cookie("session", sessionId, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            path: "/"  // set true in production with HTTPS
        });

        // 6. Return session info
        return res.json(session);

    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ error: "Login failed" });
    } finally {
        // Cleanup uploaded file
        if (req.file?.path) {
            fs.unlink(req.file.path, () => { });
        }
    }
});

app.post("/api/logout", requireAuth, (req, res) => {
    const sessionId = req.cookies.session;

    // Remove from memory
    sessions.delete(sessionId);

    // Clear cookie
    res.clearCookie("session", {
        path: "/"
    });

    res.json({ success: true });
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

app.post("/api/run/:runId/stop", requireAuth, (req, res) => {
    const { runId } = req.params;
    const child = runningProcesses[runId];

    if (!child) {
        return res.status(404).json({ error: "Run not found or already finished" });
    }

    // Graceful stop
    child.kill("SIGTERM");

    res.json({ ok: true, message: "Stop signal sent" });
});

// NEW RUNNER — THIS IS THE ONE YOU WANT
app.post("/api/run/:product/:scriptId", requireAuth,
    uploadMemory.fields([
        { name: "envFile", maxCount: 1 },
        { name: "csvFile", maxCount: 1 }
    ]),
    async (req, res) => {
        try {

            const { product, scriptId } = req.params;

            const passphrase = req.body.passphrase || "";
            const options = req.body.options ? JSON.parse(req.body.options) : {};
            console.log("BACKEND OPTIONS:", options);

            // 1. Create run directory FIRST
            const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const runDir = path.join(runsDir, runId);
            fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
            options.runDir = runDir;
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
            const parsedSteps = parseAdvancedSteps(childEnv.ADVANCED_STEPS || "");
            const stepsHash = crypto
                .createHash("sha256")
                .update(childEnv.ADVANCED_STEPS || "")
                .digest("hex");

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
            if (options.dryRun !== undefined)
                childEnv.DRY_RUN = options.dryRun ? "true" : "false";

            // Optional CSV
            let csvHash = null;
            let csvName = null;

            if (req.files.csvFile?.[0]) {
                const csvBuf = req.files.csvFile[0].buffer;
                csvName = req.files.csvFile[0].originalname || "input.csv";

                const scriptInputDir = path.join(path.dirname(scriptPath), "input");
                if (!fs.existsSync(scriptInputDir))
                    fs.mkdirSync(scriptInputDir, { recursive: true, mode: 0o700 });

                const scriptCsvPath = path.join(scriptInputDir, csvName);
                fs.writeFileSync(scriptCsvPath, csvBuf, { mode: 0o600 });

                csvHash = crypto
                    .createHash("sha256")
                    .update(csvBuf)
                    .digest("hex");

                const csvRunPath = path.join(runDir, csvName);
                fs.writeFileSync(csvRunPath, csvBuf, { mode: 0o600 });

                childEnv.CSV_PATH = scriptCsvPath;
            }

            const userThumbprint = crypto
                .createHash("sha256")
                .update(`${req.user.userId}:${req.user.email}:${req.user.roles.join(",")}`)
                .digest("hex");

            const metadata = {
                runId,
                script: scriptMeta?.name || scriptId,
                user: {
                    userId: req.user.userId,
                    displayName: req.user.displayName,
                    roles: req.user.roles,
                    thumbprint: userThumbprint
                },
                csvFile: {
                    csvHash: csvHash || null,
                    csvFilename: csvName || null
                },
                advancedSteps: stepsHash || null,
                guardedSteps: parsedSteps.filter(s => s.raw.startsWith("guard ")).length,
                timestamp: new Date().toISOString(),
                parameters: req.body.parameters,
                status: "running"
            };
            fs.writeFileSync(
                path.join(runDir, "metadata.json"),
                JSON.stringify(metadata, null, 2)
            );

            // Spawn child
            const startTime = Date.now();
            const child = spawn(process.execPath, [scriptPath], {
                env: childEnv,
                cwd: runDir,
                stdio: ["ignore", "pipe", "pipe"]
            });
            runningProcesses[runId] = child;
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

                    logEmitter.emit("log", {
                        runId,
                        time: new Date().toISOString(),
                        line,
                        stream: "stdout"
                    });
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

                    logEmitter.emit("log", {
                        runId,
                        time: new Date().toISOString(),
                        line,
                        stream: "stderr"
                    });
                }
            });

            child.on("exit", (code, signal) => {
                outStream.end();
                errStream.end();

                delete runningProcesses[runId];

                // Load existing metadata
                const metadataPath = path.join(runDir, "metadata.json");
                let metadata = {};

                if (fs.existsSync(metadataPath)) {
                    metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
                }

                // Update metadata
                if (signal === "SIGTERM") {
                    metadata.status = "stopped";
                } else {
                    metadata.status = code === 0 ? "success" : "failed";
                }

                metadata.durationMs = Date.now() - startTime;
                metadata.completedAt = new Date().toISOString();
                metadata.exitCode = code;
                metadata.signal = signal;

                // Save updated metadata
                fs.writeFileSync(
                    metadataPath,
                    JSON.stringify(metadata, null, 2)
                );

                logEmitter.emit("run:finished", { runId, code, signal });
            });

            res.status(202).json({ runId, runDir, message: "Run started" });

        } catch (err) {
            console.error("Run start error:", err);
            res.status(500).json({ error: err.message });
        }
    }
);

app.get("/api/runs", requireAuth, (req, res) => {
    const runsRoot = path.join(__dirname, "runs");

    try {
        const runIds = fs.readdirSync(runsRoot);
        const allRuns = [];

        runIds.forEach(runId => {
            const metaPath = path.join(runsRoot, runId, "metadata.json");
            if (!fs.existsSync(metaPath)) return;

            const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
            allRuns.push(meta);
        });

        allRuns.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

        res.json(allRuns);

    } catch (err) {
        console.error("Failed to load run history:", err);
        res.status(500).json({ error: "Failed to load run history" });
    }
});
app.get("/api/run/:runId", requireAuth, (req, res) => {
    const runId = req.params.runId;
    const runDir = path.join(__dirname, "runs", runId);
    const metaPath = path.join(runDir, "metadata.json");

    if (!fs.existsSync(metaPath)) {
        return res.status(404).json({ error: "Run not found" });
    }

    try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        res.json(meta);
    } catch (err) {
        console.error("Failed to load metadata:", err);
        res.status(500).json({ error: "Failed to load metadata" });
    }
});

app.get("/api/run/:runId/logs", requireAuth, (req, res) => {
    const runId = req.params.runId;
    const runDir = path.join(__dirname, "runs", runId);

    const stdoutPath = path.join(runDir, "stdout.log");
    const stderrPath = path.join(runDir, "stderr.log");

    res.json({
        stdout: fs.existsSync(stdoutPath) ? fs.readFileSync(stdoutPath, "utf8") : "",
        stderr: fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, "utf8") : ""
    });
});
app.get("/api/run/:runId/artifacts", requireAuth, (req, res) => {
    const runId = req.params.runId;
    const runDir = path.join(__dirname, "runs", runId);

    if (!fs.existsSync(runDir)) {
        return res.status(404).json({ error: "Run not found" });
    }

    const files = [];

    function walk(dir, prefix = "") {
        const items = fs.readdirSync(dir);

        items.forEach(item => {
            const full = path.join(dir, item);
            const rel = path.join(prefix, item);

            if (fs.statSync(full).isDirectory()) {
                walk(full, rel);
            } else {
                files.push(rel);
            }
        });
        console.log("ARTIFACT FILES:", files);
    }

    walk(runDir);

    res.json(files);
});
app.get("/api/run/:runId/artifact", requireAuth, (req, res) => {
    const runId = req.params.runId;
    const file = req.query.path; // full relative path

    if (!file) {
        return res.status(400).json({ error: "Missing ?path=" });
    }

    const filePath = path.join(__dirname, "runs", runId, file);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Artifact not found" });
    }

    res.download(filePath);
});

app.get("/api/run/:product/:scriptId/logs", requireAuth, (req, res) => {

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendLog = (entry) => {
        res.write(`event: log\n`);
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    const sendFinish = (entry) => {
        res.write(`event: run:finished\n`);
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    const onLog = (entry) => sendLog(entry);
    const onFinish = (entry) => sendFinish(entry);

    logEmitter.on("log", onLog);
    logEmitter.on("run:finished", onFinish);

    req.on("close", () => {
        logEmitter.off("log", onLog);
        logEmitter.off("run:finished", onFinish);
        res.end();
    });
});

// List scripts for a product
app.get("/api/scripts/:product", requireAuth, (req, res) => {
    const product = req.params.product;
    const dir = path.join(__dirname, "scripts", product);

    fs.readdir(dir, { withFileTypes: true }, (err, entries) => {
        if (err) return res.json([]);
        const scripts = entries.filter(e => e.isDirectory()).map(e => e.name);
        res.json(scripts);
    });
});

// Product manifests
app.get("/api/products", requireAuth, async (req, res) => {
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

app.get("/api/products/:id/manifest", requireAuth, async (req, res) => {
    const manifestPath = path.join(__dirname, "scripts", req.params.id, "manifest.json");
    if (!fs.existsSync(manifestPath)) return res.status(404).json({ error: "Not found" });
    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
    res.json(manifest);
});

// Script description
app.get("/api/products/:product/scripts/:script/description", requireAuth, async (req, res) => {
    const filePath = path.join(__dirname, "scripts", req.params.product, req.params.script, "description.md");
    if (!fs.existsSync(filePath)) return res.status(404).send("Description not found");
    res.send(await fs.promises.readFile(filePath, "utf8"));
});

// Video listing
app.get("/api/videos/:product/:run", requireAuth, (req, res) => {
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