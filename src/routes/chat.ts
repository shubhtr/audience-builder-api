import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { analyzeAudience } from '../lib/gemini';

const router = Router();

router.post('/message', async (req, res) => {
  const { text, conversationId, userRole } = req.body;

  // Persistence: Save user message 
  await prisma.message.create({
    data: { content: text, role: 'user', conversationId }
  });

  const analysis = await analyzeAudience(text, []);

  // Assumption: Base reach of 10M, reduced by 20% per signal [cite: 15]
  const signalCount = Object.values(analysis.signals).flat().length;
  const reachEstimate = Math.max(1000, Math.floor(10000000 * Math.pow(0.8, signalCount)));

  // Permissions: Only Admins see internal "Signal Confidence" scores [cite: 11]
  const responseData = {
    ...analysis,
    reachEstimate,
    debug: userRole === 'admin' ? { confidence: 0.95 } : undefined
  };

  const aiMsg = await prisma.message.create({
    data: { content: JSON.stringify(responseData), role: 'model', conversationId }
  });

  res.json(aiMsg);
});

export default router;
