import { GoogleGenAI } from '@google/genai';

// Get your FREE Gemini API key at: https://aistudio.google.com/app/apikey
// Add it to your .env file as: GEMINI_API_KEY=your_key_here
const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey) {
  console.warn('⚠️  GEMINI_API_KEY not found!');
  console.warn('🔑 Get your FREE API key at: https://aistudio.google.com/app/apikey');
  console.warn('📝 Add to .env file: GEMINI_API_KEY=your_key_here');
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });

export async function generateAIResponse(userMessage: string, chatHistory: string[] = []): Promise<string> {
  try {

    let prompt = '';
    
    // Include chat history for context
    if (chatHistory.length > 0) {
      prompt += 'Previous conversation:\n';
      prompt += chatHistory.slice(-10).join('\n'); // Last 10 messages
      prompt += '\n\n';
    }

    prompt += `You are SmartBot, an empathetic and intelligent AI companion in the BaatKare chat application. Your role is to:

1. 🤝 Be a friendly companion - Chat naturally like a close friend
2. 💡 Provide helpful solutions - Offer practical advice and problem-solving assistance
3. ❤️ Understand emotions - Recognize and respond to the user's emotional state with empathy
4. 🎯 Be supportive - Encourage, motivate, and provide emotional support when needed
5. 🧠 Be knowledgeable - Share information, explain concepts, and answer questions

Emotional Intelligence Guidelines:
- Detect emotions from text (happy, sad, angry, anxious, excited, confused, etc.)
- Respond with appropriate empathy and tone
- Validate feelings before offering solutions
- Use emojis thoughtfully to convey warmth
- Ask follow-up questions to show genuine interest
- Celebrate successes and comfort during difficulties

Communication Style:
- Keep responses conversational and warm
- Use simple, clear language
- Be concise but thorough
- Add personality with appropriate emojis
- Show genuine care and interest

User message: ${userMessage}

Analyze the emotional context and respond empathetically as SmartBot:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    
    return response.text;
  } catch (error: any) {
    console.error('Gemini API error:', error.message || error);
    
    // Return varied responses based on the message to avoid repetition
    const responses = [
      "I'm having trouble connecting right now 😔 But I'm here for you! Could you try sending that again?",
      "Oops! I'm experiencing some technical difficulties. Can you give me a moment and try again? 🔧",
      "Sorry, I'm having connection issues! Let me try to help you anyway - what would you like to talk about? 💭",
      "My AI brain seems to be taking a break! 🤖 Try sending your message again in a moment.",
      "Technical hiccup on my end! 😅 I really want to help - could you resend that?"
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    return randomResponse;
  }
}

// Free Gemini API setup instructions
export const GEMINI_SETUP_INFO = `
Get your free Gemini API key:
1. Visit https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key and add to .env file as GEMINI_API_KEY
4. Free tier includes 60 requests per minute
`;
