import { GoogleGenAI, Type, Modality } from "@google/genai";
import { GeminiResponse, TranscriptionResult, TutorVoice, LanguageId, UserProfile, SessionConfig } from "../types";

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async getTutorResponse(prompt: string, languageId: LanguageId, config: SessionConfig, history: { role: string; content: string }[]): Promise<GeminiResponse> {
    
    let basePersona = `You are "Language Tutor".`;
    let audienceInstruction = "";
    let levelInstruction = "";

    // Audience Logic
    if (config.audience === 'child') {
      audienceInstruction = `Target Audience: Child (Age 6-12). Tone: Warm, playful, encouraging, very patient. Use emojis. avoid complex words.`;
    } else {
      audienceInstruction = `Target Audience: Adult. Tone: Professional, efficient, clear, polite.`;
    }

    // Level Logic
    switch (config.level) {
      case 'beginner':
        levelInstruction = `Proficiency: Beginner. Focus on basic vocabulary, simple sentence structures. Correct grammar strictly but gently. Explain concepts in PT-BR if the user is struggling with ${languageId}.`;
        break;
      case 'advanced':
        levelInstruction = `Proficiency: Advanced. Engage in complex topics. Introduce idioms and nuance. Only correct subtle errors. Speak entirely in ${languageId}.`;
        break;
      case 'conversation':
        levelInstruction = `Mode: Conversation Practice. prioritized natural flow over strict correction. Chat like a native friend. Only correct major errors that impede understanding.`;
        break;
    }

    const systemInstruction = `
      ${basePersona}
      ${audienceInstruction}
      ${levelInstruction}
      Goal: Identify the 'topicIdentified' (e.g., "Greetings", "Animals", "Work", "Travel").
      Respond ONLY in valid JSON.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
          { role: 'user', parts: [{ text: prompt }] }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              feedback: { type: Type.STRING },
              response: { type: Type.STRING },
              topicIdentified: { type: Type.STRING },
              profileUpdate: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  detectedLevel: { type: Type.STRING }
                }
              }
            },
            required: ["feedback", "response"]
          }
        },
      });

      const text = response.text;
      return JSON.parse(text || '{"feedback": "", "response": "...", "topicIdentified": "Conversation"}') as GeminiResponse;
    } catch (error) {
      console.error("Gemini Error:", error);
      return { feedback: "Technical issue.", response: "I'm having trouble connecting. Can you say that again?", topicIdentified: "Error" };
    }
  }

  async transcribeAndAnalyzeAudio(base64Audio: string, mimeType: string, languageId: LanguageId): Promise<TranscriptionResult> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType, data: base64Audio } },
            { text: `Transcribe audio into ${languageId} and analyze child's pronunciation concisely. Respond in JSON.` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              pronunciationFeedback: {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.NUMBER },
                  phonemeFeedback: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        phoneme: { type: Type.STRING },
                        targetSound: { type: Type.STRING },
                        heardSound: { type: Type.STRING },
                        improvementTip: { type: Type.STRING }
                      }
                    }
                  },
                  recommendedExercise: { type: Type.STRING }
                },
                required: ["score", "recommendedExercise"]
              }
            },
            required: ["text", "pronunciationFeedback"]
          }
        }
      });

      return JSON.parse(response.text) as TranscriptionResult;
    } catch (error) {
      console.error("Transcription Error:", error);
      throw error;
    }
  }

  async generateSpeech(text: string, voiceName: TutorVoice = 'Zephyr'): Promise<string | undefined> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error: any) {
      if (error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
        throw new Error("QUOTA_EXHAUSTED");
      }
      return undefined;
    }
  }

  async playAudio(base64Pcm: string) {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const bytes = decode(base64Pcm);
      const audioBuffer = await decodeAudioData(bytes, audioContext, 24000, 1);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (e) {
      console.error("Playback Error:", e);
    }
  }
}

export const gemini = new GeminiService();
