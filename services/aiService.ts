
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, type SafetySetting } from "@google/genai";
import { AppSettings } from '../types';
import { SYSTEM_INSTRUCTION as SYS_PROMPT } from '../constants';

// Helper to sanitise values used in Headers to prevent "String contains non ISO-8859-1 code point" errors.
const sanitizeHeaderValue = (val: string | undefined): string => {
  if (!val) return '';
  return val.replace(/[^\x20-\x7E]/g, '').trim();
};

// 安全设置 - 使用最宽松的阈值来避免误判
const SAFETY_SETTINGS: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// 用于取消生成的控制器
let currentAbortController: AbortController | null = null;

// 停止当前生成
export const stopGeneration = () => {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
};

export const validateConnection = async (settings: AppSettings): Promise<boolean> => {
  try {
    const apiKey = sanitizeHeaderValue(settings.apiKey);
    if (!apiKey) return false;

    if (settings.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: settings.model.trim(),
        contents: 'Test connection',
        config: {
          safetySettings: SAFETY_SETTINGS,
        }
      });
      return !!response.text;
    } else {
      const baseUrl = settings.baseUrl || 'https://api.openai.com/v1';
      const cleanBaseUrl = baseUrl.replace(/\/$/, '').trim();
      
      const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: settings.model.trim(),
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 5
        })
      });
      return response.ok;
    }
  } catch (e) {
    console.error("Connection failed", e);
    return false;
  }
};

export const generateStream = async (
  settings: AppSettings,
  prompt: string,
  images: string[] = [],
  onChunk: (text: string) => void,
  options?: { skipSystemPrompt?: boolean }
): Promise<boolean> => {
  // 创建新的中断控制器
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;
  
  try {
    if (settings.provider === 'gemini') {
      await generateGeminiStream(settings, prompt, images, onChunk, signal, options?.skipSystemPrompt);
    } else {
      await generateGenericStream(settings, prompt, images, onChunk, signal, options?.skipSystemPrompt);
    }
    return true;
  } catch (error: any) {
    // Handle various abort scenarios
    if (error.name === 'AbortError' || 
        signal.aborted || 
        error.message?.includes('aborted') ||
        error.message?.includes('BodyStreamBuffer')) {
      console.log('🛑 Generation stopped by user');
      return false;
    }
    throw error;
  } finally {
    currentAbortController = null;
  }
};

const generateGeminiStream = async (
  settings: AppSettings,
  prompt: string,
  images: string[],
  onChunk: (text: string) => void,
  signal: AbortSignal,
  skipSystemPrompt?: boolean
) => {
  try {
    const apiKey = sanitizeHeaderValue(settings.apiKey);
    if (!apiKey) throw new Error("API Key is missing");

    const ai = new GoogleGenAI({ apiKey });
    
    // Construct Content Parts - 图片放在前面，让 AI 先看到图片
    const parts: any[] = [];

    // Add images FIRST for better visual analysis
    if (images.length > 0) {
      console.log(`📸 Sending ${images.length} image(s) to Gemini for analysis`);
      
      images.forEach((base64Str, index) => {
        // Remove data URI prefix if present (e.g. "data:image/jpeg;base64,")
        const base64Data = base64Str.split(',')[1] || base64Str;
        const imageSizeKB = Math.round(base64Data.length * 0.75 / 1024);
        console.log(`  📄 Image ${index + 1}: ~${imageSizeKB}KB`);
        
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        });
      });
    } else {
      console.log('⚠️ No images provided to Gemini');
    }

    // Add text prompt after images
    parts.push({ text: prompt });

    // Config - optionally skip system prompt for translation
    const config: any = {
      temperature: settings.temperature,
      safetySettings: SAFETY_SETTINGS,
    };
    
    if (!skipSystemPrompt) {
      config.systemInstruction = SYS_PROMPT;
    }

    const response = await ai.models.generateContentStream({
      model: settings.model.trim(),
      contents: { parts },
      config
    });

    for await (const chunk of response) {
      // 检查是否被中断
      if (signal.aborted) {
        throw new Error('AbortError');
      }
      const text = chunk.text;
      if (text) onChunk(text);
    }
  } catch (error: any) {
    // 如果是用户中断，不显示错误
    if (error.message === 'AbortError' || signal.aborted) {
      return;
    }
    
    console.error("Gemini Error:", error);
    
    // 处理常见的 Gemini API 错误
    let errorMessage = error.message || 'Failed to generate content.';
    
    if (errorMessage.includes('Content Exists Risk') || errorMessage.includes('SAFETY')) {
      errorMessage = '内容被安全过滤器拦截。请尝试上传不同的 PDF 文件，或调整内容后重试。';
    } else if (errorMessage.includes('API_KEY') || errorMessage.includes('invalid')) {
      errorMessage = 'API Key 无效或已过期，请检查设置。';
    } else if (errorMessage.includes('QUOTA') || errorMessage.includes('429') || errorMessage.includes('rate')) {
      errorMessage = 'API 配额已用尽或请求过于频繁，请稍后重试。';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
      errorMessage = '网络连接失败，请检查网络后重试。';
    } else if (errorMessage.includes('timeout')) {
      errorMessage = '请求超时，请稍后重试。';
    } else if (errorMessage.includes('model')) {
      errorMessage = '模型不可用或不支持，请尝试其他模型。';
    }
    
    onChunk(`\n\n**❌ 错误:** ${errorMessage}`);
  }
};

