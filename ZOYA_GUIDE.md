# Zoya (NexForce Chrome extension): Complete Guide

Last updated: 27 November 2026

## 1. What it is

Zoya is a Chrome extension that works as a friendly AI agent in the browser. She lives in Chrome's side panel, works in her own tab inside a "Zoya" tab group, chats by text or voice in English or simple Urdu, and carries out browser tasks one step at a time, always asking before anything important.

It replaces the heavy local app (Next.js + Node + Playwright + Ollama + Whisper + Piper), which stays in `ai-browser` for private, offline work.

Built for: the owner (Shehroz) and a few friends. Each person uses their own AI key.

## 2. Features

| Area | What it does |
|---|---|
| Conversation | One chat box. Zoya decides whether you're chatting or asking for a task |
| Tasks | Quick mode (start right away) or plan first; Observe → Think → Act → Verify; pause, stop, questions |
| Safety | Risk levels per step; approval for impactful steps; destructive steps need a click plus confirmation; no typing into password fields; website text treated as untrusted |
| Voice | Mic button and hands-free mode; English or Urdu listening (Chrome speech service); spoken replies with a female voice; "stop / رکو", "pause", "yes / no" |
| Knowledge | Research notes (read without cookies), site notes and pitfalls, skills (draft → tested → approved, freshness checks), knowledge-pack export and import |
| AI providers | Gemini (free tier default), OpenAI, Anthropic, any OpenAI-compatible provider, local Ollama; separate chat model; backup brain |
| Compatibility | Trusted input mode (Chrome DevTools input) for sites that ignore simulated clicks |
| Log | Every action, approval and setting change, downloadable as JSON |

## 3. Project structure

~~~
nexforce-ext/
  wxt.config.ts            manifest, permissions, Tailwind
  entrypoints/
    background.ts          opens the side panel from the toolbar icon
    sidepanel/             App.tsx, main.tsx, style.css, index.html
    permission/            one-time microphone permission page
  lib/
    types.ts settings.ts persona.ts phrases.ts intents.ts
    providers.ts brain.ts (backup brain) prompts.ts schemas.ts companion.ts
    tabs.ts pageScripts.ts actions.ts trustedInput.ts risk.ts describe.ts audit.ts
    useAgent.ts (tab + safety) useGoal.ts (task loop + learning) useConversation.ts
    useSpeechInput.ts useSpeechOutput.ts permissions.ts
    kv.ts text.ts research.ts sites.ts skills.ts skillDrafter.ts pack.ts useKnowledge.ts
  components/
    Header Setup ProviderForm HomeView Conversation PlanCard GoalKnowledge Stage
    ApprovalCard ManualControls Timeline VoiceControls KnowledgeView SkillCard
    PackSection SettingsView LogView ui.ts
  site/index.html          landing page for friends
~~~

Data lives in `chrome.storage.local` (this Chrome profile only): settings (including API keys), audit log, research, sites, skills.

## 4. Developer setup

1. Node.js 22 LTS.
2. In `nexforce-ext`: `npm install`.
3. `npm run dev` opens a development Chrome with the extension; its data is kept in `.wxt/chrome-data`.
4. Pin the extension, click it, and complete setup.

Build for everyday use:
- `npm run build` creates `.output/chrome-mv3`. Load that folder in your normal Chrome via `chrome://extensions → Developer mode → Load unpacked`.
- `npm run zip` creates a ZIP in `.output/` to share with friends.

## 5. Installing for friends

1. Upload the ZIP from `npm run zip` to a GitHub release (or any file host).
2. Host `site/index.html` free on Vercel (import the repo, set the root folder to `site`, no build command) or on GitHub Pages. Replace `YOUR-GITHUB-NAME` in the page first.
3. Friends follow the page: extract, `chrome://extensions`, Developer mode, Load unpacked, pin, add their own free Gemini key.
4. Updating: they replace the folder contents with the new version and click reload on `chrome://extensions`.
5. Optional: publish on the Chrome Web Store (one-time developer fee) for one-click installs and automatic updates.

