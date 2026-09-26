import express from "express";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.post("/chat", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    let response;
    try {
      response = await ai.models.generateContent({
        model: primaryModel,
        contents: prompt,
      });
    } catch (primaryErr) {
      console.warn(`Primary model (${primaryModel}) failed: ${primaryErr.message}. Trying fallback (gemini-3.5-flash-lite)...`);
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: prompt,
      });
    }

    res.json({ answer: response.text });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
