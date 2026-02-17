
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { GeminiResponse, TranscriptionResult, TutorVoice, LanguageId, UserProfile } from "../types";

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

  async getTutorResponse(prompt: string, languageId: LanguageId, profile: UserProfile, history: { role: string; content: string }[]): Promise<GeminiResponse> {
    const systemInstruction = `
      You are "Language Tutor", a child-focused premium tutor.
      Tone: Warm, extremely concise, elegant.
      Adaptive: Explain grammar in PT-BR if user is beginner, else stay in ${languageId}.
      Goal: Identify the 'topicIdentified' (e.g., "Greetings", "Animals", "Family", "Food").
      Respond ONLY in JSON.
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

      return JSON.parse(response.text || '{"feedback": "", "response": "...", "topicIdentified": "Conversation"}') as GeminiResponse;
    } catch (error) {
      console.error("Gemini Error:", error);
      return { feedback: "Technical issue.", response: "Can you repeat?", topicIdentified: "Unknown" };
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
