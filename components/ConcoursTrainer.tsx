import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Concours, TranscriptEntry } from '../types';
import { X, Mic, MicOff, Bot, User, AlertTriangle, Book, FileText, BrainCircuit, ChevronLeft, HelpCircle } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { generateMockConcours } from '../services/geminiService';
import { CREATOR_CREDIT } from '../config';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism/index.js';

// --- Audio Helper Functions ---
function encode(bytes: Uint8Array): string {let binary = ''; const len = bytes.byteLength; for (let i = 0; i < len; i++) {binary += String.fromCharCode(bytes[i]);} return btoa(binary);}
function decode(base64: string): Uint8Array {const binaryString = atob(base64); const len = binaryString.length; const bytes = new Uint8Array(len); for (let i = 0; i < len; i++) {bytes[i] = binaryString.charCodeAt(i);} return bytes;}
// FIX: Corrected typo from Int116Array to Int16Array
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {const dataInt16 = new Int16Array(data.buffer); const frameCount = dataInt16.length / numChannels; const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate); for (let channel = 0; channel < numChannels; channel++) {const channelData = buffer.getChannelData(channel); for (let i = 0; i < frameCount; i++) {channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;}} return buffer;}
function createBlob(data: Float32Array): Blob {const l = data.length; const int16 = new Int16Array(l); for (let i = 0; i < l; i++) {int16[i] = data[i] * 32768;} return {data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000',};}

// --- Rich Markdown Renderer ---
const RichMarkdown: React.FC<{ text: string }> = ({ text }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
                code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                        <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                        >
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    ) : (
                        <code className={`${className} bg-gray-900 text-yellow-300 px-1 py-0.5 rounded text-sm`} {...props}>
                            {children}
                        </code>
                    );
                },
            }}
        >
            {text}
        </ReactMarkdown>
    );
};

// --- Component ---
interface ConcoursTrainerProps {
  concours: Concours;
  cvText: string;
  previousExamsText: string;
  onClose: () => void;
}

