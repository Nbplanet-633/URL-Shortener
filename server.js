// server.js 
import express from "express";
import session from "express-session";
import crypto from "crypto";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs";

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a simple JSON "database"
const USERS_DB = path.join(__dirname, "db_users.json");
const URLS_DB = path.join(__dirname, "db_urls.json");

// Helpers to read/write "database"
function readDb(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function writeDb(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// Initialize DBs if not exist
if (!fs.existsSync(USERS_DB)) writeDb(USERS_DB, []);
if (!fs.existsSync(URLS_DB)) writeDb(URLS_DB, []);

// Express setup
const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "change_this_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 1 week
  })
);

// --- Auth Helpers ---
function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}
function getUser(username) {
  const users = readDb(USERS_DB, []);
  return users.find((u) => u.username === username);
}
function addUser(username, password) {
  const users = readDb(USERS_DB, []);
  if (users.find((u) => u.username === username)) return false;
  users.push({ username, password: hashPassword(password) });
  writeDb(USERS_DB, users);
  return true;
}
function checkUser(username, password) {
  const user = getUser(username);
  return user && user.password === hashPassword(password);
}

// --- Short URL Helpers ---
function generateId(len = 6) {
  return crypto.randomBytes(len).toString("base64url").slice(0, len);
}
function getUserUrls(username) {
  const urls = readDb(URLS_DB, []);
  return urls.filter((u) => u.username === username);
}
function addShortUrl(username, original_url) {
  const urls = readDb(URLS_DB, []);
  // Don't duplicate same original_url for same user
  let found = urls.find(
    (u) => u.username === username && u.original_url === original_url
  );
  if (found) return found;
  let id;
  do {
    id = generateId();
  } while (urls.find((u) => u.id === id));
  const entry = { id, username, original_url };
  urls.push(entry);
  writeDb(URLS_DB, urls);
  return entry;
}
function getShortUrl(id) {
  const urls = readDb(URLS_DB, []);
  return urls.find((u) => u.id === id);
}

// --- Auth APIs ---
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.json({
      success: false,
      error: "Invalid username (3-20 chars, alphanumeric/underscores).",
    });
  }
  if (typeof password !== "string" || password.length < 3) {
    return res.json({
      success: false,
      error: "Password must be at least 3 characters.",
    });
  }
  if (addUser(username, password)) {
    req.session.username = username;
    res.json({ success: true, username });
  } else {
    res.json({ success: false, error: "Username already exists." });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (checkUser(username, password)) {
    req.session.username = username;
    res.json({ success: true, username });
  } else {
    res.json({ success: false, error: "Invalid username or password." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// --- URL Shortener APIs ---
app.post("/api/shorten", (req, res) => {
  const username = req.session.username;
  if (!username) return res.json({ error: "Not logged in." });
  let { originalUrl } = req.body;
  if (!/^https?:\/\/\S+\.\S+/.test(originalUrl)) {
    return res.json({ error: "Invalid URL. Must start with http(s)://" });
  }
  originalUrl = originalUrl.trim();
  const entry = addShortUrl(username, originalUrl);
  res.json({ shortUrl: `${req.protocol}://${req.get("host")}/${entry.id}` });
});

app.get("/api/my-urls", (req, res) => {
  const username = req.session.username;
  if (!username) return res.status(401).json({ error: "Not logged in." });
  const urls = getUserUrls(username);
  res.json({ urls });
});

// --- Redirect handler ---
app.get("/:shortId", (req, res, next) => {
  // Don't break SPA/static files
  if (
    ["api", "public", "favicon.ico", "style.css", "loader.js"].includes(
      req.params.shortId
    )
  )
    return next();
  const entry = getShortUrl(req.params.shortId);
  if (entry) {
    res.redirect(entry.original_url);
  } else {
    res.status(404).send(`
      <html>
        <head>
          <title>URL Not Found</title>
          <style>
            body {
              font-family:sans-serif;
              display:flex; align-items:center; justify-content:center; height:100vh;
              background:#f6f7f9;
            }
            .errbox {
              background:#fff; box-shadow:0 2px 12px #364f6b22; border-radius:20px;
              padding:40px 60px; text-align:center;
              border:2px solid #f7b42c;
            }
            h1 { color: #e84545;}
            a { color: #3fc1c9; text-decoration:underline;}
          </style>
        </head>
        <body>
          <div class="errbox">
            <h1>404</h1>
            <p>Sorry, this short URL does not exist.</p>
            <a href="/">Back to home</a>
          </div>
        </body>
      </html>
    `);
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`URL Shortener listening on http://localhost:${PORT}/`);
});
