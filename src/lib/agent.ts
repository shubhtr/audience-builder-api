import { getLLMClient, getLLMModel } from './llm.js';

export const getTargetingSignals = async (userInput: string) => {
  const prompt = `
    Context: Interpret audience requests into these categories:
    1. Locations (Physical visit categories) [cite: 14]
    2. Transactions (Purchase hierarchies) [cite: 14]
    3. Consumer Graph (Demographics/Interests) [cite: 14]

    User Request: "${userInput}"

    Return JSON:
    {
      "signals": { "locations": [], "purchases": [], "demographics": {} },
      "explanation": "Briefly describe why these were chosen",
      "status": "PROPOSED"
    }
  `;

  const result = await getLLMClient().chat.completions.create({
    model: getLLMModel(),
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });
  return JSON.parse(result.choices[0]!.message.content!);
};
