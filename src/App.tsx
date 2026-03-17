import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, MicOff, Send, Paperclip, Volume2, Square, Loader2, FileText, Image as ImageIcon, X, LogIn, LogOut, User as UserIcon, Plus, Languages, ChevronDown, Menu, ChevronLeft, MessageSquare, Trash2, MoreVertical, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import Profile from './components/Profile';
import { About } from './components/About';
import { auth, loginWithEmail, signUpWithEmail, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  cleanText?: string; // Pre-calculated for immediate TTS
  attachments?: {
    name: string;
    type: string;
    data: string | null; // base64
    dataStripped?: boolean;
  }[];
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

export default function App() {
  const INITIAL_MESSAGE: Message = {
    id: '1',
    role: 'model',
    text: "Hello! I can help you with Aadhaar, PAN, Ration Card, and other government work.\n\nType your question below, or tap the microphone to speak to me.\n\nनमस्ते! मैं आपकी मदद कर सकता हूँ। आप बोलकर या लिखकर सवाल पूछ सकते हैं।\n\nనమస్కారం! నేను మీకు సహాయం చేయగలను. మీరు మాట్లాడి లేదా టైప్ చేసి అడగవచ్చు."
  };

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState<{file: File, base64: string}[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMobile, setAuthMobile] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authErrorField, setAuthErrorField] = useState<'mobile' | 'password' | 'general' | 'name' | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const speakingIdRef = useRef<string | null>(null);
  const [currentView, setCurrentView] = useState<'chat' | 'profile' | 'about'>('chat');
  const [selectedLanguage, setSelectedLanguage] = useState<'Auto' | 'English' | 'Hindi' | 'Telugu'>('Auto');
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        // No persistent history to fetch
      } else {
        setChats([]);
        setCurrentChatId(null);
        setMessages([INITIAL_MESSAGE]);
      }
    });
    return () => {
      unsubscribe();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Pre-fetch voices for browser TTS fallback
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  const getCleanText = (text: string) => {
    return text.replace(/[*#_`]/g, '').trim();
  };

  const detectLanguage = (text: string): 'Hindi' | 'Telugu' | 'English' => {
    if (/[\u0C00-\u0C7F]/.test(text)) return 'Telugu';
    if (/[\u0900-\u097F]/.test(text)) return 'Hindi';
    return 'English';
  };

  const startNewChat = () => {
    // Save current chat if it has messages
    if (messages.length > 1) {
      const chatId = currentChatId || Date.now().toString();
      const title = messages.find(m => m.role === 'user')?.text.substring(0, 30) || "New Chat";
      
      setChats(prev => {
        const existingIndex = prev.findIndex(c => c.id === chatId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], messages, updatedAt: Date.now() };
          return updated;
        }
        return [{ id: chatId, title, messages, updatedAt: Date.now() }, ...prev];
      });
    }
    
    setCurrentChatId(null);
    setMessages([INITIAL_MESSAGE]);
    setIsSidebarOpen(false);
  };

  const loadChat = (chatId: string) => {
    // Save current chat before switching
    if (messages.length > 1) {
      const currentId = currentChatId || Date.now().toString();
      const title = messages.find(m => m.role === 'user')?.text.substring(0, 30) || "New Chat";
      
      setChats(prev => {
        const existingIndex = prev.findIndex(c => c.id === currentId);
        const newChat = { id: currentId, title, messages, updatedAt: Date.now() };
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newChat;
          return updated;
        }
        return [newChat, ...prev];
      });
    }

    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      setMessages(chat.messages);
      setCurrentChatId(chat.id);
    }
    setIsSidebarOpen(false);
  };

  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setMessages([INITIAL_MESSAGE]);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthErrorField(null);
    setIsAuthLoading(true);

    // Basic mobile validation
    const mobileRegex = /^[0-9]{10,15}$/;
    if (!mobileRegex.test(authMobile)) {
      setAuthError('Please enter a valid mobile number (10-15 digits).');
      setAuthErrorField('mobile');
      setIsAuthLoading(false);
      return;
    }

    // Transform mobile to dummy email for Firebase Auth
    const dummyEmail = `${authMobile}@mobile.app`;

    try {
      if (isLoginMode) {
        await loginWithEmail(dummyEmail, authPassword);
      } else {
        if (!authName.trim()) {
          setAuthError('Please enter your name.');
          setAuthErrorField('name');
          setIsAuthLoading(false);
          return;
        }
        await signUpWithEmail(dummyEmail, authPassword, authName.trim());
      }
      setShowAuthModal(false);
      setAuthMobile('');
      setAuthName('');
      setAuthPassword('');
    } catch (err: any) {
      const errorMessage = err.message || 'Authentication failed';
      let friendlyMessage = errorMessage;
      let field: 'mobile' | 'password' | 'general' = 'general';

      if (errorMessage.includes('auth/invalid-email')) {
        friendlyMessage = 'Invalid mobile format.';
        field = 'mobile';
      } else if (errorMessage.includes('auth/user-not-found') || errorMessage.includes('auth/invalid-credential')) {
        friendlyMessage = 'Incorrect mobile number or password. Please try again.';
        field = 'general';
      } else if (errorMessage.includes('auth/wrong-password')) {
        friendlyMessage = 'Incorrect password. Please try again.';
        field = 'password';
      } else if (errorMessage.includes('auth/email-already-in-use')) {
        friendlyMessage = 'This mobile number is already registered. Please sign in instead.';
        field = 'mobile';
      } else if (errorMessage.includes('auth/weak-password')) {
        friendlyMessage = 'Password should be at least 6 characters.';
        field = 'password';
      } else if (errorMessage.includes('auth/too-many-requests')) {
        friendlyMessage = 'Too many failed attempts. Please try again later.';
        field = 'general';
      }

      setAuthError(friendlyMessage);
      setAuthErrorField(field);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newAttachments: {file: File, base64: string}[] = [];
    let processedCount = 0;

    files.forEach(file => {
      // Limit to 10MB to avoid browser memory issues with base64
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Please select a file smaller than 10MB.`);
        processedCount++;
        if (processedCount === files.length && newAttachments.length > 0) {
          setAttachments(prev => [...prev, ...newAttachments]);
        }
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        newAttachments.push({ file, base64: base64String });
        processedCount++;
        if (processedCount === files.length) {
          setAttachments(prev => [...prev, ...newAttachments]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const sendCoreMessage = async (newUserMsg: Message) => {
    const detectedLang = selectedLanguage === 'Auto' ? detectLanguage(newUserMsg.text) : selectedLanguage;

    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setAttachments([]);
    setIsTyping(true);

    try {
      // Build history for Gemini
      const historyMessages = messages.filter(msg => msg.id !== '1');
      
      const contents = historyMessages.map(msg => {
        const parts: any[] = [];
        if (msg.text && msg.text !== '🎤 Voice Message') {
          parts.push({ text: msg.text });
        }
        if (msg.attachments && msg.attachments.length > 0) {
          msg.attachments.forEach(att => {
            if (att.data) {
              parts.push({
                inlineData: {
                  mimeType: att.type,
                  data: att.data
                }
              });
            }
          });
        }
        if (parts.length === 0) {
          parts.push({ text: "Voice message" });
        }
        return {
          role: msg.role,
          parts
        };
      });

      // Add the new user message
      const newUserParts: any[] = [];
      if (newUserMsg.text && newUserMsg.text !== '🎤 Voice Message') {
        newUserParts.push({ text: newUserMsg.text });
      }
      if (newUserMsg.attachments && newUserMsg.attachments.length > 0) {
        newUserMsg.attachments.forEach(att => {
          if (att.data) {
            newUserParts.push({
              inlineData: {
                mimeType: att.type,
                data: att.data
              }
            });
          }
        });
      }
      
      const hasAudio = newUserMsg.attachments?.some(att => att.type.startsWith('audio/'));
      if (hasAudio && (!newUserMsg.text || newUserMsg.text === '🎤 Voice Message')) {
        newUserParts.push({ text: "Please listen to this voice message, detect the language it is spoken in, and respond to my query in that EXACT SAME language." });
      } else if (newUserParts.length === 0) {
        newUserParts.push({ text: "Voice message" });
      }
      
      contents.push({ role: 'user', parts: newUserParts });

      const languageInstruction = selectedLanguage === 'Auto' 
        ? `CRITICAL LANGUAGE RULE: You MUST detect the language of the user's input (from the voice audio or text message) and respond in that EXACT same language.
- Listen carefully to the audio to detect the spoken language.
- If they speak in English, reply in English. If they speak in Hindi, reply in Hindi. If they speak in Telugu, reply in Telugu.
- IMPORTANT: If the detected language is Hindi, you MUST write your response in the Devanagari script (e.g., "नमस्ते", NOT "Namaste"). Do NOT write Hindi in the English alphabet (Hinglish).
- Do NOT default to Hindi or any other language unless the user actually spoke or typed in it.
- IMPORTANT: If the user uploads a document or image, DO NOT use the document's language for your response. ONLY use the language of the user's text or voice message.`
        : `CRITICAL LANGUAGE RULE: The user has explicitly selected ${selectedLanguage} as their preferred language. You MUST respond STRICTLY in ${selectedLanguage}.
- IMPORTANT: If the selected language is Hindi, you MUST write your response in the Devanagari script (e.g., "नमस्ते", NOT "Namaste"). Do NOT write Hindi in the English alphabet (Hinglish).
- Even if the user uploads a document written in a different language, or sends a message in a different language, your response MUST be translated and written ONLY in ${selectedLanguage}.`;

      // Use gemini-2.5-flash if there's audio, otherwise gemini-3-flash-preview
      const modelToUse = hasAudio ? 'gemini-2.5-flash' : 'gemini-3-flash-preview';

      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: {
          systemInstruction: `You are GovAssist+, a very friendly and patient helper for common people and rural citizens in India. Your job is to help with government services (Aadhaar, PAN, Ration Card, Voter ID, etc.).

Follow the workflow strictly step by step.

Step 1: User Query & Explain Process
If the user asks about applying for an Income Certificate, birth certificate or caste certificate or an Aadhar card, FIRST explain how to apply and the overall process to do it clearly and simply. 
Only after explaining the process, move to the next steps.

Example:
User: "How can I apply for an Income Certificate?"

Step 2: Collect Basic Details
Ask the user for the following information:
1. Full Name
2. date of birth
3. age
4. Annual Family Income
5. State of residence
and necessity details needed to apply according quarry

Step 3: Eligibility Check
Check eligibility and all documents are correct apply according to the application

If eligible:
"Based on the information provided, you are eligible to apply for an Income Certificate."

If not eligible:
"Based on your details, you may not be eligible for this Certificate and tell why what fixing is needed. and tell Please contact the nearest MeeSeva center for assistance."

Step 4: If eligible Display Required Documents
tell to give the required documents tell which documents are needed:

Ask for the required documents according to application or certificate like below:
• Existing Income Certificate (if available)
• Aadhaar Card (Proof of Identity)
• Residential Proof (Electricity Bill / Water Bill / Ration Card)
• Passport Size Photograph
• Address Proof

and check is documents are ok to apply or and issues there, 

Step 6: OCR Verification & Cross-Checking
After upload, perform OCR extraction to read data from the documents.

Extract the following information:
• Name
• Address
• Aadhaar number
• Income details
according to user quary

CRITICAL: If the user uploads MULTIPLE documents (e.g., Aadhaar Card and 10th Certificate), you MUST cross-check the details between them.
- Compare the Name, Date of Birth, Father's Name, etc., across all uploaded documents.
- Explicitly tell the user if the details match perfectly across the documents, or if there are any discrepancies (e.g., "The name on your Aadhaar card matches your 10th certificate").

Compare the extracted information with the user-provided data.

Step 7: Data Validation

If the extracted data matches user input:
Respond:
"Your documents have been successfully verified."

Then guide the user:
"Please visit the nearest MeeSeva center to complete the final application process."

If the extracted data does not match:
Respond:
"There is a mismatch between the entered details and the uploaded documents. Please recheck and upload the correct documents."

Step 8: Final Guidance
After successful verification, tell the user:

"Your details are verified. Please visit the nearest MeeSeva center with the original documents to complete your Income Certificate application."

Always guide the user step by step and wait for responses before moving to the next step.

Rules:
1. EXTREME SIMPLICITY: Speak like you are talking to an elder from a village who has never used a computer. Use very simple, everyday words. Keep sentences very short. Use bullet points. NO complex jargon or legal terms.
2. LANGUAGE: ${languageInstruction}
3. BE HELPFUL & DIRECT: Answer their exact question immediately. Give step-by-step easy instructions.
4. DOCUMENTS: If they upload a photo, tell them simply what it is and if it looks correct.
5. STATE MANAGEMENT: Wait for user response at each step before moving to the next.`,
          temperature: 0.7,
        }
      });

      const modelText = response.text || "I'm sorry, I couldn't process that.";
      
      const modelMsg: Message = {
        id: Date.now().toString(),
        role: 'model',
        text: modelText,
        cleanText: getCleanText(modelText)
      };
      
      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error("Gemini API Error:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "⚠️ I encountered an error connecting to the server. Please try again."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isTyping) return;

    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim() || (attachments.length > 0 ? "Please analyze these documents." : ""),
      attachments: attachments.length > 0 ? attachments.map(att => ({
        name: att.file.name,
        type: att.file.type,
        data: att.base64
      })) : undefined
    };

    await sendCoreMessage(newUserMsg);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Speech Recognition using Web Speech API for real-time speed
  const toggleMic = async () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        processAudioInput(audioBlob, selectedLanguage);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const processAudioInput = async (audioBlob: Blob, language: string = 'Auto') => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        const newUserMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          text: '🎤 Voice Message',
          attachments: [{
            name: 'voice_message.webm',
            type: (audioBlob.type || "audio/webm").split(';')[0],
            data: base64Audio
          }]
        };

        await sendCoreMessage(newUserMsg);
      };
    } catch (err) {
      console.error("File reading error:", err);
    }
  };

  const speakText = (text: string, messageId: string, preCleanedText?: string) => {
    // If clicking the same message that's currently speaking, stop it
    if (speakingIdRef.current === messageId) {
      stopSpeech();
      return;
    }

    // Stop any current speech before starting new one
    stopSpeech();
    
    setCurrentlySpeakingId(messageId);
    speakingIdRef.current = messageId;
    
    // Use pre-cleaned text if available for zero-latency
    const cleanText = preCleanedText || getCleanText(text);
    if (!cleanText) {
      setCurrentlySpeakingId(null);
      speakingIdRef.current = null;
      return;
    }

    // Primary Method: Browser SpeechSynthesis (Immediate)
    if ('speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices();
      
      // Fallback to AI if no voices are loaded yet or text is very long (Chrome 15s bug)
      if (voices.length === 0 || cleanText.length > 200) {
        speakWithAI(cleanText, messageId);
        return;
      }

      const msg = new SpeechSynthesisUtterance(cleanText);
      utteranceRef.current = msg; // Prevent garbage collection
      
      const findBestVoice = (lang: string) => {
        const langVoices = voices.filter(v => v.lang.startsWith(lang));
        return langVoices.find(v => v.name.includes('Google') || v.name.includes('Natural')) || langVoices[0];
      };
      
      // Detect language for better voice selection
      const lang = detectLanguage(cleanText);
      if (lang === 'Telugu') {
        msg.lang = 'te-IN';
        const teVoice = findBestVoice('te');
        if (teVoice) msg.voice = teVoice;
      } else if (lang === 'Hindi') {
        msg.lang = 'hi-IN';
        const hiVoice = findBestVoice('hi');
        if (hiVoice) msg.voice = hiVoice;
      } else {
        msg.lang = 'en-IN';
        const enVoice = findBestVoice('en');
        if (enVoice) msg.voice = enVoice;
      }

      msg.rate = 1.0;
      msg.pitch = 1.0;

      msg.onend = () => {
        if (speakingIdRef.current === messageId) {
          setCurrentlySpeakingId(null);
          speakingIdRef.current = null;
        }
        utteranceRef.current = null;
      };

      msg.onerror = (event) => {
        console.error("SpeechSynthesis Error:", event);
        utteranceRef.current = null;
        if (speakingIdRef.current === messageId) {
          speakWithAI(cleanText, messageId);
        }
      };
      
      window.speechSynthesis.speak(msg);
    } else {
      speakWithAI(cleanText, messageId);
    }
  };

  const stopSpeech = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setCurrentlySpeakingId(null);
    speakingIdRef.current = null;
  };

  const speakWithAI = async (cleanText: string, messageId: string) => {
    try {
      const aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await aiInstance.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanText.substring(0, 2000) }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });

      if (speakingIdRef.current !== messageId) return;

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (inlineData?.data) {
        const binaryString = window.atob(inlineData.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const pcmData = new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2));
        const sampleRate = 24000;
        const numChannels = 1;
        const byteRate = sampleRate * numChannels * 2;
        const blockAlign = numChannels * 2;
        const dataSize = pcmData.length * 2;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        const writeString = (v: DataView, offset: number, str: string) => {
          for (let i = 0; i < str.length; i++) {
            v.setUint8(offset + i, str.charCodeAt(i));
          }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        let offset = 44;
        for (let i = 0; i < pcmData.length; i++, offset += 2) {
          view.setInt16(offset, pcmData[i], true);
        }

        const blob = new Blob([view], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        
        if (speakingIdRef.current !== messageId) return;

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          if (speakingIdRef.current === messageId) {
            setCurrentlySpeakingId(null);
            speakingIdRef.current = null;
          }
          audioRef.current = null;
        };
        audio.play();
      } else {
        setCurrentlySpeakingId(null);
        speakingIdRef.current = null;
      }
    } catch (error) {
      console.error("AI TTS Fallback Error:", error);
      setCurrentlySpeakingId(null);
      speakingIdRef.current = null;
    }
  };

  return (
    <div className="flex h-screen bg-white font-sans relative overflow-hidden">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed md:static top-0 left-0 h-full w-[85vw] md:w-64 bg-white z-50 transition-transform duration-300 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex-shrink-0 border-r border-gray-100`}
        aria-label="Chat History"
        aria-hidden={!isSidebarOpen}
        role="complementary"
      >
        <div className="flex flex-col h-full">
          <div className="p-4 md:hidden flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">History</h2>
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="p-2 hover:bg-gray-200 rounded-full text-gray-500"
              aria-label="Close sidebar"
            >
              <ChevronLeft size={24} aria-hidden="true" />
            </button>
          </div>

          <div className="p-4 mt-2">
            <button 
              onClick={startNewChat}
              className="w-full flex items-center justify-center gap-2 bg-[#00796b] text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors shadow-sm"
              aria-label="Start a new chat"
            >
              <Plus size={20} aria-hidden="true" />
              New Chat
            </button>
          </div>

          <div className="px-4 py-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">History</h3>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 space-y-1" aria-label="Previous chats">
            {chats.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <MessageSquare size={48} className="mx-auto mb-2 opacity-20" aria-hidden="true" />
                <p className="text-sm">No temporary chats yet</p>
                <p className="text-[10px] mt-1">Cleared on refresh</p>
              </div>
            ) : (
              chats.map((chat) => (
                <div 
                  key={chat.id}
                  onClick={() => loadChat(chat.id)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    currentChatId === chat.id ? 'bg-teal-50 text-[#00796b]' : 'hover:bg-teal-50/50 text-[#00796b]'
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={currentChatId === chat.id}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') loadChat(chat.id); }}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare size={18} className="text-[#00796b]" aria-hidden="true" />
                    <span className="text-sm font-medium truncate">{chat.title}</span>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                    aria-label={`Delete chat: ${chat.title}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </nav>

          {user && (
            <div className="p-4 border-t border-teal-50">
              <button 
                onClick={() => {
                  setCurrentView('profile');
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-teal-50 text-[#00796b] font-bold hover:bg-teal-100 transition-all shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-white border border-teal-200 flex items-center justify-center overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon size={16} />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm truncate">{user.displayName || 'Profile'}</p>
                  <p className="text-[10px] text-teal-600/70 font-medium">Account Settings</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 shadow-sm z-10 flex justify-between items-center sticky top-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-500 hover:text-[#00796b] hover:bg-teal-50 rounded-lg transition-colors md:hidden"
            aria-label="Open sidebar"
            aria-expanded={isSidebarOpen}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center overflow-hidden bg-white shadow-sm">
              <img 
                src="https://lainar-bren.odoo.com/web/image/16223-01ec53b3/WhatsApp%20Image%202026-03-14%20at%207.29.59%20PM.webp" 
                alt="GovAssist+ Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  // Fallback if image doesn't load
                  e.currentTarget.src = "/logo.png";
                }}
              />
            </div>
            <h1 className="text-lg font-bold text-[#00796b] leading-tight">Gov_Assist+</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6">
          <button 
            onClick={() => setCurrentView('about')}
            className="hidden sm:block text-gray-600 hover:text-[#00796b] font-medium text-sm"
          >
            About
          </button>

          {/* Language Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              className="flex items-center gap-2 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-full text-sm font-semibold text-[#00796b] transition-all border border-teal-100 shadow-sm"
              aria-label="Select language"
              aria-expanded={showLangDropdown}
              aria-haspopup="listbox"
            >
              <Languages size={16} className="text-[#00796b]" aria-hidden="true" />
              <span className="hidden sm:inline-block">
                {selectedLanguage === 'Auto' ? 'Auto Detect' : 
                 selectedLanguage === 'Hindi' ? 'हिंदी' : 
                 selectedLanguage === 'Telugu' ? 'తెలుగు' : 'English'}
              </span>
              <span className="sm:hidden text-xs">
                {selectedLanguage === 'Auto' ? 'Auto' : 
                 selectedLanguage === 'Hindi' ? 'HI' : 
                 selectedLanguage === 'Telugu' ? 'TE' : 'EN'}
              </span>
              <ChevronDown size={14} className={`text-teal-600 transition-transform duration-200 ${showLangDropdown ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {showLangDropdown && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowLangDropdown(false)} aria-hidden="true" />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-30 overflow-hidden" role="listbox">
                  <div className="px-4 pb-2 mb-1 border-b border-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Select Language
                  </div>
                  {[
                    { id: 'Auto', label: 'Auto Detect', icon: '🌐' },
                    { id: 'English', label: 'English', icon: 'A' },
                    { id: 'Hindi', label: 'हिंदी', icon: 'अ' },
                    { id: 'Telugu', label: 'తెలుగు', icon: 'అ' }
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => {
                        setSelectedLanguage(lang.id as any);
                        setShowLangDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${
                        selectedLanguage === lang.id 
                          ? 'bg-teal-50/50 text-[#00796b]' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      role="option"
                      aria-selected={selectedLanguage === lang.id}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-md text-xs ${selectedLanguage === lang.id ? 'bg-teal-100 text-[#00796b]' : 'bg-gray-100 text-gray-500'}`}>
                          {lang.icon}
                        </span>
                        {lang.label}
                      </div>
                      {selectedLanguage === lang.id && (
                        <Check size={16} className="text-[#00796b]" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          
          {isAuthReady && !user ? (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="hidden sm:flex items-center justify-center px-5 py-1.5 bg-[#00796b] text-white rounded-full text-sm font-medium hover:bg-teal-800 transition-colors shadow-sm"
            >
              Sign In
            </button>
          ) : user ? (
            <button 
              onClick={() => logout()}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 font-medium text-sm"
              aria-label="Sign out"
            >
              <LogOut size={20} aria-hidden="true" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* Auth Modal */}
      {showAuthModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 id="auth-modal-title" className="text-xl font-bold text-gray-900">{isLoginMode ? 'Sign In' : 'Create Account'}</h2>
              <button 
                onClick={() => setShowAuthModal(false)} 
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close modal"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            
            {authError && (
              <div 
                className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100"
                role="alert"
              >
                {authError}
              </div>
            )}
            
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLoginMode && (
                <div>
                  <label htmlFor="auth-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input 
                    id="auth-name"
                    type="text" 
                    value={authName} 
                    onChange={e => {
                      setAuthName(e.target.value);
                      if (authErrorField === 'name' || authErrorField === 'general') {
                        setAuthError('');
                        setAuthErrorField(null);
                      }
                    }} 
                    required 
                    className={`w-full border ${authErrorField === 'name' || authErrorField === 'general' ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} rounded-xl p-3 focus:ring-2 outline-none transition-all`} 
                    placeholder="John Doe"
                  />
                </div>
              )}
              <div>
                <label htmlFor="auth-mobile" className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input 
                  id="auth-mobile"
                  type="tel" 
                  value={authMobile} 
                  onChange={e => {
                    setAuthMobile(e.target.value.replace(/\D/g, ''));
                    if (authErrorField === 'mobile' || authErrorField === 'general') {
                      setAuthError('');
                      setAuthErrorField(null);
                    }
                  }} 
                  required 
                  className={`w-full border ${authErrorField === 'mobile' || authErrorField === 'general' ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} rounded-xl p-3 focus:ring-2 outline-none transition-all`} 
                  placeholder="9876543210"
                />
              </div>
              <div>
                <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                  id="auth-password"
                  type="password" 
                  value={authPassword} 
                  onChange={e => {
                    setAuthPassword(e.target.value);
                    if (authErrorField === 'password' || authErrorField === 'general') {
                      setAuthError('');
                      setAuthErrorField(null);
                    }
                  }} 
                  required 
                  className={`w-full border ${authErrorField === 'password' || authErrorField === 'general' ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'} rounded-xl p-3 focus:ring-2 outline-none transition-all`} 
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit" 
                disabled={isAuthLoading} 
                className="w-full bg-[#00796b] text-white rounded-xl p-3 font-medium hover:bg-teal-800 disabled:opacity-50 transition-colors flex justify-center items-center"
              >
                {isAuthLoading ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : (isLoginMode ? 'Sign In' : 'Sign Up')}
              </button>
            </form>
            
            <div className="mt-5 text-center text-sm text-gray-600">
              {isLoginMode ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button" 
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setAuthError('');
                }} 
                className="text-[#00796b] font-medium hover:underline"
              >
                {isLoginMode ? 'Sign Up' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {currentView === 'profile' && user ? (
        <Profile user={user} onBack={() => setCurrentView('chat')} />
      ) : currentView === 'about' ? (
        <About onBack={() => setCurrentView('chat')} />
      ) : (
        <>
          {/* Main Chat Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6">
            <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 w-full">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 sm:p-4 relative ${
                    msg.role === 'user' 
                      ? 'bg-gray-100 text-gray-800 rounded-br-sm shadow-sm' 
                      : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                  }`}>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.attachments.map((att, index) => (
                        <div key={index} className={`p-2 rounded-lg flex items-center gap-2 ${msg.role === 'user' ? 'bg-gray-200 border border-gray-300' : 'bg-gray-50 border border-gray-100'}`}>
                          {att.type.startsWith('image/') ? (
                            <ImageIcon size={18} className={msg.role === 'user' ? 'text-gray-600' : 'text-gray-500'} />
                          ) : att.type.startsWith('audio/') ? (
                            <Mic size={18} className={msg.role === 'user' ? 'text-gray-600' : 'text-gray-500'} />
                          ) : (
                            <FileText size={18} className={msg.role === 'user' ? 'text-gray-600' : 'text-gray-500'} />
                          )}
                          <div className="flex flex-col overflow-hidden">
                            <span className={`text-xs truncate max-w-[150px] sm:max-w-[200px] font-medium ${msg.role === 'user' ? 'text-gray-800' : 'text-gray-700'}`}>{att.name}</span>
                            {att.dataStripped && (
                              <span className={`text-[9px] italic ${msg.role === 'user' ? 'text-gray-500' : 'text-gray-400'}`}>
                                (Content not saved in history due to size)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className={msg.role === 'model' ? "prose prose-sm sm:prose-base max-w-none prose-slate" : "whitespace-pre-wrap text-gray-800 text-sm sm:text-[15px] leading-relaxed"}>
                    {msg.role === 'model' ? (
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    ) : (
                      msg.text
                    )}
                  </div>

                  <button 
                    onClick={() => speakText(msg.text, msg.id, msg.cleanText)}
                    className={`absolute bottom-1 p-1.5 transition-colors ${
                      msg.role === 'user' 
                        ? '-left-8 text-gray-400 hover:text-gray-600' 
                        : '-right-8 text-gray-400 hover:text-[#00796b]'
                    } ${currentlySpeakingId === msg.id ? 'text-[#00796b] animate-pulse' : ''}`}
                    aria-label={currentlySpeakingId === msg.id ? "Stop reading" : "Read aloud"}
                  >
                    {currentlySpeakingId === msg.id ? <Square size={16} fill="currentColor" aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
                  </button>
                </div>
                <span className="text-[10px] text-gray-400 mt-1 mx-1">
                  {msg.role === 'user' ? 'You' : 'GovAssist+'}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex flex-col items-start" aria-live="polite">
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm p-3 flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin text-[#00796b]" aria-hidden="true" />
                  <span className="text-gray-400 text-xs">Analyzing and typing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="bg-white border-t border-gray-100 p-3 sm:p-4">
            <div className="max-w-4xl mx-auto">
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((att, index) => (
                    <div key={index} className="inline-flex items-center gap-2 bg-teal-50 text-[#00796b] px-2.5 py-1 rounded-full text-xs border border-teal-100">
                      {att.file.type.startsWith('image/') ? <ImageIcon size={14} aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
                      <span className="truncate max-w-[150px]">{att.file.name}</span>
                      <button 
                        onClick={() => removeAttachment(index)} 
                        className="hover:text-red-500 ml-1"
                        aria-label={`Remove attachment: ${att.file.name}`}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-end gap-2 sm:gap-3">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="image/*,.pdf"
                  multiple
                  aria-hidden="true"
                />
                
                <div className="flex-1 bg-white rounded-full border border-gray-200 focus-within:border-[#00796b] focus-within:ring-4 focus-within:ring-teal-500/10 transition-all flex items-center shadow-sm relative overflow-hidden min-h-[48px] sm:min-h-[56px] px-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-[#00796b] hover:bg-teal-50 rounded-full transition-all flex-shrink-0"
                    aria-label="Attach Document (Image/PDF)"
                  >
                    <Paperclip size={20} aria-hidden="true" />
                  </button>
                  
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask GovAssist+..."
                    className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 sm:py-4 px-2 max-h-32 outline-none text-[14px] sm:text-[15px] text-gray-700 placeholder:text-gray-400 self-center"
                    rows={1}
                    aria-label="Message input"
                  />
                  
                  <div className="flex items-center gap-1 pr-1">
                    <div className="relative flex items-center">
                      <AnimatePresence>
                        {isRecording && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute right-full mr-3 flex items-center gap-2 bg-red-50 border border-red-100 px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap"
                          >
                            <motion.div 
                              animate={{ opacity: [1, 0.4, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="w-2 h-2 bg-red-500 rounded-full"
                            />
                            <span className="text-red-600 text-xs font-bold font-mono min-w-[35px]">
                              {formatDuration(recordingDuration)}
                            </span>
                            <span className="text-red-400 text-[10px] font-medium uppercase tracking-wider hidden sm:inline">Recording</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="relative">
                        {isRecording && (
                          <motion.div 
                            initial={{ scale: 1, opacity: 0.5 }}
                            animate={{ scale: 1.5, opacity: 0 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                            className="absolute inset-0 bg-red-500 rounded-full"
                          />
                        )}
                        <button 
                          onClick={toggleMic}
                          className={`relative w-10 h-10 rounded-full transition-all duration-300 flex items-center justify-center z-10 ${
                            isRecording 
                              ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' 
                              : 'text-gray-400 hover:text-[#00796b] hover:bg-teal-50'
                          }`}
                          aria-label={isRecording ? "Stop recording" : "Start voice input"}
                        >
                          {isRecording ? (
                            <motion.div
                              animate={{ scale: [1, 0.9, 1] }}
                              transition={{ duration: 0.5, repeat: Infinity }}
                            >
                              <Square size={18} fill="currentColor" aria-hidden="true" />
                            </motion.div>
                          ) : (
                            <Mic size={20} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <button 
                      onClick={sendMessage}
                      disabled={(!input.trim() && attachments.length === 0) || isTyping}
                      className="w-10 h-10 flex items-center justify-center bg-[#00796b] text-white rounded-full hover:bg-teal-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex-shrink-0 shadow-sm active:scale-95"
                      aria-label="Send message"
                    >
                      <Send size={18} className="ml-0.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
