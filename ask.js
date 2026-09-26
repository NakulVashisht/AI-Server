import readline from "readline";

// 1. Replace this with your current trycloudflare.com URL (keep /chat at the end)
// Change this to your tunnel URL once DNS is configured:
// const TUNNEL_URL = "https://chat.my-gemini.com/chat";
const TUNNEL_URL = "https://mobility-essay-tips-resource.trycloudflare.com/chat";

const promptFromArgs = process.argv.slice(2).join(" ");

async function sendQuery(promptText) {
  try {
    const res = await fetch(TUNNEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText }),
    });

    // Handle non-200 HTTP response codes (502 Bad Gateway, 404, etc.)
    if (!res.ok) {
      console.error(`\nHTTP Error ${res.status}: ${res.statusText}`);
      const text = await res.text();
      console.error("Server response snippet:");
      console.error(text.substring(0, 200));
      return;
    }

    const data = await res.json();
    if (data.answer) {
      console.log(`\nAI: ${data.answer}\n`);
    } else {
      console.error(`\nError: ${data.error || "Unknown server response"}\n`);
    }
  } catch (err) {
    console.error(`\nConnection error: ${err.message}\n`);
  }
}

// Single-command mode vs Interactive prompt loop
if (promptFromArgs.trim().length > 0) {
  sendQuery(promptFromArgs);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question("You: ", async (input) => {
      if (input.trim().toLowerCase() === "exit") {
        rl.close();
        return;
      }
      if (input.trim()) {
        await sendQuery(input);
      }
      promptUser();
    });
  };

  console.log('--- Interactive Gemini Chat (type "exit" to quit) ---');
  promptUser();
}
