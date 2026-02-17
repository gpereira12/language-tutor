
import { TutorVoice, LanguageConfig } from './types';

export const LANGUAGES: LanguageConfig[] = [
  { id: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { id: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { id: 'fr-FR', label: 'French', flag: '🇫🇷' },
  { id: 'es-ES', label: 'Spanish', flag: '🇪🇸' },
];

export const LEARNING_MODULES = [
  { id: 'basics', title: 'The Essentials', topics: ['Greetings', 'Numbers', 'Colors'], icon: 'Sparkles' },
  { id: 'daily', title: 'Daily Life', topics: ['Food', 'Family', 'Home'], icon: 'Home' },
  { id: 'world', title: 'The World', topics: ['Animals', 'Nature', 'Weather'], icon: 'Globe' },
  { id: 'travel', title: 'Adventure', topics: ['Travel', 'Directions', 'Shopping'], icon: 'Map' },
];

export const INITIAL_GREETINGS: Record<string, string> = {
  'en-US': "Hello! I am your Language Tutor. I'm very happy to meet you. To begin our lesson, what is your name and what is your favorite animal? (Please tap the microphone below to tell me!)",
  'en-GB': "Hello! I am your Language Tutor. I am delighted to meet you. To begin our lesson, what is your name and what is your favourite animal? (Please tap the microphone below to tell me!)",
  'fr-FR': "Bonjour ! Je suis votre tuteur de langue. Je suis très heureux de vous rencontrer. Pour commencer notre leçon, quel est votre nom et quel est votre animal préféré ? (Veuillez appuyer sur le micro ci-dessous pour me le dire !)",
  'es-ES': "¡Hola! Soy tu tutor de idiomas. Estoy muy feliz de conocerte. Para empezar nuestra lección, ¿cómo te llamas y cuál es tu animal favorito? (¡Por favor, toca el micrófono para decírmelo!)"
};

export const AVAILABLE_VOICES: { id: TutorVoice; label: string; description: string; gender: 'Male' | 'Female' }[] = [
  { id: 'Charon', label: 'Elias', description: 'Deep & Calm', gender: 'Male' },
  { id: 'Zephyr', label: 'Elena', description: 'Warm & Sweet', gender: 'Female' }
];
