import { spawn } from "child_process";

const SYNC_ENDPOINT = "https://ntfy.sh/ghosty001_ai_tunnel_sync";

console.log("Starting Cloudflare Tunnel...");

const tunnel = spawn("cloudflared", ["tunnel", "--protocol", "http2", "--url", "http://127.0.0.1:3000"], {
  windowsHide: true,
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});

let urlSynced = false;

function handleOutput(data) {
  const text = data.toString();
  process.stdout.write(text);

  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !urlSynced) {
    const cfUrl = match[0];
    urlSynced = true;

    fetch(SYNC_ENDPOINT, {
      method: "POST",
      body: cfUrl,
    })
      .then(() => {
        console.log(`\n======================================================`);
        console.log(`🚀 Cloudflare Tunnel LIVE: ${cfUrl}`);
        console.log(`📡 Auto-synced to your remote client!`);
        console.log(`======================================================\n`);
      })
      .catch((err) => {
        console.error("Failed to sync tunnel URL:", err.message);
      });
  }
}

tunnel.stdout.on("data", handleOutput);
tunnel.stderr.on("data", handleOutput);

tunnel.on("close", (code) => {
  console.log(`Cloudflare tunnel exited with code ${code}`);
  process.exit(code || 0);
});
