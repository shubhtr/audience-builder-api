import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getLLMClient, getLLMModel } from './lib/llm.js';
import { searchTaxonomy } from './lib/taxonomy.js';
import { authorize } from './middleware/auth.js';

const app = express();
const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const allowedOrigin = process.env.CORS_ORIGIN || 'https://audience-builder-frontend.vercel.app';
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === allowedOrigin) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

app.get('/', async(req, res) => {
  res.status(200).send("Server is running.");
});

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { email, passwordHash, role: role === 'ADMIN' ? 'ADMIN' : 'PLANNER' },
    });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch {
    res.status(400).json({ error: 'Email already registered' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

// ── Chat ──────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI Media Planner helping build audience targeting signal sets for ad campaigns.

Your workflow:
1. When a user first describes an audience → PROPOSE a set of targeting signals
2. When a user asks to change signals (add, remove, modify) → REFINE the previous signals
3. When a user approves (says "yes", "looks good", "approve", "confirm", "that's right", etc.) → CONFIRM the signals

Use ONLY taxonomy entries provided in the conversation. Do not invent signal names.

Always respond with valid JSON only, no prose outside the JSON:
{
  "action": "PROPOSE" | "REFINE" | "CONFIRM",
  "explanation": "one or two sentences explaining the signals or the change made",
  "signals": {
    "locations": ["exact location taxonomy entries"],
    "purchases": ["exact transaction taxonomy entries"],
    "demographics": { "fieldName": "fieldValue" }
  }
}`;

app.post('/api/chat', authorize(['ADMIN', 'PLANNER']), async (req, res) => {
  const { message, conversationId } = req.body;
  const user = (req as any).user as { id: string; email: string; role: 'ADMIN' | 'PLANNER' };

  await prisma.conversation.upsert({
    where: { id: conversationId },
    update: {},
    create: { id: conversationId, userId: user.id },
  });

  // Load prior messages to build multi-turn context
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  // Persist the new user message
  await prisma.message.create({
    data: { role: 'user', content: { text: message }, conversationId },
  });

  // Search taxonomy on the current user message
  const taxonomyContext = searchTaxonomy(message);

  // Build multi-turn messages for the LLM
  type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string };
  const llmMessages: LLMMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];

  for (const m of history) {
    const c = m.content as any;
    if (m.role === 'user') {
      llmMessages.push({ role: 'user', content: c.text ?? '' });
    } else {
      // Feed the AI's previous structured response back so it can refine
      llmMessages.push({
        role: 'assistant',
        content: JSON.stringify({ action: c.action, explanation: c.explanation, signals: c.signals }),
      });
    }
  }

  // Current user turn — include taxonomy context so the LLM has real entries to pick from
  const currentContent = taxonomyContext
    ? `${message}\n\nRelevant taxonomy entries you may use:\n${taxonomyContext}`
    : message;
  llmMessages.push({ role: 'user', content: currentContent });

  let result;
  try {
    result = await getLLMClient().chat.completions.create({
      model: getLLMModel(),
      messages: llmMessages,
      max_tokens: 1024,
    });
  } catch (err: any) {
    console.error('LLM error:', JSON.stringify(err?.error ?? err, null, 2));
    res.status(err?.status ?? 502).json({ error: err?.message ?? 'AI provider error' });
    return;
  }

  const rawContent = result.choices[0]!.message.content!
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const aiData = JSON.parse(rawContent) as {
    action: 'PROPOSE' | 'REFINE' | 'CONFIRM';
    explanation: string;
    signals: { locations: string[]; purchases: string[]; demographics: Record<string, string> };
  };

  // On confirmation: persist signals and calculate reach
  let reachEstimate: number | null = null;
  if (aiData.action === 'CONFIRM') {
    const signalCount = [
      ...aiData.signals.locations,
      ...aiData.signals.purchases,
      ...Object.keys(aiData.signals.demographics),
    ].length;
    reachEstimate = Math.max(10000, 5000000 - signalCount * 300000);
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { confirmedSignals: aiData.signals },
    });
  }

  const responseContent = {
    ...aiData,
    ...(reachEstimate !== null ? { reachEstimate } : {}),
    ...(user.role === 'ADMIN' ? { debug: { model: getLLMModel() } } : {}),
  };

  const savedMsg = await prisma.message.create({
    data: { role: 'model', content: responseContent, conversationId },
  });

  res.json(savedMsg);
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(3001, () => console.log('Backend running on port 3001'));
}

export default app;
