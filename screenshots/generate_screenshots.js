const http = require("http");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const TURENG_DIR = path.join(ROOT_DIR, "Tureng");
const OUT_DIR = path.join(ROOT_DIR, "screenshots");

function buildTableHtml(c2, c3, rows, summary) {
  let html = "";
  if (summary) {
    html += `
      <section class="term-description-box">
        <dl>
          <div class="td-field">
            <dt>${summary.dt}</dt>
            <dd><a href="#">${summary.ddLink}</a></dd>
          </div>
          <div class="td-definition">
            <dd>${summary.definition}</dd>
          </div>
        </dl>
      </section>
    `;
  }
  html += `<table class="searchResultsTable">
    <tr><th class="c0">#</th><th class="c1">Usage</th><th class="c2">${c2}</th><th class="c3">${c3}</th></tr>`;
  rows.forEach((r, idx) => {
    const [usage, word, wType, def, dType] = r;
    html += `<tr>
      <td>${idx + 1}</td>
      <td>${usage}</td>
      <td><a href="#">${word}</a>${wType ? `<i>${wType}</i>` : ""}</td>
      <td><a href="#">${def}</a>${dType ? `<i>${dType}</i>` : ""}</td>
    </tr>`;
  });
  html += `</table>`;
  return html;
}

const HELLO_HTML = buildTableHtml(
  "İngilizce",
  "Türkçe",
  [
    ["Yaygın Kullanım", "hello", "ünl.", "merhaba", ""],
    ["Genel", "hello", "ünl.", "selam", ""],
    ["Genel", "hello", "ünl.", "merhaba", ""],
    ["Genel", "hello", "ünl.", "alo", ""],
    ["Genel", "hello", "ünl.", "günaydın!", ""],
    ["Genel", "hello", "ünl.", "hey", ""],
    ["Genel", "hello", "ünl.", "hayda", ""],
    ["Genel", "hello", "i.", "merhaba deme", ""],
    ["Genel", "hello", "f.", "merhaba demek", ""],
    ["Genel", "hello", "i.", "selam", ""],
  ],
  {
    dt: "Anlamı ve Tanımı:",
    ddLink: "merhaba",
    definition:
      "Karşılaşmalarda dikkat çekmek veya selam vermek için kullanılan ünlemdir; gündelik iletişimin temel unsurlarındandır. 19. yüzyılda telefon kullanımının yayılmasıyla standart selamlama biçimi olarak yerleşmiştir.",
  }
);

const MERHABA_HTML = buildTableHtml("Türkçe", "İngilizce", [
  ["Yaygın Kullanım", "merhaba", "", "hello", "ünl."],
  ["Yaygın Kullanım", "merhaba", "", "hi", "ünl."],
  ["Genel", "merhaba", "", "hello", "ünl."],
  ["Genel", "merhaba", "", "howdy", "ünl."],
  ["Konuşma", "merhaba", "", "howdy", "ünl."],
  ["Chatleşme Dili", "merhaba", "", "hiya", "expr."],
  ["Chatleşme Dili", "merhaba", "", "hello there", "expr."],
  ["Chatleşme Dili", "merhaba", "", "hi there", "expr."],
  ["Genel", "merhaba", "", "how-do-you-do", "zf."],
  ["Genel", "merhaba", "", "hi!", "ünl."],
  ["Genel", "merhaba", "", "howdie", "ünl."],
  ["Genel", "merhaba", "", "hullo", "ünl."],
  ["Genel", "merhaba", "", "ahey", "ünl."],
]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".svg": "image/svg+xml",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url, "http://127.0.0.1");
      let pathname = urlObj.pathname === "/" ? "/popup.html" : urlObj.pathname;
      const filePath = path.join(TURENG_DIR, pathname);

      if (pathname === "/popup.html") {
        let html = fs.readFileSync(filePath, "utf8");
        const mockScript = `
          <script>
            window.__MOCK_DATA__ = ${JSON.stringify({
              hello: HELLO_HTML,
              merhaba: MERHABA_HTML,
            })};
            const params = new URLSearchParams(window.location.search);
            const historyParam = params.get("history");
            if (historyParam) {
              localStorage.setItem("tureng_history", historyParam);
            } else {
              localStorage.removeItem("tureng_history");
            }
            const wordParam = params.get("word") || "";
            window.browser = {
              tabs: {
                query: async () => [{ id: 1 }],
                create: async () => {}
              },
              scripting: {
                executeScript: async () => [{ result: wordParam }]
              },
              runtime: {
                sendMessage: async (msg) => {
                  if (msg && msg.type === "TURENG_SEARCH") {
                    const q = msg.query.trim().toLowerCase();
                    const html = window.__MOCK_DATA__[q];
                    return { ok: Boolean(html), status: html ? 200 : 404, html: html || "" };
                  }
                  return { ok: false };
                }
              }
            };
          </script>
        `;
        html = html.replace(
          '<script src="scripts/safeResponse.js"></script>',
          mockScript + '\n<script src="scripts/safeResponse.js"></script>'
        );
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        });
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

