
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AVAILABLE_VOICES, LANGUAGES, INITIAL_GREETINGS, LEARNING_MODULES } from './constants';
import { ChatMessage, SavedSession, TutorVoice, LanguageId, UserProfile, UserStats, TopicProgress, DailyStats } from './types';
import { gemini } from './services/geminiService';
import { 
  Send, 
  RefreshCcw, 
  Volume2, 
  CheckCircle2, 
  Mic,
  Square,
  Clock,
  Trash2,
  Plus,
  ChevronDown,
  Award,
  Keyboard,
  Menu,
  X,
  History,
  Languages,
  BookOpen,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Stars,
  Trophy,
  Zap,
  Target,
  LayoutDashboard,
  MessageSquare,
  Flame,
  TrendingUp,
  AlertTriangle,
  Globe,
  Home,
  Map,
  Loader2,
  Activity,
  ChevronRight
} from 'lucide-react';

const STORAGE_KEY = 'language_tutor_gold_v11';
const DAILY_GOAL_DEFAULT = 500;

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const DEFAULT_STATS: UserStats = {
  xp: 0,
  level: 1,
  lessonsCompleted: 0,
  masteredTopics: [],
  needsPractice: [],
  streak: 1,
  topicProgress: {},
  dailyStats: {
    date: getTodayDateString(),
    xp: 0,
    goal: DAILY_GOAL_DEFAULT
  }
};

