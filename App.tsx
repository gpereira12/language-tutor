
import React, { useState, useRef, useEffect } from 'react';
import { AVAILABLE_VOICES, LANGUAGES, INITIAL_GREETINGS } from './constants';
import { ChatMessage, SavedSession, TutorVoice, SessionConfig, LanguageId } from './types';
import { gemini } from './services/geminiService';
import { 
  Mic, 
  Square, 
  Send, 
  Volume2, 
  Globe2, 
  History, 
  Plus, 
  MoreHorizontal, 
  ChevronRight, 
  Trash2, 
  CheckCircle2,
  Sparkles,
  Keyboard,
  User,
  Baby,
  GraduationCap,
  MessageCircle,
  BookOpen
} from 'lucide-react';

const STORAGE_KEY = 'language_tutor_sessions_v1';

const App: React.FC = () => {
  const [selectedLanguageId, setSelectedLanguageId] = useState<LanguageId>('en-US');
  const [selectedVoice, setSelectedVoice] = useState<TutorVoice>('Zephyr');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  // New Features Config
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    level: 'beginner',
    audience: 'adult'
  });
  const [isSetupMode, setIsSetupMode] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const activeLanguage = LANGUAGES.find(l => l.id === selectedLanguageId) || LANGUAGES[0];

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedSessions(parsed);
      } catch (e) {
        console.error("Error loading sessions", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return;
    const sessionToSave: SavedSession = {
      id: currentSessionId,
      languageId: selectedLanguageId,
      config: sessionConfig,
      messages: messages,
      userProfile: { stats: undefined },
      lastModified: Date.now()
    };
    
    const updated = [
      sessionToSave,
      ...savedSessions.filter(s => s.id !== currentSessionId)
    ].sort((a, b) => b.lastModified - a.lastModified);
    
    setSavedSessions(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [messages, currentSessionId, sessionConfig]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, showKeyboard]);

  const initNewChatSetup = () => {
    setCurrentSessionId('');
    setMessages([]);
    setIsSetupMode(true);
    setShowHistory(false);
  };

  const startNewSession = async () => {
    const sid = Date.now().toString();
    setCurrentSessionId(sid);
    setIsSetupMode(false);
    
    setIsTyping(true);
    let greetingText = INITIAL_GREETINGS[selectedLanguageId];

    // Customize greeting based on config
    if (sessionConfig.level === 'advanced') {
       greetingText = `Hello! I see you're an advanced learner. What complex topic shall we discuss today in ${activeLanguage.label}?`;
    } else if (sessionConfig.level === 'conversation') {
       greetingText = `Hey! Ready to chat? We can talk about anything like a native speaker would.`;
    } else if (sessionConfig.audience === 'child') {
       greetingText = `Hi there! 👋 I'm your new friend! Let's learn ${activeLanguage.label} together! 🎈`;
    }

    try {
      await new Promise(r => setTimeout(r, 600));
      const audioData = await gemini.generateSpeech(greetingText, selectedVoice);
      setMessages([{
        id: 'init-' + Date.now(),
        role: 'assistant',
        content: greetingText,
        audioData,
        timestamp: Date.now()
      }]);
    } catch (e) {
      setMessages([{
        id: 'init-' + Date.now(),
        role: 'assistant',
        content: greetingText,
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const loadSession = (session: SavedSession) => {
    setCurrentSessionId(session.id);
    setSelectedLanguageId(session.languageId);
    setMessages(session.messages);
    if(session.config) setSessionConfig(session.config);
    setShowHistory(false);
    setIsSetupMode(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
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
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        // Only process if not deliberately cancelled
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied.");
    }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = (reader.result as string).split(',')[1];
          processVoiceInput(base64Audio, 'audio/webm');
        };
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null; // Prevent processing
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      audioChunksRef.current = [];
    }
  };

  const processVoiceInput = async (base64: string, mime: string) => {
    setIsTyping(true);
    try {
      const result = await gemini.transcribeAndAnalyzeAudio(base64, mime, selectedLanguageId as any);
      
      const userMsg: ChatMessage = {
        id: 'user-' + Date.now(),
        role: 'user',
        content: result.text,
        pronunciationFeedback: result.pronunciationFeedback,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMsg]);
      
      await processBotResponse([...messages, userMsg], result.text);
    } catch (e) {
      console.error(e);
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    const text = inputValue.trim();
    setInputValue('');
    
    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    
    await processBotResponse([...messages, userMsg], text);
  };

  const processBotResponse = async (history: ChatMessage[], lastInput: string) => {
    try {
      const geminiRes = await gemini.getTutorResponse(
          lastInput, 
          selectedLanguageId as any, 
          sessionConfig, 
          history.map(m => ({ role: m.role, content: m.content }))
      );

      let audioData;
      try {
        audioData = await gemini.generateSpeech(geminiRes.response, selectedVoice);
      } catch (e) {}

      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: geminiRes.response,
        feedback: geminiRes.feedback,
        audioData,
        timestamp: Date.now(),
        topic: geminiRes.topicIdentified
      };
      setMessages(prev => [...prev, botMsg]);

      // Highlight logic (unchanged)
      if (audioData) {
        gemini.playAudio(audioData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#FDFBF7] overflow-hidden font-sans selection:bg-[#C5A059] selection:text-white">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#1A1C20] text-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${showHistory ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
        <div className="p-8 pb-4">
          <h1 className="font-serif text-2xl text-[#C5A059] tracking-wide mb-8 flex items-center gap-3">
             <div className="w-8 h-8 rounded-full border border-[#C5A059] flex items-center justify-center">
                <span className="text-lg">⚔️</span>
             </div>
             Language Tutor
          </h1>
          <button onClick={initNewChatSetup} className="w-full bg-[#C5A059] text-[#1A1C20] py-4 px-6 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-[#DFBD7D] transition-all transform hover:scale-105 shadow-lg shadow-[#C5A059]/20 flex items-center justify-center gap-2">
            <Plus size={16} /> New Lesson
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4 custom-scrollbar">
           {savedSessions.map(session => (
             <div 
               key={session.id} 
               onClick={() => loadSession(session)}
               className={`group p-4 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-slate-700 ${currentSessionId === session.id ? 'bg-white/10 border-white/10' : 'hover:bg-white/5'}`}
             >
                <div className="flex justify-between items-start mb-2">
                   <div className="text-[#C5A059] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      {LANGUAGES.find(l => l.id === session.languageId)?.label}
                      {/* NEW: Icons for session type */}
                      {session.config?.audience === 'child' && <Baby size={12} />}
                      {session.config?.level === 'advanced' && <GraduationCap size={12} />}
                   </div>
                   <button onClick={(e) => deleteSession(e, session.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={14} />
                   </button>
                </div>
                <div className="text-slate-400 text-sm truncate font-medium leading-relaxed">
                   {session.messages[session.messages.length - 1]?.content || "New Session"}
                </div>
                <div className="text-slate-600 text-[10px] mt-2 font-mono">
                   {new Date(session.lastModified).toLocaleDateString()}
                </div>
             </div>
           ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 relative flex flex-col h-full">
        {/* Header */}
        <header className="absolute top-0 w-full p-6 flex justify-between items-center z-40 bg-gradient-to-b from-[#FDFBF7] to-transparent pointer-events-none">
           <button onClick={() => setShowHistory(!showHistory)} className="lg:hidden p-3 bg-white rounded-full shadow-lg text-[#1A1C20] pointer-events-auto">
              <History size={20} />
           </button>
           
           <div className="flex items-center gap-4 pointer-events-auto ml-auto">
              <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
                 <Globe2 size={14} className="text-[#C5A059]" />
                 <select 
                   value={selectedLanguageId} 
                   onChange={(e) => setSelectedLanguageId(e.target.value as any)}
                   className="bg-transparent text-sm font-bold text-[#1A1C20] outline-none appearance-none cursor-pointer pr-4"
                 >
                    {LANGUAGES.map(l => (
                       <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                 </select>
              </div>
           </div>
        </header>

        {isSetupMode ? (
          /* SETUP VIEW */
          <div className="flex-1 flex flex-col items-center justify-center p-8 z-30 animate-in fade-in zoom-in-95 duration-500">
             <div className="max-w-xl w-full">
                <h2 className="text-3xl md:text-5xl font-serif text-[#1A1C20] mb-2 text-center">Customize Your Lesson</h2>
                <p className="text-center text-slate-500 mb-10">Tailor the AI persona to your needs.</p>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-8">
                   {/* Audience Selection */}
                   <div>
                      <label className="text-xs font-bold text-[#C5A059] uppercase tracking-[0.2em] mb-4 block">Target Audience</label>
                      <div className="grid grid-cols-2 gap-4">
                         <button 
                            onClick={() => setSessionConfig(prev => ({...prev, audience: 'adult'}))}
                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${sessionConfig.audience === 'adult' ? 'border-[#1A1C20] bg-[#1A1C20] text-white shadow-lg transform scale-105' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                         >
                            <User size={32} />
                            <span className="font-bold">Adult</span>
                         </button>
                         <button 
                            onClick={() => setSessionConfig(prev => ({...prev, audience: 'child'}))}
                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${sessionConfig.audience === 'child' ? 'border-[#1A1C20] bg-[#1A1C20] text-white shadow-lg transform scale-105' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                         >
                            <Baby size={32} />
                            <span className="font-bold">Child</span>
                         </button>
                      </div>
                   </div>

                   {/* Level Selection */}
                   <div>
                      <label className="text-xs font-bold text-[#C5A059] uppercase tracking-[0.2em] mb-4 block">Proficiency Level</label>
                      <div className="grid grid-cols-1 gap-3">
                         {[
                            { id: 'beginner', icon: BookOpen, label: 'Beginner', desc: 'Basics, grammar & vocabulary' },
                            { id: 'advanced', icon: GraduationCap, label: 'Advanced', desc: 'Complex topics, idioms & nuance' },
                            { id: 'conversation', icon: MessageCircle, label: 'Conversation', desc: 'Casual chat, natural flow' }
                         ].map(lvl => (
                            <button 
                               key={lvl.id}
                               onClick={() => setSessionConfig(prev => ({...prev, level: lvl.id as any}))}
                               className={`px-5 py-4 rounded-xl border transition-all flex items-center gap-4 text-left ${sessionConfig.level === lvl.id ? 'border-[#C5A059] bg-[#FDFBF7] text-[#1A1C20]' : 'border-slate-50 hover:bg-slate-50 text-slate-500'}`}
                            >
                               <lvl.icon size={20} className={sessionConfig.level === lvl.id ? 'text-[#C5A059]' : 'text-slate-300'} />
                               <div>
                                  <div className="font-bold text-sm">{lvl.label}</div>
                                  <div className="text-xs opacity-70">{lvl.desc}</div>
                               </div>
                               {sessionConfig.level === lvl.id && <CheckCircle2 size={16} className="ml-auto text-[#C5A059]" />}
                            </button>
                         ))}
                      </div>
                   </div>

                   <button 
                     onClick={startNewSession}
                     className="w-full py-5 bg-[#C5A059] text-[#1A1C20] rounded-xl font-bold uppercase tracking-widest hover:bg-[#DFBD7D] transition-all shadow-lg active:scale-95"
                   >
                      Start Logic
                   </button>
                </div>
             </div>
          </div>
        ) : !currentSessionId && messages.length === 0 ? (
          /* Empty State (Welcome) */
          <div className="flex-1 flex flex-col items-center justify-center p-8 z-0">
             <div className="w-24 h-24 bg-[#1A1C20] rounded-3xl flex items-center justify-center mb-8 shadow-2xl rotate-3 hover:rotate-6 transition-transform duration-700">
                <Sparkles size={40} className="text-[#C5A059]" />
             </div>
             <h2 className="text-4xl md:text-6xl font-serif text-[#1A1C20] mb-6 text-center">Noble Fluency</h2>
             <p className="text-slate-400 max-w-md text-center leading-relaxed font-medium">
                Master a new language with the elegance of a personalized AI tutor. Select your path to begin.
             </p>
             <button onClick={initNewChatSetup} className="mt-10 px-10 py-4 bg-white border border-slate-200 rounded-full text-[#1A1C20] font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
                Customize Lesson
             </button>
          </div>
        ) : (
          /* Chat Area */
          <>
            <div className="flex-1 overflow-y-auto px-6 md:px-20 py-10 pb-48 space-y-10 custom-scrollbar scroll-smooth">
               {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] md:max-w-2xl relative group ${msg.role === 'assistant' ? 'pl-4' : 'pr-4'}`}>
                        {/* Avatar */}
                        <div className={`absolute top-0 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-xs ${msg.role === 'user' ? '-right-10 bg-[#1A1C20] text-white' : '-left-8 bg-[#C5A059] text-white'}`}>
                           {msg.role === 'user' ? 'ME' : 'AI'}
                        </div>

                        {/* Message Bubble - Retaining Premium Style but fixing readability */}
                        <div className={`p-6 md:p-8 rounded-[2rem] shadow-sm relative ${
                           msg.role === 'user' 
                              ? 'bg-[#1A1C20] text-slate-200 rounded-tr-none' 
                              : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                        }`}>
                           <p className="text-lg md:text-xl leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                           
                           {/* User Feedback/Pronunciation */}
                           {msg.pronunciationFeedback && (
                            <div className="mt-6 bg-white/10 rounded-xl p-4 border border-white/5">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={14} className="text-[#C5A059]" />
                                <span className="text-xs font-bold text-[#C5A059] uppercase tracking-wider">Pronunciation Analysis</span>
                              </div>
                              <div className="flex items-baseline gap-2 mb-3">
                                <span className="text-3xl font-serif text-white">{msg.pronunciationFeedback.score}</span>
                                <span className="text-xs text-slate-400">/ 10</span>
                              </div>
                              {msg.pronunciationFeedback.phonemeFeedback && (
                                <div className="space-y-2">
                                  {msg.pronunciationFeedback.phonemeFeedback.map((p, i) => (
                                    <div key={i} className="text-xs bg-black/20 p-2 rounded lg:flex lg:items-center lg:justify-between">
                                       <div className="flex gap-2">
                                          <span className="text-red-400 line-through">{p.heardSound}</span>
                                          <span className="text-green-400">{p.targetSound}</span>
                                       </div>
                                       <span className="text-slate-400 italic ml-2">{p.improvementTip}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                           )}

                           {/* Bot Audio Play */}
                           {msg.audioData && (
                              <button 
                                onClick={() => gemini.playAudio(msg.audioData!)} 
                                className="mt-4 flex items-center gap-2 text-xs font-bold text-[#C5A059] hover:text-[#DFBD7D] uppercase tracking-widest transition-colors"
                              >
                                 <Volume2 size={16} /> Play Audio
                              </button>
                           )}
                        </div>
                     </div>
                  </div>
               ))}
               
               {isTyping && (
                  <div className="flex items-center gap-2 ml-4">
                     <div className="w-2 h-2 bg-[#C5A059] rounded-full animate-bounce" />
                     <div className="w-2 h-2 bg-[#C5A059] rounded-full animate-bounce [animation-delay:0.2s]" />
                     <div className="w-2 h-2 bg-[#C5A059] rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
               )}
               <div ref={chatEndRef} />
            </div>

            {/* Input / Control Area */}
            <div className="fixed bottom-0 left-0 lg:left-72 right-0 p-6 z-40 bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7] to-transparent pointer-events-none">
               <div className="max-w-4xl mx-auto flex flex-col items-center pointer-events-auto">
                  
                  {/* Recording Control */}
                  <div className={`relative transition-all duration-500 mb-6 ${showKeyboard ? 'opacity-0 pointer-events-none h-0 mb-0' : 'opacity-100 h-auto'}`}>
                     <div className="bg-white/90 backdrop-blur-xl p-4 rounded-[3rem] border border-white shadow-2xl flex items-center gap-8">
                        {/* Cancel Button (New) */}
                        {isRecording && (
                           <button 
                              onClick={cancelRecording}
                              className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all animate-in zoom-in"
                              title="Cancel Recording"
                           >
                              <Trash2 size={24} />
                           </button>
                        )}

                        <button 
                           onClick={isRecording ? stopAndSendRecording : startRecording} 
                           disabled={isTyping} 
                           className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl border-4 ${
                              isRecording 
                                 ? 'bg-[#1A1C20] border-[#C5A059] text-white scale-110' 
                                 : 'bg-white border-slate-50 text-slate-300 hover:border-[#C5A059] hover:text-[#C5A059]'
                           } ${isRecording ? 'recording-ripple' : ''}`}
                        >
                           {isRecording ? <Square size={32} fill="currentColor" /> : <Mic size={40} strokeWidth={1.5} />}
                        </button>
                        
                        <button 
                           onClick={() => setShowKeyboard(true)}
                           className="w-14 h-14 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-[#1A1C20] hover:text-white transition-all"
                        >
                           <Keyboard size={24} />
                        </button>
                     </div>
                  </div>

                  {/* Keyboard Input */}
                  <div className={`w-full transition-all duration-500 ${showKeyboard ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none absolute'}`}>
                     <form onSubmit={handleSendMessage} className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 flex items-center p-2 pl-6">
                        <button type="button" onClick={() => setShowKeyboard(false)} className="text-slate-400 hover:text-[#C5A059] pr-4">
                           <Mic size={24} />
                        </button>
                        <input 
                           value={inputValue} 
                           onChange={(e) => setInputValue(e.target.value)} 
                           placeholder="Type your response..." 
                           className="flex-1 bg-transparent py-4 outline-none text-lg text-[#1A1C20]"
                        />
                        <button 
                           type="submit" 
                           disabled={!inputValue.trim()} 
                           className="w-12 h-12 bg-[#1A1C20] text-[#C5A059] rounded-full flex items-center justify-center hover:bg-black transition-colors disabled:opacity-50"
                        >
                           <Send size={20} />
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
