# AI-Server

A Node.js server powered by Google Cloud Platform (GCP) APIs for AI integrations.

## Overview
This project provides a backend server infrastructure for handling AI requests. It includes features for tunneling and syncing, and it exposes endpoints for asking questions and interacting with AI models.

## Features
* Node.js powered backend (`server.js`)
* Google Cloud Platform integration for AI processing
* Secure environment variable management
* Development tunneling via `tunnel-sync.js`

## Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.
- A GCP Service Account with valid API keys.

## Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/NakulVashisht/AI-Server.git
   cd AI-Server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root of the project and add your GCP API Key:
   ```env
   # Example .env structure
   GCP_API_KEY=your_api_key_here
   ```

## Usage
To start the server, run:
```bash
npm start
# or
node server.js
```

## Security Note
This project uses `.env` for managing sensitive credentials. Ensure your `.env` file is never committed to version control. It is already ignored via `.gitignore`.
