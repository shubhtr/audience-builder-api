import OpenAI from "openai";
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});
const llm_model = process.env.LLM_MODEL || 'google/gemini-2.0-flash';
export const generateAudienceSignals = async (userInput) => {
    const prompt = `
    Task: Translate natural language into ad targeting signals.
    Available Taxonomies:
    1. location_taxonomy (physical visit hierarchies)
    2. transaction_taxonomy (4-level purchase hierarchy)
    3. cg_data_dictionary (demographics & interests)

    User Request: "${userInput}"

    Return JSON:
    {
      "explanation": "string",
      "signals": {
        "demographics": { "age_range": [], "gender": [], "education": [] },
        "interests": [],
        "locations": [],
        "purchases": []
      }
    }
  `;
    const result = await openai.chat.completions.create({
        model: llm_model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
    });
    return JSON.parse(result.choices[0].message.content);
};
//# sourceMappingURL=audience.service.js.map