const App: React.FC = () => {
  const [view, setView] = useState<'chat' | 'dashboard'>('chat');
  const [selectedLanguageId, setSelectedLanguageId] = useState<LanguageId>('en-US');
  const [selectedVoice, setSelectedVoice] = useState<TutorVoice>('Zephyr');
  const [userProfile, setUserProfile] = useState<UserProfile>({ stats: DEFAULT_STATS });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [ttsQuotaExhausted, setTtsQuotaExhausted] = useState(false);

  const sessionStats = useMemo(() => {
    const xp = messages.reduce((acc, msg) => {
      if (msg.role === 'user' && msg.pronunciationFeedback) {
        return acc + Math.floor(msg.pronunciationFeedback.score * 2);
      }
      return acc + (msg.role === 'user' ? 10 : 0);
    }, 0);
    const topics = Array.from(new Set(messages.map(m => m.topic).filter(Boolean)));
    return { xp, topics };
  }, [messages]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const activeLanguage = LANGUAGES.find(l => l.id === selectedLanguageId) || LANGUAGES[0];
  const isSessionActive = messages.length > 0;

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: SavedSession[] = JSON.parse(saved);
        setSavedSessions(parsed);
        if (parsed.length > 0) {
          const mostRecent = [...parsed].sort((a, b) => b.lastModified - a.lastModified)[0];
          let profile = mostRecent.userProfile;
          
          const today = getTodayDateString();
          if (!profile.stats?.dailyStats || profile.stats.dailyStats.date !== today) {
            profile = {
              ...profile,
              stats: {
                ...(profile.stats || DEFAULT_STATS),
                dailyStats: {
                  date: today,
                  xp: 0,
                  goal: profile.stats?.dailyStats?.goal || DAILY_GOAL_DEFAULT
                }
              }
            };
          }
          setUserProfile(profile);
        }
      } catch (e) {
        console.error("Error loading profile", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return;

    const sessionToSave: SavedSession = {
      id: currentSessionId,
      languageId: selectedLanguageId,
      messages: messages,
      userProfile: userProfile,
      lastModified: Date.now()
    };

    const updated = [
      sessionToSave,
      ...savedSessions.filter(s => s.id !== currentSessionId)
    ].sort((a, b) => b.lastModified - a.lastModified);

    setSavedSessions(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [messages, userProfile, currentSessionId, selectedLanguageId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const startNewSession = async () => {
    if (isInitializing) return;
    setIsInitializing(true);
    
    await new Promise(r => setTimeout(r, 400));
    
    const sid = Date.now().toString();
    setCurrentSessionId(sid);
    setMessages([]);
    setView('chat');
    setTtsQuotaExhausted(false);
    setIsMobileMenuOpen(false);
    setIsTyping(true);
    
    const greetingText = INITIAL_GREETINGS[selectedLanguageId];
    try {
      const audioData = await gemini.generateSpeech(greetingText, selectedVoice);
      const initialMsg: ChatMessage = {
        id: 'init-' + Date.now(),
        role: 'assistant',
        content: greetingText,
        audioData: audioData,
        timestamp: Date.now()
      };
      setMessages([initialMsg]);
      if (audioData) gemini.playAudio(audioData);
    } catch (err: any) {
      if (err.message === "QUOTA_EXHAUSTED") setTtsQuotaExhausted(true);
      const initialMsg: ChatMessage = {
        id: 'init-' + Date.now(),
        role: 'assistant',
        content: greetingText,
        timestamp: Date.now()
      };
      setMessages([initialMsg]);
    } finally {
      setIsTyping(false);
      setIsInitializing(false);
    }
  };

  const loadSession = (session: SavedSession) => {
    setCurrentSessionId(session.id);
    setSelectedLanguageId(session.languageId);
    setMessages(session.messages);
    setUserProfile(session.userProfile);
    setView('chat');
    setIsMobileMenuOpen(false);
  };

  const updateProgress = (topic: string = 'Conversation', score?: number) => {
    setUserProfile(prev => {
      const stats = prev.stats || DEFAULT_STATS;
      const topicStats = stats.topicProgress[topic] || { topic, completedLessons: 0, averageScore: 0, lastPracticed: 0 };
      
      const xpGain = score ? Math.floor(score * 2) : 10;
      const newCompleted = topicStats.completedLessons + 1;
      const newAvg = score !== undefined 
        ? (topicStats.averageScore * topicStats.completedLessons + score) / newCompleted
        : topicStats.averageScore;

      const newTopicStats: TopicProgress = {
        ...topicStats,
        completedLessons: newCompleted,
        averageScore: newAvg,
        lastPracticed: Date.now()
      };

      const newTotalXp = stats.xp + xpGain;
      const newDailyXp = stats.dailyStats.xp + xpGain;
      const newLevel = Math.floor(newTotalXp / 250) + 1;

      return {
        ...prev,
        stats: {
          ...stats,
          xp: newTotalXp,
          level: newLevel,
          lessonsCompleted: stats.lessonsCompleted + 1,
          topicProgress: { ...stats.topicProgress, [topic]: newTopicStats },
          dailyStats: { ...stats.dailyStats, xp: newDailyXp }
        }
      };
    });
  };

  const processVoiceInput = async (base64Audio: string, mimeType: string) => {
    setIsTyping(true);
    try {
      const result = await gemini.transcribeAndAnalyzeAudio(base64Audio, mimeType, selectedLanguageId);
      const userMsg: ChatMessage = {
        id: 'user-' + Date.now(),
        role: 'user',
        content: result.text,
        pronunciationFeedback: result.pronunciationFeedback,
        timestamp: Date.now()
      };
      
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      
      const geminiRes = await gemini.getTutorResponse(
        userMsg.content, 
        selectedLanguageId, 
        userProfile, 
        newMessages.map(m => ({ role: m.role, content: m.content }))
      );
      
      updateProgress(geminiRes.topicIdentified, result.pronunciationFeedback?.score);

      let audioData: string | undefined = undefined;
      try {
        audioData = await gemini.generateSpeech(geminiRes.response, selectedVoice);
      } catch (e: any) {
        if (e.message === "QUOTA_EXHAUSTED") setTtsQuotaExhausted(true);
      }

      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: geminiRes.response,
        feedback: geminiRes.feedback,
        audioData: audioData,
        timestamp: Date.now(),
        topic: geminiRes.topicIdentified
      };
      setMessages(prev => [...prev, botMsg]);
      if (audioData) gemini.playAudio(audioData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedSessions.filter(s => s.id !== id);
    setSavedSessions(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (currentSessionId === id) {
      setMessages([]);
      setCurrentSessionId('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = (reader.result as string).split(',')[1];
          processVoiceInput(base64Audio, 'audio/webm');
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
      alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const text = inputValue.trim();
    setInputValue('');
    setShowKeyboard(false);
    setIsTyping(true);

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const geminiRes = await gemini.getTutorResponse(
        text,
        selectedLanguageId,
        userProfile,
        newMessages.map(m => ({ role: m.role, content: m.content }))
      );

      updateProgress(geminiRes.topicIdentified);

      let audioData: string | undefined = undefined;
      try {
        audioData = await gemini.generateSpeech(geminiRes.response, selectedVoice);
      } catch (e: any) {
        if (e.message === "QUOTA_EXHAUSTED") setTtsQuotaExhausted(true);
      }

      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: geminiRes.response,
        feedback: geminiRes.feedback,
        audioData: audioData,
        timestamp: Date.now(),
        topic: geminiRes.topicIdentified
      };
      setMessages(prev => [...prev, botMsg]);
      if (audioData) gemini.playAudio(audioData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const DashboardView = () => {
    const stats = userProfile.stats || DEFAULT_STATS;
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-16 space-y-12 animate-in fade-in duration-700 pb-32">
        <header className="space-y-4">
           <h2 className="text-5xl font-serif font-bold text-slate-800 tracking-tight">Your Journey</h2>
           <p className="text-slate-400 font-medium max-w-xl">Every conversation is a step closer to mastery. Review your daily goals and topic accomplishments below.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-1 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col items-center text-center group">
              <div className="relative w-40 h-40 mb-8">
                 <svg className="w-full h-full transform -rotate-90">
                    <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-50" />
                    <circle 
                        cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="12" fill="transparent" 
                        strokeDasharray={452} 
                        strokeDashoffset={452 - (452 * Math.min(stats.dailyStats.xp / stats.dailyStats.goal, 1))} 
                        className="text-[#C5A059] transition-all duration-1000 ease-out" 
                        strokeLinecap="round"
                    />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Flame size={32} className={stats.dailyStats.xp >= stats.dailyStats.goal ? "text-orange-500 animate-bounce" : "text-slate-200"} />
                    <span className="text-3xl font-bold text-slate-800">{Math.round((stats.dailyStats.xp / stats.dailyStats.goal) * 100)}%</span>
                 </div>
              </div>
              <h3 className="text-xl font-serif font-bold text-slate-800 mb-2">Daily XP Goal</h3>
              <p className="text-sm text-slate-400 font-medium mb-6">{stats.dailyStats.xp} of {stats.dailyStats.goal} XP achieved</p>
              <div className="w-full h-px bg-slate-50 mb-6" />
              <div className="flex items-center gap-2 text-[10px] font-black text-[#C5A059] uppercase tracking-widest">
                 <Trophy size={14} /> Level {stats.level} Elite
              </div>
           </div>

           <div className="lg:col-span-2 space-y-8">
              <div className="flex items-center justify-between">
                 <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Activity size={16} /> Learning Units
                 </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {LEARNING_MODULES.map(module => (
                    <div key={module.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                       <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-[#C5A059]">
                             {module.id === 'basics' && <Sparkles size={24} />}
                             {module.id === 'daily' && <Home size={24} />}
                             {module.id === 'world' && <Globe size={24} />}
                             {module.id === 'travel' && <Map size={24} />}
                          </div>
                          <div>
                             <h4 className="font-serif font-bold text-lg text-slate-800">{module.title}</h4>
                             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{module.topics.length} Lessons</span>
                          </div>
                       </div>
                       <div className="space-y-3">
                          {module.topics.map(topic => (
                             <div key={topic} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors group">
                                <span className="text-xs font-semibold text-slate-500">{topic}</span>
                                {stats.topicProgress[topic] ? (
                                   <div className="flex items-center gap-2">
                                      <div className="text-[9px] font-bold text-[#C5A059]">{Math.round(stats.topicProgress[topic].averageScore)}/10</div>
                                      <CheckCircle2 size={14} className="text-emerald-500" />
                                   </div>
                                ) : (
                                   <div className="w-1.5 h-1.5 rounded-full bg-slate-100" />
                                )}
                             </div>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    );
  };

  const SidebarContent = () => {
    const stats = userProfile.stats || DEFAULT_STATS;
    const dailyProgress = (stats.dailyStats.xp / stats.dailyStats.goal) * 100;

    return (
      <div className="flex flex-col h-full bg-white border-r border-slate-100">
        <div className="px-8 py-10 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
             <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
             <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">Production Environment</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Language <span className="text-[#C5A059]">Tutor</span>
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-10 pb-10">
          <div className="space-y-1.5">
             <button 
                onClick={() => { setView('chat'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition-all ${view === 'chat' ? 'bg-[#1A1C20] text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-50'}`}
             >
                <MessageSquare size={18} /> Chat Lesson
             </button>
             <button 
                onClick={() => { setView('dashboard'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition-all ${view === 'dashboard' ? 'bg-[#1A1C20] text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-50'}`}
             >
                <LayoutDashboard size={18} /> Global Progress
             </button>
          </div>

          <div className="h-px bg-slate-50" />

          <div className="space-y-4 px-1">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Flame size={14} className={dailyProgress >= 100 ? "text-orange-500" : "text-slate-300"} />
                   <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Daily Goal</span>
                </div>
                <span className="text-[10px] font-bold text-[#C5A059]">{stats.dailyStats.xp}/{stats.dailyStats.goal}</span>
             </div>
             <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-[1px]">
                <div 
                    className="h-full bg-gradient-to-r from-[#C5A059] to-[#DFBD7D] transition-all duration-1000 ease-out rounded-full" 
                    style={{ width: `${Math.min(dailyProgress, 100)}%` }} 
                />
             </div>
          </div>

          {savedSessions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <History size={12} className="text-[#C5A059]" />
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">History</span>
              </div>
              <div className="space-y-2">
                {savedSessions.slice(0, 4).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => loadSession(s)}
                    className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                      currentSessionId === s.id ? 'bg-slate-50 border-slate-200' : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="text-sm shrink-0">{LANGUAGES.find(l => l.id === s.languageId)?.flag}</div>
                      <span className="text-[10px] font-bold text-slate-600 truncate">
                        {new Date(s.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} Lesson
                      </span>
                    </div>
                    <Trash2 
                      size={12} 
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all" 
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id, e); }} 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-50">
          <button 
            disabled={isInitializing}
            onClick={startNewSession}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative overflow-hidden group ${
              isInitializing ? 'bg-slate-100 text-slate-400' : 'bg-[#1A1C20] text-white hover:bg-slate-800 shadow-xl'
            }`}
          >
            {isInitializing ? (
              <>
                <Loader2 size={16} className="animate-spin text-[#C5A059]" /> Initializing...
              </>
            ) : (
              <>
                <Plus size={16} className="text-[#C5A059]" /> Start New Lesson
              </>
            )}
            <div className="absolute inset-0 bg-white/5 opacity-0 group-active:opacity-100 transition-opacity" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#FDFBF7] text-[#1A1C20] overflow-hidden">
      <div className="hidden lg:block w-72 shrink-0 h-full">
        <SidebarContent />
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="mobile-overlay absolute inset-0" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 animate-in slide-in-from-left duration-300 shadow-2xl">
            <SidebarContent />
            <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-4 right-[-52px] w-10 h-10 bg-white rounded-xl text-slate-500 flex items-center justify-center shadow-lg">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 border-b border-slate-100 flex items-center px-6 md:px-12 justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg">
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{view === 'chat' ? 'Active Classroom' : 'Global Profile'}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
             {view === 'chat' && isSessionActive && (
               <div className="hidden lg:flex items-center gap-6 bg-slate-50/50 px-6 py-2 rounded-full border border-slate-100 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                     <Zap size={14} className="text-[#C5A059]" />
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Session: <span className="text-slate-800">{sessionStats.xp} XP</span></span>
                  </div>
                  {sessionStats.topics.length > 0 && (
                    <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
                       <Target size={14} className="text-blue-400" />
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{sessionStats.topics[0]}</span>
                    </div>
                  )}
               </div>
             )}

             <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <span className="text-sm">{activeLanguage.flag}</span>
                    <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest">{activeLanguage.label}</span>
                </div>
                <button 
                  onClick={() => { if (window.confirm("Purge all learning data permanently?")) { localStorage.clear(); window.location.reload(); } }}
                  className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                  title="Factory Reset"
                >
                  <RefreshCcw size={16} />
                </button>
             </div>
          </div>
        </header>

        {view === 'dashboard' ? <DashboardView /> : (
          <>
            {!isSessionActive ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-1000 z-10">
                 <div className="w-24 h-24 mb-10 bg-white border border-slate-50 rounded-[3rem] shadow-2xl flex items-center justify-center text-[#C5A059] animate-bounce-slow">
                    <Stars size={40} strokeWidth={1.5} />
                 </div>
                 <h2 className="text-4xl md:text-6xl font-serif font-bold text-slate-800 mb-6 tracking-tight">The Quest Awaits</h2>
                 <p className="max-w-md text-slate-400 text-base leading-relaxed mb-12 font-medium">
                    Your personal AI tutor is tuned and ready. Forge a new linguistic connection or resume your journey.
                 </p>
                 <button 
                    disabled={isInitializing}
                    onClick={startNewSession}
                    className={`px-12 py-6 rounded-[2.5rem] text-[15px] font-black uppercase tracking-[0.25em] shadow-2xl transition-all active:scale-95 flex items-center gap-4 relative group ${
                      isInitializing 
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none' 
                        : 'bg-[#C5A059] text-[#1A1C20] hover:bg-[#B48F4D] hover:shadow-[#C5A059]/40 border-none'
                    }`}
                 >
                    {isInitializing ? (
                       <Loader2 size={22} className="animate-spin" />
                    ) : (
                       <Plus size={22} className="stroke-[3]" />
                    )}
                    {isInitializing ? "Preparing Lesson..." : "Begin New Session"}
                    <div className="absolute inset-0 rounded-[2.5rem] bg-[#1A1C20]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                 </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-6 md:px-24 lg:px-48 py-10 space-y-16 scroll-smooth pb-72">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex w-full fade-in-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[95%] md:max-w-[85%] lg:max-w-[80%] flex flex-col gap-6 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      
                      {msg.role === 'user' && (
                        <div className="flex flex-col items-end gap-5 w-full">
                          <div className="bg-[#1A1C20] text-white px-8 md:px-12 py-6 rounded-[3rem] rounded-tr-none shadow-2xl border border-white/5 animate-in slide-in-from-right-4 duration-500">
                            <p className="text-base md:text-lg leading-relaxed font-medium font-serif italic">"{msg.content}"</p>
                          </div>
                          
                          {msg.pronunciationFeedback && (
                            <div className="w-full bg-white border border-slate-100 rounded-[3rem] shadow-2xl overflow-hidden border-t-4 border-t-[#C5A059] animate-in zoom-in-95 duration-700">
                              <div className="p-10">
                                <div className="flex items-center justify-between pb-8 border-b border-slate-50 mb-10">
                                  <div className="flex items-center gap-4">
                                     <div className="w-12 h-12 rounded-2xl bg-[#C5A059] flex items-center justify-center text-white shadow-xl">
                                        <Award size={24} />
                                     </div>
                                     <div>
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Phonetic Analysis</span>
                                        <div className="text-base font-bold text-slate-800">Visual Voice Fingerprint</div>
                                     </div>
                                  </div>
                                  <div className="text-4xl font-serif font-bold text-[#C5A059] flex items-baseline">
                                     {msg.pronunciationFeedback.score}
                                     <span className="text-sm opacity-30 ml-1">/10</span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                  {msg.pronunciationFeedback.phonemeFeedback?.slice(0, 4).map((p, idx) => (
                                    <div key={idx} className="bg-[#FDFBF7] p-6 rounded-[2rem] border border-slate-50 group transition-all hover:bg-white hover:shadow-xl">
                                       <div className="flex items-center justify-between mb-5">
                                          <span className="text-3xl font-serif font-bold text-[#1A1C20]">{p.phoneme}</span>
                                          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm scale-90">
                                             <span className="text-[11px] font-bold text-emerald-600">{p.targetSound}</span>
                                             <ChevronRight size={14} className="text-[#C5A059]" />
                                             <span className="text-[11px] font-bold text-slate-400">{p.heardSound}</span>
                                          </div>
                                       </div>
                                       <p className="text-[11px] text-slate-500 leading-relaxed font-semibold bg-white px-4 py-3 rounded-2xl border-l-4 border-[#C5A059] shadow-sm">
                                         {p.improvementTip}
                                       </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {msg.role === 'assistant' && (
                        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-left-4 duration-700">
                          {msg.topic && (
                             <div className="flex items-center gap-3 px-2">
                                <span className="text-[9px] font-black text-[#C5A059] uppercase tracking-[0.3em] bg-white px-4 py-1.5 rounded-full border border-slate-100 shadow-sm">{msg.topic}</span>
                             </div>
                          )}
                          {msg.feedback && (
                            <div className="bg-white/50 backdrop-blur-md px-7 py-5 rounded-[1.5rem] text-sm text-slate-500 font-semibold border border-slate-100 flex items-start gap-4 shadow-sm italic leading-relaxed">
                              <CheckCircle2 size={18} className="text-[#C5A059] shrink-0 mt-0.5" />
                              <p>{msg.feedback}</p>
                            </div>
                          )}
                          <div className="bg-white border border-slate-50 p-10 md:p-16 rounded-[3.5rem] shadow-2xl hover:border-[#C5A059]/20 transition-all duration-1000 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-2.5 h-full bg-[#C5A059] opacity-5" />
                            <p className="text-2xl md:text-4xl text-slate-800 leading-[1.5] font-serif font-normal">{msg.content}</p>
                            
                            {msg.audioData && (
                              <button 
                                onClick={() => gemini.playAudio(msg.audioData!)} 
                                className="mt-12 flex items-center gap-5 text-[11px] font-black text-[#C5A059] uppercase tracking-[0.4em] hover:text-[#1A1C20] transition-all bg-[#FDFBF7] px-8 py-4 rounded-full border border-slate-50 shadow-sm group/btn"
                              >
                                 <Volume2 size={20} className="group-hover/btn:scale-110 transition-transform" /> Play Audio
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-center gap-4 opacity-20 px-12">
                    <div className="w-2.5 h-2.5 bg-[#C5A059] rounded-full animate-bounce" />
                    <div className="w-2.5 h-2.5 bg-[#C5A059] rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2.5 h-2.5 bg-[#C5A059] rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            <div className={`fixed bottom-0 left-0 lg:left-72 right-0 p-8 md:p-14 bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7]/95 to-transparent z-40 pointer-events-none ${!isSessionActive ? 'hidden' : ''}`}>
              <div className="max-w-4xl mx-auto flex flex-col items-center gap-10 pointer-events-auto">
                <div className={`flex items-center gap-12 md:gap-16 bg-white/70 backdrop-blur-3xl p-7 rounded-[4rem] border border-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] transition-all animate-in slide-in-from-bottom-8 duration-700`}>
                  <div className="relative">
                    <button 
                      onClick={isRecording ? stopRecording : startRecording} 
                      disabled={isTyping} 
                      className={`relative w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl border-4 z-10 ${
                        isRecording 
                          ? 'bg-[#1A1C20] border-[#C5A059] text-white scale-110' 
                          : 'bg-white border-slate-50 text-slate-200 hover:border-[#C5A059] hover:text-[#C5A059] disabled:opacity-20'
                      } ${isRecording ? 'recording-ripple' : ''}`}
                    >
                      {isRecording ? <Square size={32} fill="currentColor" /> : <Mic size={40} strokeWidth={1.5} />}
                    </button>
                    
                    {isRecording && (
                      <div className="absolute -top-28 left-1/2 -translate-x-1/2 flex items-end gap-2 h-20 w-48 justify-center">
                        {[...Array(12)].map((_, i) => (
                           <div 
                              key={i} 
                              className="w-1.5 bg-[#C5A059] rounded-full animate-[pulse_0.4s_infinite]" 
                              style={{ 
                                height: `${30 + Math.random() * 70}%`, 
                                animationDelay: `${i * 0.05}s` 
                              }} 
                           />
                        ))}
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setShowKeyboard(!showKeyboard)} 
                    className={`p-7 rounded-[2rem] transition-all border-2 ${
                      showKeyboard ? 'bg-[#1A1C20] text-white border-slate-800 shadow-2xl' : 'bg-white text-slate-200 border-slate-50 hover:border-slate-200 shadow-sm'
                    }`}
                  >
                    <Keyboard size={32} />
                  </button>
                </div>

                <div className={`w-full overflow-hidden transition-all duration-1000 ${showKeyboard ? 'max-h-32 opacity-100 translate-y-0' : 'max-h-0 opacity-0 translate-y-8 pointer-events-none'}`}>
                  <form onSubmit={handleSendMessage} className="flex items-center gap-6 p-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] max-w-4xl mx-auto">
                    <input 
                      type="text" 
                      value={inputValue} 
                      onChange={(e) => setInputValue(e.target.value)} 
                      placeholder="Type your noble response..." 
                      className="flex-1 bg-transparent px-10 py-4 outline-none text-xl font-medium placeholder:text-slate-200 font-serif" 
                      disabled={isTyping || isRecording} 
                    />
                    <button 
                      type="submit" 
                      disabled={!inputValue.trim() || isTyping} 
                      className="w-16 h-16 rounded-3xl bg-[#1A1C20] text-[#C5A059] flex items-center justify-center transition-all hover:bg-slate-800 disabled:opacity-10 active:scale-90 shadow-xl"
                    >
                      <Send size={24} strokeWidth={3} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