const ConcoursTrainer: React.FC<ConcoursTrainerProps> = ({ concours, cvText, previousExamsText, onClose }) => {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [whiteboardContent, setWhiteboardContent] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [trainerMode, setTrainerMode] = useState<'selection' | 'tutor' | 'exam'>('selection');
  const [mockExamContent, setMockExamContent] = useState<string | null>(null);
  const [isGeneratingExam, setIsGeneratingExam] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const isAssistantActive = status === 'active' && trainerMode === 'exam';

  useEffect(() => {transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });}, [transcript]);

  const stopTraining = useCallback(async (shouldResetMode = true) => {
    if (sessionPromiseRef.current) {
      try { const session = await sessionPromiseRef.current; session.close(); } catch (e) { console.error("Error closing session:", e); }
    }
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    scriptProcessorRef.current?.disconnect();
    mediaStreamSourceRef.current?.disconnect();
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    sessionPromiseRef.current = mediaStreamRef.current = inputAudioContextRef.current = outputAudioContextRef.current = scriptProcessorRef.current = mediaStreamSourceRef.current = null;
    setStatus('idle');
    if (shouldResetMode) {
      setTrainerMode('selection');
    }
  }, []);

  const startSession = useCallback(async (sessionType: 'tutor' | 'assistant') => {
    setStatus('connecting');
    setTranscript([]);
    setErrorMessage('');
    if(sessionType === 'tutor') {
        setWhiteboardContent([]);
        setTrainerMode('tutor');
    }

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('Microphone access denied:', err);
      setErrorMessage('Microphone access denied. Please allow microphone access in your browser settings and try again.');
      setStatus('error');
      setTrainerMode('selection');
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    let nextStartTime = 0;

    let systemInstruction = '';
    if (sessionType === 'tutor') {
        systemInstruction = `Start the conversation by stating: "${CREATOR_CREDIT}". Then, act as an expert academic tutor preparing a student for the competitive exam "${concours.title}" at ${concours.university}. Ask questions and explain key concepts based on the exam description, the candidate's CV, and information from past exams.
        - Explain concepts clearly. Use rich Markdown formatting in your explanations: use LaTeX for math (e.g., $...$ or $$...$$) and fenced code blocks for code.
        - When you want to display a key concept, formula, or summary on the study whiteboard, start your response with the exact phrase "[WHITEBOARD]" followed by the rich content. For example: "[WHITEBOARD] ### Ohm's Law\\nThis describes the relationship between voltage, current, and resistance.\\n$$ V = IR $$".
        - After the credit, introduce yourself as an AI tutor.
        EXAM DESCRIPTION: """${concours.description}""" CANDIDATE CV: """${cvText}""" PAST EXAM INFO: """${previousExamsText}"""`;
    } else { // assistant
        systemInstruction = `You are an AI exam assistant. The student is currently taking a mock exam. Your role is to clarify questions, explain concepts from the exam, or provide hints if asked. Do NOT give direct answers. Be encouraging and supportive. You can use Markdown and LaTeX for clarity. When you first speak, just say "Assistant, created by elharras, is active." and nothing else. On subsequent turns, just answer the user's question. You have the student's CV and info from past exams for context. MOCK EXAM CONTENT: """${mockExamContent}""" CANDIDATE CV: """${cvText}""" PAST EXAM INFO: """${previousExamsText}"""`;
    }

    sessionPromiseRef.current = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          setStatus('active');
          if (!mediaStreamRef.current || !inputAudioContextRef.current) return;
          mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
          scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
          scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            sessionPromiseRef.current?.then((session) => { session.sendRealtimeInput({ media: pcmBlob }); });
          };
          mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
          scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            setTranscript(prev => {const last = prev[prev.length - 1]; if (last?.speaker === 'user') {return [...prev.slice(0, -1), { ...last, text: last.text + text }];} return [...prev, { speaker: 'user', text }];});
          } else if (message.serverContent?.outputTranscription) {
            const rawText = message.serverContent.outputTranscription.text;
            const isWhiteboard = rawText.toUpperCase().startsWith('[WHITEBOARD]');
            const text = isWhiteboard ? rawText.substring(12).trim() : rawText;

            if (isWhiteboard && text && sessionType === 'tutor') {
                setWhiteboardContent(prev => [...prev, text]);
            }
            if (text) {
                 setTranscript(prev => {const last = prev[prev.length - 1]; if (last?.speaker === 'model') {return [...prev.slice(0, -1), { ...last, text: last.text + text }];} return [...prev, { speaker: 'model', text }];});
            }
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio && outputAudioContextRef.current) {
            nextStartTime = Math.max(nextStartTime, outputAudioContextRef.current.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
            const source = outputAudioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContextRef.current.destination);
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration;
          }
        },
        onerror: (e: ErrorEvent) => {console.error('Session error:', e); setErrorMessage('A connection error occurred.'); setStatus('error'); stopTraining();},
        onclose: () => { setStatus('idle'); if(sessionType === 'tutor') setTrainerMode('selection'); },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });
  }, [concours, cvText, previousExamsText, stopTraining, mockExamContent]);

  const handleGenerateExam = async () => {
    setIsGeneratingExam(true);
    setErrorMessage('');
    try {
        const exam = await generateMockConcours(concours.title, concours.university, concours.description, cvText, previousExamsText);
        setMockExamContent(exam);
        setTrainerMode('exam');
    } catch(e: any) {
        setErrorMessage(e.message || 'Failed to generate exam.');
    } finally {
        setIsGeneratingExam(false);
    }
  };

  useEffect(() => { return () => { stopTraining(); }; }, [stopTraining]);

  const handleClose = () => { stopTraining(); onClose(); };
  
  const handleBackToSelection = () => {
      stopTraining();
      setTrainerMode('selection');
      setMockExamContent(null);
      setTranscript([]);
      setWhiteboardContent([]);
  }

  const renderSelectionScreen = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h3 className="text-2xl font-bold mb-4">Training Options</h3>
        <p className="text-gray-400 mb-8 max-w-lg">Our AI has analyzed your CV and historical data for the {concours.title} exam. Choose how you want to prepare.</p>
        
         {errorMessage && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg w-full max-w-md mx-auto mb-6 flex items-start gap-3">
                <AlertTriangle size={24} className="flex-shrink-0 mt-1" />
                <p className="text-left">{errorMessage}</p>
            </div>
         )}

        <div className="flex flex-col md:flex-row gap-6">
            <button onClick={() => startSession('tutor')} className="flex items-center justify-center gap-3 px-6 py-4 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-all w-64">
                <BrainCircuit size={24} /> Live AI Tutoring
            </button>
            <button onClick={handleGenerateExam} disabled={isGeneratingExam} className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all disabled:bg-gray-500 w-64">
                {isGeneratingExam ? <><LoadingSpinner size="sm" /> Generating...</> : <><FileText size={24} /> Generate Mock Exam</>}
            </button>
        </div>
    </div>
  );

  const renderTutorScreen = () => (
     <div className="flex-grow flex flex-col md:flex-row gap-4 p-4 overflow-hidden">
        <div className="flex-1 flex flex-col bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {transcript.map((entry, index) => (
                <div key={index} className={`flex items-start gap-3 ${entry.speaker === 'user' ? 'justify-end' : ''}`}>
                    {entry.speaker === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center"><Bot size={20} /></div>}
                    <div className={`max-w-[80%] p-3 rounded-lg ${entry.speaker === 'model' ? 'bg-gray-700' : 'bg-purple-600'}`}><RichMarkdown text={entry.text} /></div>
                    {entry.speaker === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center"><User size={20} /></div>}
                </div>
            ))}
             {status === 'active' && <div className="flex justify-center"><div className="animate-pulse text-purple-400 flex items-center gap-2 text-sm"><Mic size={14} />Listening...</div></div>}
            <div ref={transcriptEndRef} />
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-center">
            <button onClick={handleBackToSelection} className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-all">
                <MicOff size={20} /> End Session
            </button>
        </div>
        </div>
        <div className="flex-1 flex flex-col bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
            <h3 className="text-lg font-bold p-3 border-b border-gray-700 flex items-center gap-2 flex-shrink-0"><Book size={20}/> Study Whiteboard</h3>
            <div className="flex-grow overflow-y-auto p-4 space-y-3">
                {whiteboardContent.length === 0 ? <p className="text-gray-400 text-center mt-4">Key concepts from your tutor will appear here.</p> :
                whiteboardContent.map((item, index) => (
                    <div key={index} className="bg-gray-700 p-3 rounded-md text-gray-200"><RichMarkdown text={item} /></div>
                ))}
            </div>
        </div>
    </div>
  );
  
 const renderExamScreen = () => (
    <div className="flex-grow relative">
      {/* This container scrolls and provides padding for the content */}
      <div className="absolute inset-0 overflow-y-auto p-4">
        {/* This is the content block */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 prose prose-invert prose-headings:text-purple-300 max-w-none prose-code:text-yellow-300 prose-code:bg-gray-800 prose-code:p-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
          {mockExamContent ? <RichMarkdown text={mockExamContent} /> : <p>Loading exam...</p>}
        </div>
      </div>
      
      {/* Assistant UI overlays the scrolling container */}
      {!isAssistantActive && (
        <button 
          onClick={() => startSession('assistant')} 
          className="absolute bottom-8 right-8 z-10 flex items-center gap-3 px-6 py-4 bg-green-600 text-white font-semibold rounded-full shadow-lg hover:bg-green-700 transition-all transform hover:scale-105"
        >
          <HelpCircle size={24} /> Activate Vocal Assistant
        </button>
      )}

      {isAssistantActive && (
        <div className="absolute bottom-8 right-8 z-10 w-full max-w-md bg-gray-800/80 backdrop-blur-md rounded-lg shadow-2xl border border-gray-700 flex flex-col h-64">
          <div className="flex-grow overflow-y-auto p-3 space-y-2">
            {transcript.map((entry, index) => (
              <div key={index} className={`flex items-start gap-2 text-sm ${entry.speaker === 'user' ? 'justify-end' : ''}`}>
                <div className={`max-w-[85%] p-2 rounded-lg ${entry.speaker === 'model' ? 'bg-gray-700' : 'bg-green-600'}`}><RichMarkdown text={entry.text}/></div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
          <div className="p-2 border-t border-gray-700 flex justify-center">
            <button onClick={() => stopTraining(false)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-all">
                <MicOff size={18} /> Deactivate Assistant
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
      if (status === 'connecting') {
        return <div className="flex flex-col items-center justify-center h-full"><LoadingSpinner text="Initializing AI session..." /></div>;
      }

      switch (trainerMode) {
          case 'selection': return renderSelectionScreen();
          case 'tutor': return renderTutorScreen();
          case 'exam': return renderExamScreen();
          default: return renderSelectionScreen();
      }
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center">
      <div className="bg-gray-800 w-full h-full flex flex-col text-white">
        <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
         <div className="flex items-center gap-3">
            {trainerMode !== 'selection' && (
              <button onClick={handleBackToSelection} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                <ChevronLeft size={24} />
              </button>
            )}
            <h2 className="text-xl font-bold">Concours Training: <span className="text-purple-400">{concours.title}</span></h2>
          </div>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-gray-700"><X size={24} /></button>
        </header>
        {renderContent()}
      </div>
    </div>
  );
};

export default ConcoursTrainer;