import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL, SYSTEM_INSTRUCTION } from '../constants';

const apiKey = process.env.API_KEY || '';

// Initialize client
// Note: In a production app, the key might come from user input, but strict instructions
// require usage of process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey });

export const generateContentStream = async (
  prompt: string, 
  history: { role: 'user' | 'model'; content: string }[],
  onChunk: (text: string) => void
) => {
  try {
    // Transform history to Gemini format if needed, 
    // but for simple single-turn tasks or stateless chats, we can often just use messages.
    // Here we use the Chat API to maintain context if needed.
    
    const chat = ai.chats.create({
      model: GEMINI_MODEL,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });

    // Feed history (excluding the current prompt which is sent via sendMessageStream)
    // Note: The SDK manages history in the `chat` object, but since we re-create the chat 
    // object here for simplicity of the service function, we might want to populate it.
    // However, for the "Lecture" mode, each page explanation is often treated as a fresh prompt 
    // with the page context. 
    // For "Chat", we would ideally keep the chat instance alive. 
    // To keep this service stateless and robust, we will construct the prompt to include context 
    // or rely on the strong context window of Gemini 2.5.
    
    // For this implementation, we will treat 'prompt' as the primary message.
    
    const result = await chat.sendMessageStream({ message: prompt });
    
    for await (const chunk of result) {
       // chunk is GenerateContentResponse
       const text = chunk.text; 
       if (text) {
         onChunk(text);
       }
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    onChunk(`\n\n**Error:** Failed to communicate with the AI Professor. Please check your network or API Key configuration.`);
  }
};

export const checkApiKey = (): boolean => {
  return !!apiKey;
};