const generateGenericStream = async (
  settings: AppSettings,
  prompt: string,
  images: string[],
  onChunk: (text: string) => void,
  signal: AbortSignal,
  skipSystemPrompt?: boolean
) => {
  try {
    const apiKey = sanitizeHeaderValue(settings.apiKey);
    if (!apiKey) throw new Error("API Key is missing");

    const baseUrl = settings.baseUrl || 'https://api.openai.com/v1';
    const cleanBaseUrl = baseUrl.replace(/\/$/, '').trim();

    // ERROR FIX: DeepSeek and some other OpenAI-compatible APIs DO NOT support image_url.
    // If the provider is 'deepseek', force images to be empty.
    const isVisionSupported = settings.provider !== 'deepseek';
    const activeImages = isVisionSupported ? images : [];

    // Construct Messages
    // If we have images, we MUST use the content array format.
    // If we DO NOT have images, it is safer to use the simple string content format
    // because some strict text-only parsers (like DeepSeek) might reject the array format or the 'text' type.
    
    let userContent: any;

    if (activeImages.length > 0) {
      userContent = [{ type: 'text', text: prompt }];
      activeImages.forEach(img => {
         userContent.push({
           type: 'image_url',
           image_url: {
             url: img
           }
         });
      });
    } else {
      // Simple string format for maximum compatibility
      userContent = prompt;
    }

    // Build messages array - optionally skip system prompt for translation
    const messages: any[] = [];
    if (!skipSystemPrompt) {
      messages.push({ role: 'system', content: SYS_PROMPT });
    }
    messages.push({ role: 'user', content: userContent });

    const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: settings.model.trim(),
        messages,
        temperature: settings.temperature,
        stream: true
      }),
      signal // 传递中断信号
    });

    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const errJson = await response.json();
            errorMsg = errJson.error?.message || errorMsg;
        } catch {}
        // Instead of throwing, we output the error to the chat stream so the UI doesn't crash
        throw new Error(`API Error: ${response.status} ${errorMsg}`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      // 检查是否被中断
      if (signal.aborted) {
        reader.cancel();
        throw new Error('AbortError');
      }
      
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "data: [DONE]") return;
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content || "";
            if (content) onChunk(content);
          } catch (e) {
            // Partial JSON or error, skip
          }
        }
      }
    }
  } catch (error: any) {
    console.error("Generic API Error:", error);
    
    let errorMessage = error.message || 'Failed to connect to API.';
    
    if (errorMessage.includes('401')) {
      errorMessage = 'API Key 无效，请检查设置。';
    } else if (errorMessage.includes('429')) {
      errorMessage = 'API 请求过于频繁，请稍后重试。';
    } else if (errorMessage.includes('Content Exists Risk')) {
      errorMessage = '内容被安全过滤器拦截，请尝试其他内容。';
    }
    
    onChunk(`\n\n**❌ 错误:** ${errorMessage}`);
  }
};