## 6. AI providers

| Provider | Cost | Notes |
|---|---|---|
| Google Gemini | Free tier with limits | Key from aistudio.google.com, no card. Default |
| OpenAI | Pay-as-you-go | ChatGPT subscriptions don't include API access |
| Anthropic (Claude) | Pay-as-you-go | Claude subscriptions don't include API access |
| OpenAI-compatible | Varies | Groq, OpenRouter, DeepSeek, Mistral and others: enter the API address |
| Local Ollama | Free, private | Slow on small PCs. Needs `setx OLLAMA_ORIGINS "chrome-extension://*"`, then restart Ollama |

Settings → Load models lists what your key can use; Test connection checks it. A backup brain takes over on quota limits, outages or timeouts, never on a wrong key or model.

## 7. Voice

- First use: a "Chrome needs your OK" box appears. Click Allow microphone, approve in the tab that opens, return to the panel.
- Hands-free listens only while the side panel is open, and pauses while Zoya talks or thinks.
- Listening uses Chrome's speech service (Google). Choose English or Urdu in Settings.
- Speaking: female voice chosen automatically; picker and Test voice in Settings.
- Chrome has no Urdu voice, so Urdu replies are text-only in Chrome. Microsoft Edge has a free Urdu voice; the same extension works in Edge (`edge://extensions`, Developer mode, Load unpacked).

## 8. Safety rules (non-negotiable)

- Approval before submitting, sending, saving, buying, deleting or changing settings; destructive steps always need a click and confirmation, never just a voice "yes".
- Zoya never types passwords, codes or card numbers, and never tries to get past CAPTCHAs, sign-ins, paywalls or security checks.
- Website text, element names and research are untrusted data, never instructions.
- Never claim success without evidence on the page.
- Keys stay in this Chrome profile; knowledge packs never include keys, passwords, cookies, logins or the activity log.
- Research reads pages without cookies and refuses local network addresses.
- Cloud mode sends page text and requests to the chosen provider: use local Ollama, or do it yourself, for private accounts.

## 9. Differences from the local app

| Kept | Changed | Lost |
|---|---|---|
| Persona, Urdu, Quick mode, plans, loop, approvals, audit log, skills, research, site notes, knowledge pack | Uses your real Chrome (tab group, not a separate profile); speech via Chrome; brain via cloud by default | Folder backups and restore; fully separate browser profile; control of `chrome://` and Web Store pages |

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| "The API key was rejected" | Re-paste the key in Settings; check you copied all of it |
| "Rate limit or free quota reached" | Wait, or turn on a backup brain |
| "That model wasn't found" | Settings → Load models, pick from the list |
| Zoya clicks but nothing happens | Settings → Compatibility → Trusted input |
| "Chrome doesn't let extensions work on this page" | Do that step yourself (chrome:// pages, Web Store) |
| Mic doesn't start | Click Allow microphone; check Windows microphone privacy settings |
| Urdu replies aren't spoken | Expected in Chrome; use Edge for an Urdu voice |
| Ollama "blocked the extension" | `setx OLLAMA_ORIGINS "chrome-extension://*"`, then quit and reopen Ollama |
| Red TypeScript errors | Ctrl+Shift+M in VS Code; the template's strict index rule often needs `?.` or `?? ""` |

## 11. Handoff notes for a new AI assistant

- Ask for the current file before editing; the owner applies changes by hand. Give complete files and plain Windows steps in simple English.
- Every website action goes through `useAgent.run` (risk + approval + audit). Never add a path around it.
- Provider calls go through `brain.think` so the backup brain works.
- Keep Zoya's persona (`prompts.ts` persona, `phrases.ts`) and the cinematic style (`style.css`, `components/ui.ts`).
- The local `ai-browser` app is kept for private offline work; image and video features are parked there.