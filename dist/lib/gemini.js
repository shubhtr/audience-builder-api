import OpenAI from 'openai';
import { getLLMClient, getLLMModel } from './llm.js';
export const analyzeAudience = async (prompt, history) => {
    const systemPrompt = `
    You are an AI Media Planner. Translate user input into signals.
    Available Taxonomy:
    - location_taxonomy: Hierarchical visit categories[cite: 14].
    - transaction_taxonomy: Purchase categories[cite: 14].
    - cg_data_dictionary: Demographics/Interests[cite: 14].

    Return JSON:
    {
      "signals": { "locations": [], "purchases": [], "demographics": {} },
      "explanation": "Why these signals match.",
      "isReadyForEstimation": boolean
    }
  `;
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((h) => ({
            role: (h.role === 'model' ? 'assistant' : h.role),
            content: h.parts?.[0]?.text ?? h.content ?? '',
        })),
        { role: 'user', content: prompt },
    ];
    const result = await getLLMClient().chat.completions.create({
        model: getLLMModel(),
        messages,
        response_format: { type: 'json_object' },
    });
    return JSON.parse(result.choices[0].message.content);
};
//# sourceMappingURL=gemini.js.map