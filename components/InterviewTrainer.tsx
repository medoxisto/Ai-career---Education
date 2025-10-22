
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Job, TranscriptEntry } from '../types';
import { X, Mic, MicOff, Bot, User, AlertTriangle } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { CREATOR_CREDIT } from '../config';

// --- Audio Helper Functions (as per guidelines) ---

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
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

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}


// --- Component ---

interface InterviewTrainerProps {
  job: Job;
  onClose: () => void;
}

const InterviewTrainer: React.FC<InterviewTrainerProps> = ({ job, onClose }) => {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const stopInterview = useCallback(async () => {
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session:", e);
      }
    }
    
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    scriptProcessorRef.current?.disconnect();
    mediaStreamSourceRef.current?.disconnect();
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();

    sessionPromiseRef.current = null;
    mediaStreamRef.current = null;
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    scriptProcessorRef.current = null;
    mediaStreamSourceRef.current = null;

    setStatus('idle');
  }, []);

  const startInterview = useCallback(async () => {
    setStatus('connecting');
    setTranscript([]);
    setErrorMessage('');

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('Microphone access denied:', err);
      setErrorMessage('Microphone access was denied. Please go to your browser\'s site settings for this page, allow microphone access, and then try again.');
      setStatus('error');
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    let nextStartTime = 0;

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
            sessionPromiseRef.current?.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };

          mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
          scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          // Handle transcriptions
          if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            setTranscript(prev => {
                const last = prev[prev.length - 1];
                if (last?.speaker === 'user') {
                    const newLast = { ...last, text: last.text + text };
                    return [...prev.slice(0, -1), newLast];
                }
                return [...prev, { speaker: 'user', text }];
            });
          } else if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
             setTranscript(prev => {
                const last = prev[prev.length - 1];
                if (last?.speaker === 'model') {
                    const newLast = { ...last, text: last.text + text };
                    return [...prev.slice(0, -1), newLast];
                }
                return [...prev, { speaker: 'model', text }];
            });
          }

          // Handle audio output
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
        onerror: (e: ErrorEvent) => {
          console.error('Session error:', e);
          setErrorMessage('A connection error occurred. Please try again.');
          setStatus('error');
          stopInterview();
        },
        onclose: () => {
            // No action needed on normal close, handled by stopInterview
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: `Start by saying, "${CREATOR_CREDIT}". Then, you are an expert interviewer from ${job.company}. You are conducting a job interview for the role of "${job.title}". Ask the candidate relevant questions based on the provided job description. After the credit, introduce yourself and the role. Keep your questions professional and concise. JOB DESCRIPTION: """${job.description}"""`,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });

  }, [job, stopInterview]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopInterview();
    };
  }, [stopInterview]);

  const handleClose = () => {
    stopInterview();
    onClose();
  };

  const renderContent = () => {
      switch (status) {
          case 'idle':
          case 'error':
              return (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <h3 className="text-xl font-semibold mb-2">Ready to Practice?</h3>
                      <p className="text-gray-400 mb-6">Click "Start Interview" to begin your mock interview for the {job.title} role.</p>
                       {errorMessage && (
                        <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg w-full max-w-md mx-auto mb-6">
                            <div className="flex items-start gap-3">
                                <AlertTriangle size={24} className="flex-shrink-0 mt-1" />
                                <p className="text-left">{errorMessage}</p>
                            </div>
                        </div>
                       )}
                      <button onClick={startInterview} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all">
                          <Mic size={20} /> Start Interview
                      </button>
                  </div>
              )
          case 'connecting':
              return (
                <div className="flex flex-col items-center justify-center h-full">
                  <LoadingSpinner text="Connecting to interview session..." />
                </div>
              );
          case 'active':
              return (
                 <>
                    <div className="flex-grow overflow-y-auto p-6 space-y-4">
                        {transcript.map((entry, index) => (
                            <div key={index} className={`flex items-start gap-3 ${entry.speaker === 'user' ? 'justify-end' : ''}`}>
                                {entry.speaker === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center"><Bot size={20} /></div>}
                                <div className={`max-w-[80%] p-3 rounded-lg ${entry.speaker === 'model' ? 'bg-gray-700' : 'bg-purple-600'}`}>
                                    <p>{entry.text}</p>
                                </div>
                                {entry.speaker === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center"><User size={20} /></div>}
                            </div>
                        ))}
                        <div ref={transcriptEndRef} />
                    </div>
                    <div className="p-4 border-t border-gray-700 flex justify-center">
                        <button onClick={stopInterview} className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-all">
                            <MicOff size={20} /> End Interview
                        </button>
                    </div>
                 </>
              );
      }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 w-full max-w-2xl h-[90vh] max-h-[700px] rounded-lg shadow-2xl flex flex-col text-white border border-gray-700">
        <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold">Interview Training: <span className="text-blue-400">{job.title}</span></h2>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-gray-700">
            <X size={24} />
          </button>
        </header>
        {renderContent()}
      </div>
    </div>
  );
};

export default InterviewTrainer;
