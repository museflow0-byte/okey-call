import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// --- paths για να σερβίρουμε το index.html / static
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

const DAILY_API_KEY = process.env.DAILY_API_KEY;     // π.χ. "sk_***"
const DAILY_DOMAIN = process.env.DAILY_DOMAIN;       // π.χ. "museflow.daily.co"
const MANAGER_PASS = process.env.MANAGER_PASS || ""; // optional

if (!DAILY_API_KEY || !DAILY_DOMAIN) {
  console.error("Missing DAILY_API_KEY or DAILY_DOMAIN in env!");
}

// Aπλό health + σερβίρει τη φόρμα
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Δημιουργία κλήσης -> επιστρέφει 3 links
app.post("/api/create-call", async (req, res) => {
  try {
    const {
      durationMinutes = 30,
      clientName = "Client",
      modelName = "Model",
      managerName = "Manager",
      managerPass = ""
    } = req.body || {};

    // (προαιρετικό) απλό pass για manager
    if (MANAGER_PASS && MANAGER_PASS !== managerPass) {
      return res.status(401).json({ error: "Invalid manager password" });
    }

    const expiresInSec = Math.max(1, Number(durationMinutes)) * 60;
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;

    // Δημιουργία room στο Daily
    const roomResp = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        privacy: "private",
        properties: {
          exp     // λήξη room
        }
      })
    });

    if (!roomResp.ok) {
      const txt = await roomResp.text();
      return res.status(400).json({ error: "Daily API error", details: txt });
    }

    const room = await roomResp.json();
    // Daily συνήθως επιστρέφει { url: "https://<domain>/room_xxx", name: ... }
    const roomUrl = room.url || `https://${DAILY_DOMAIN}/room_${room.name}`;

    const modelUrl   = `${roomUrl}?userName=${encodeURIComponent(modelName)}`;
    const clientUrl  = `${roomUrl}?userName=${encodeURIComponent(clientName)}`;
    const managerUrl = `${roomUrl}?userName=${encodeURIComponent(managerName)}`;

    return res.json({
      ok: true,
      expiresAt: exp,
      links: {
        model: modelUrl,
        client: clientUrl,
        managerStealth: managerUrl
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: String(err) });
  }
});

// Render ακούει από το PORT env
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`YourBrand Calls running on ${PORT}`);
});
