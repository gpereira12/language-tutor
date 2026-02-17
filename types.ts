
export type TutorVoice = 'Charon' | 'Zephyr';

export type LanguageId = 'en-US' | 'en-GB' | 'fr-FR' | 'es-ES';

export interface LanguageConfig {
  id: LanguageId;
  label: string;
  flag: string;
}

export interface TopicProgress {
  topic: string;
  completedLessons: number;
  averageScore: number;
  lastPracticed: number;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  xp: number;
  goal: number;
}

export interface UserStats {
  xp: number;
  level: number;
  lessonsCompleted: number;
  masteredTopics: string[];
  needsPractice: string[];
  streak: number;
  topicProgress: Record<string, TopicProgress>;
  dailyStats: DailyStats;
}

export interface UserProfile {
  name?: string;
  age?: string;
  occupation?: string;
  detectedLevel?: string;
  interests?: string;
  stats?: UserStats;
}

export interface PhonemeAnalysis {
  phoneme: string;
  targetSound: string;
  heardSound: string;
  improvementTip: string;
}

export interface PronunciationFeedback {
  score: number;
  accuracy: number;
  intonation: number;
  stress: number;
  details: string;
  recommendedExercise: string;
  phonemeFeedback?: PhonemeAnalysis[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  feedback?: string;
  pronunciationFeedback?: PronunciationFeedback;
  audioData?: string;
  timestamp: number;
  topic?: string;
}

export interface GeminiResponse {
  feedback: string;
  response: string;
  profileUpdate?: UserProfile;
  topicIdentified?: string;
}

export interface SavedSession {
  id: string;
  languageId: LanguageId;
  messages: ChatMessage[];
  userProfile: UserProfile;
  lastModified: number;
}

export interface TranscriptionResult {
  text: string;
  pronunciationFeedback?: PronunciationFeedback;
}