class MarionetteClient {
  constructor(port) {
    this.port = port;
    this.msgId = 0;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      const tryConnect = (attemptsLeft) => {
        const sock = net.createConnection({ host: "127.0.0.1", port: this.port });
        sock.once("connect", () => {
          this.sock = sock;
          let handshakeDone = false;
          sock.on("data", (chunk) => {
            this.buffer = Buffer.concat([this.buffer, chunk]);
            while (true) {
              const colonIdx = this.buffer.indexOf(58); // ':'
              if (colonIdx === -1) break;
              const len = parseInt(this.buffer.slice(0, colonIdx).toString(), 10);
              if (this.buffer.length < colonIdx + 1 + len) break;
              const jsonBytes = this.buffer.slice(colonIdx + 1, colonIdx + 1 + len);
              this.buffer = this.buffer.slice(colonIdx + 1 + len);
              const msg = JSON.parse(jsonBytes.toString("utf8"));
              if (!handshakeDone) {
                handshakeDone = true;
                resolve();
              } else if (Array.isArray(msg) && msg[0] === 1) {
                const [, id, err, res] = msg;
                const p = this.pending.get(id);
                if (p) {
                  this.pending.delete(id);
                  if (err) p.reject(new Error(JSON.stringify(err)));
                  else p.resolve(res);
                }
              }
            }
          });
        });
        sock.once("error", (err) => {
          if (attemptsLeft > 0) {
            setTimeout(() => tryConnect(attemptsLeft - 1), 300);
          } else {
            reject(err);
          }
        });
      };
      tryConnect(30);
    });
  }

  send(name, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      const payload = JSON.stringify([0, id, name, params]);
      const byteLen = Buffer.byteLength(payload, "utf8");
      this.sock.write(`${byteLen}:${payload}`);
    });
  }

  close() {
    if (this.sock) this.sock.destroy();
  }
}

(async () => {
  const { server, port } = await startServer();
  const profileDir = fs.mkdtempSync("/tmp/zen-screenshot-profile-");
  const marionettePort = 28280 + Math.floor(Math.random() * 1000);

  fs.writeFileSync(
    path.join(profileDir, "user.js"),
    `
    user_pref("marionette.port", ${marionettePort});
    user_pref("layout.css.devPixelsPerPx", "2.0");
    `
  );

  const zenProc = spawn(
    "/Applications/Zen.app/Contents/MacOS/zen",
    ["--headless", "--marionette", "--new-instance", "--profile", profileDir],
    { stdio: "ignore", env: { ...process.env, MOZ_NO_REMOTE: "1" } }
  );

  const client = new MarionetteClient(marionettePort);
  try {
    await client.connect();
    await client.send("WebDriver:NewSession", {});
    await client.send("WebDriver:SetWindowRect", { width: 1200, height: 1200 });

    async function captureView({ url, outPath, maxHeight }) {
      await client.send("WebDriver:Navigate", { url });
      await new Promise((r) => setTimeout(r, 400));

      // Measure body size and inject a clean wrapper or clip
      const rectRes = await client.send("WebDriver:ExecuteScript", {
        script: `
          document.activeElement && document.activeElement.blur();
          document.documentElement.style.margin = "0";
          document.documentElement.style.padding = "0";
          document.documentElement.style.background = "#ffffff";
          document.body.style.background = "#ffffff";
          document.body.style.position = "relative";
          document.body.style.display = "inline-block";
          if (${maxHeight || 0} > 0) {
            document.body.style.maxHeight = "${maxHeight}px";
            document.body.style.overflow = "hidden";
          }
          window.scrollTo(0, 0);
          return {
            w: Math.ceil(document.body.getBoundingClientRect().width),
            h: Math.ceil(document.body.getBoundingClientRect().height)
          };
        `,
        args: [],
      });
      console.log("Captured dimensions (CSS px):", rectRes.value, "->", outPath);

      const elRes = await client.send("WebDriver:FindElement", {
        using: "css selector",
        value: "body",
      });
      const elId = Object.values(elRes.value)[0];

      const shot = await client.send("WebDriver:TakeScreenshot", {
        id: elId,
        full: false,
        scroll: false,
      });
      fs.writeFileSync(outPath, Buffer.from(shot.value, "base64"));
    }

    await captureView({
      url: `http://127.0.0.1:${port}/popup.html?word=hello`,
      outPath: path.join(OUT_DIR, "hello.png"),
      maxHeight: 591,
    });

    await captureView({
      url: `http://127.0.0.1:${port}/popup.html?word=merhaba`,
      outPath: path.join(OUT_DIR, "merhaba.png"),
      maxHeight: 597,
    });

    const historyWords = JSON.stringify(["hello", "merhaba", "dictionary"]);
    await captureView({
      url: `http://127.0.0.1:${port}/popup.html?history=${encodeURIComponent(
        historyWords
      )}`,
      outPath: path.join(OUT_DIR, "history.png"),
      maxHeight: 0,
    });
  } finally {
    client.close();
    zenProc.kill("SIGKILL");
    server.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
})();
