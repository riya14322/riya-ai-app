import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Mic, 
  MicOff, 
  Loader2, 
  Volume2, 
  VolumeX, 
  Keyboard, 
  Send, 
  Trash2, 
  RefreshCcw, 
  Camera, 
  X, 
  Monitor, 
  ZoomIn, 
  ZoomOut, 
  Scan, 
  Eye, 
  AlertTriangle, 
  Phone, 
  Check,
  Bell, 
  MessageSquare, 
  Mail, 
  Instagram as InstagramIcon, 
  AlertCircle, 
  LayoutGrid, 
  Lock, 
  AppWindow, 
  ChevronDown, 
  ChevronUp,
  Settings
} from "lucide-react";
import { getZoyaResponse, getZoyaAudio, resetZoyaSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import { Notification, mockNotifications } from "./services/notificationService";
import { ApkInfo, installedApks as initialApks, getIcon } from "./services/apkService";
import Visualizer, { VisualizerMood } from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import ControlCenter, { SystemSettings } from "./components/ControlCenter";
import LockScreen from "./components/LockScreen";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "zoya";
  text: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

function UserCamera({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen"
    />
  );
}

const getAppIcon = (app: Notification['app']) => {
  switch (app) {
    case 'whatsapp': return <MessageSquare size={16} className="text-green-400" />;
    case 'gmail': return <Mail size={16} className="text-red-400" />;
    case 'instagram': return <InstagramIcon size={16} className="text-pink-400" />;
    case 'messages': return <AlertCircle size={16} className="text-blue-400" />;
    default: return <Bell size={16} className="text-gray-400" />;
  }
};

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("zoya_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("zoya_chat_history", JSON.stringify(messages));
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [mood, setMood] = useState<VisualizerMood>("default");
  const [audioLevels, setAudioLevels] = useState({ input: 0, output: 0 });
  const [roastVault, setRoastVault] = useState<{ title: string; content: string; roastLevel: number; timestamp: number }[]>(() => {
    const saved = localStorage.getItem("riya_roast_vault");
    return saved ? JSON.parse(saved) : [];
  });
  const [showVault, setShowVault] = useState(false);
  const [pinnedApks, setPinnedApks] = useState<string[]>(() => {
    const saved = localStorage.getItem("riya_pinned_apks");
    return saved ? JSON.parse(saved) : ["whatsapp", "youtube", "camera", "gallery"];
  });

  useEffect(() => {
    localStorage.setItem("riya_pinned_apks", JSON.stringify(pinnedApks));
  }, [pinnedApks]);

  const [vaultSearch, setVaultSearch] = useState("");
  const [vaultCategory, setVaultCategory] = useState<"all" | "roast" | "praise">("all");

  const filteredVault = roastVault.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(vaultSearch.toLowerCase()) || 
                         r.content.toLowerCase().includes(vaultSearch.toLowerCase());
    const isRoast = r.roastLevel > 3;
    if (vaultCategory === "roast") return matchesSearch && isRoast;
    if (vaultCategory === "praise") return matchesSearch && !isRoast;
    return matchesSearch;
  });

  useEffect(() => {
    localStorage.setItem("riya_roast_vault", JSON.stringify(roastVault));
  }, [roastVault]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [displayMode, setDisplayMode] = useState<"camera" | "screen">("camera");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingCall, setPendingCall] = useState<{ phoneNumber: string } | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ title: string; content: string; roastLevel: number; majorIssues?: string[] } | null>(null);
  const [analysisTags, setAnalysisTags] = useState<string[]>([]);
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>(() => {
    const saved = localStorage.getItem("riya_gallery");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    // Only save last 20 to avoid localStorage limits
    localStorage.setItem("riya_gallery", JSON.stringify(gallery.slice(0, 20)));
  }, [gallery]);

  const [showGallery, setShowGallery] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [apks, setApks] = useState<ApkInfo[]>(initialApks);
  const [showAppDrawer, setShowAppDrawer] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [flash, setFlash] = useState(false);
  const [tapPosition, setTapPosition] = useState<{ x: number, y: number } | null>(null);
  const [scrollHint, setScrollHint] = useState<"up" | "down" | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem("riya_system_settings");
    return saved ? JSON.parse(saved) : {
      wifi: true,
      bluetooth: true,
      flashlight: false,
      airplaneMode: false,
      doNotDisturb: false,
      autoRotate: true,
      brightness: 75,
      volume: 60,
      battery: 84,
      ramUsage: 2.4,
      storageUsage: 62
    };
  });

  useEffect(() => {
    localStorage.setItem("riya_system_settings", JSON.stringify(systemSettings));
  }, [systemSettings]);

  const [showControlCenter, setShowControlCenter] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isDualVision, setIsDualVision] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: "user", text: finalTranscript }]);
    
    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // 1. Check for browser commands
    const commandResult = processCommand(finalTranscript);

    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "zoya", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      // 2. General Chit-Chat via Gemini
      responseText = await getZoyaResponse(finalTranscript, messagesRef.current);

      // Parse Mood from response
      const moods: VisualizerMood[] = ["sassy", "annoyed", "curious", "happy"];
      for (const m of moods) {
        if (responseText.toUpperCase().includes(`[${m.toUpperCase()}]`)) {
          setMood(m);
          responseText = responseText.replace(new RegExp(`\\[${m.toUpperCase()}\\]`, 'gi'), '').trim();
          break;
        }
      }

      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "zoya", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      setCameraStream(null);
      setDisplayMode("camera");
      setLastFrame(null);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetZoyaSession();
    } else {
      try {
        setIsSessionActive(true);
        resetZoyaSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + sender, sender, text }]);
        };
        
        session.onCommand = (url) => {
          setTimeout(() => {
            window.open(url, "_blank");
          }, 1000);
        };

        session.onMoodChange = (newMood) => {
          setMood(newMood);
        };

        session.onSettingChange = (setting: any, value: any) => {
          setSystemSettings(prev => {
            const val = typeof value === 'string' && (value === 'on' || value === 'off' || value === 'true' || value === 'false') 
              ? (value === 'on' || value === 'true') 
              : (typeof value === 'string' && value.includes('%') ? parseInt(value) : value);
            
            return { ...prev, [setting]: val };
          });
          if (setting === 'flashlight') {
            setFlash(value === 'on' || value === true);
          }
          setShowControlCenter(true);
          setTimeout(() => setShowControlCenter(false), 3000);
        };

        session.onSystemCommand = (action: string) => {
          if (action === "lock") {
            setIsLocked(true);
          } else if (action === "restart") {
            window.location.reload();
          } else if (action === "mute") {
            setIsMuted(true);
          }
        };

        session.onCallRequest = (phoneNumber) => {
          setPendingCall({ phoneNumber });
        };

        session.onVolumeChange = (levels) => {
          setAudioLevels(levels);
        };

        session.onStreamReady = (stream) => {
          setCameraStream(stream);
        };

        session.onFrame = (dataUrl) => {
          setLastFrame(dataUrl);
        };

        session.onPhotoCapture = (dataUrl) => {
          setGallery(prev => [dataUrl, ...prev]);
          setFlash(true);
          
          // Trigger browser download to "Storage"
          try {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `riya_capture_${new Date().getTime()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } catch (err) {
            console.error("Failed to auto-download photo", err);
          }

          setTimeout(() => setFlash(false), 200);
        };

        session.onGesture = (type, detail) => {
          if (type === "scroll") {
            const direction = detail === "up" ? -1 : 1;
            setScrollHint(detail);
            window.scrollBy({ top: 400 * direction, behavior: "smooth" });
            setTimeout(() => setScrollHint(null), 1200);
          } else if (type === "click") {
            // detail is { description, url }
            const { url } = detail;
            const x = Math.random() * (window.innerWidth - 100) + 50;
            const y = Math.random() * (window.innerHeight - 100) + 50;
            setTapPosition({ x, y });

            if (url) {
              setTimeout(() => {
                window.open(url, "_blank");
              }, 600); // Navigate slightly after the visual tap
            }

            setTimeout(() => setTapPosition(null), 1000);
          }
        };

        session.onModeChange = (mode) => {
          setDisplayMode(mode);
          if (mode === "camera") setIsDualVision(false);
        };

        session.onShareRequest = () => {
          setShowShareModal(true);
        };

        session.onNotification = (newNotifications) => {
          setNotifications(prev => {
            const combined = [...newNotifications, ...prev];
            // Only keep last 30
            return combined.slice(0, 30);
          });
          setShowNotificationCenter(true);
        };

        session.onApkInspection = (newApks) => {
          setApks(newApks);
          setShowAppDrawer(true);
        };

        session.onScreenAnalysis = (analyzing) => {
          setIsAnalyzing(analyzing);
          if (analyzing) {
            setAnalysisReportOpen(true);
            const tags = ["ANALYIZING APPS", "READING TEXT", "MAPPING UI", "RIYA FOCUS"];
            setAnalysisTags([]);
            tags.forEach((tag, i) => {
              setTimeout(() => {
                setAnalysisTags(prev => [...prev, tag]);
              }, i * 600);
            });
          } else {
            setAnalysisTags([]);
          }
        };

        session.onAnalysisResult = (result) => {
          setAnalysisResult(result);
          setAnalysisReportOpen(true);
          setRoastVault(prev => [{ ...result, timestamp: Date.now() }, ...prev].slice(0, 50));
        };

        session.onZoomChange = (newZoom) => {
          setZoom(newZoom);
        };

        await session.start();
      } catch (e) {
        console.error("Failed to start session", e);
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleSwitchCamera = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.switchCamera();
    }
  };

  const handleToggleScreenShare = () => {
    if (liveSessionRef.current) {
      const nextMode = displayMode === "camera" ? "screen" : "camera";
      liveSessionRef.current.switchMode(nextMode);
    }
  };

  const handleDualScan = async () => {
    if (liveSessionRef.current) {
      if (isDualVision) {
        liveSessionRef.current.switchMode("camera", true);
        setIsDualVision(false);
      } else {
        if (screenVideoRef.current && cameraVideoRef.current) {
          await liveSessionRef.current.startDualScan(screenVideoRef.current, cameraVideoRef.current);
          setIsDualVision(true);
        }
      }
    }
  };

  const forceScreenShare = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.switchMode("screen", true);
    }
  };

  const [zoom, setZoom] = useState(1);
  const [analysisReportOpen, setAnalysisReportOpen] = useState(false);

  const handleZoom = (direction: 'in' | 'out') => {
    if (liveSessionRef.current) {
      const currentZoom = liveSessionRef.current.getZoom();
      const newZoom = direction === 'in' ? currentZoom + 0.5 : currentZoom - 0.5;
      liveSessionRef.current.setZoom(newZoom);
    }
  };

  const handleAnalyzeScreen = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.sendTextMessage("RIYA, check out my screen and give me a full visual critique/report. Don't hold back!");
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  const moodColors = {
    default: "from-violet-900/20 via-[#050505] to-[#050505]",
    sassy: "from-pink-900/30 via-[#050505] to-[#050505]",
    annoyed: "from-red-900/20 via-[#050505] to-[#050505]",
    curious: "from-cyan-900/20 via-[#050505] to-[#050505]",
    happy: "from-amber-900/20 via-[#050505] to-[#050505]",
    roasting: "from-orange-900/30 via-[#050505] to-[#050505]"
  };

  const hudData = [
    { label: "Neural Flow", value: "98.4%", color: "text-violet-400" },
    { label: "Context Depth", value: messages.length * 12 + " tokens", color: "text-blue-400" },
    { label: "Entropy", value: (audioLevels.input * 100).toFixed(1) + "%", color: "text-fuchsia-400" },
    { label: "Visual Buffer", value: displayMode === "camera" ? "Live RGB" : "Screen Luma", color: "text-emerald-400" }
  ];

  return (
    <div className={`h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0 transition-colors duration-1000`}>
      {/* Mood Aura Background */}
      <motion.div 
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 4, repeat: Infinity }}
        className={`absolute inset-0 bg-radial-gradient ${moodColors[mood] || moodColors.default} pointer-events-none z-0`} 
      />
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      <AnimatePresence>
        {/* Flashlight Overlay */}
        {systemSettings.flashlight && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[5] pointer-events-none"
          />
        )}

        {analysisReportOpen && analysisResult && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-lg z-[100] px-4"
          >
            <div className="bg-black/90 border border-violet-500/30 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
              <div className="bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-500/20 rounded-xl">
                    <Eye size={18} className="text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{analysisResult.title}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      {[...Array(10)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-2 h-1 rounded-full ${i < analysisResult.roastLevel ? 'bg-fuchsia-500' : 'bg-white/10'}`} 
                        />
                      ))}
                      <span className="text-[8px] text-fuchsia-400 font-mono ml-2 uppercase">Roast Level {analysisResult.roastLevel}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setAnalysisReportOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="prose prose-invert prose-sm max-w-none prose-violet">
                   <Markdown>{analysisResult.content}</Markdown>
                </div>

                {analysisResult.majorIssues && analysisResult.majorIssues.length > 0 && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <AlertCircle size={12} />
                      Major Issues Detected
                    </h4>
                    <ul className="space-y-2">
                       {analysisResult.majorIssues.map((issue, i) => (
                         <li key={i} className="text-xs text-red-200/70 flex gap-2">
                            <span className="text-red-500">•</span>
                            {issue}
                         </li>
                       ))}
                    </ul>
                  </div>
                )}
                
                {analysisResult.roastLevel > 7 && (
                  <div className="mt-6 flex items-center gap-3 p-4 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-2xl text-fuchsia-300">
                    <AlertTriangle size={20} className="shrink-0" />
                    <p className="text-xs italic font-medium">RIYA was strictly being honest. Don't take it personally, Sumit!</p>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => setAnalysisReportOpen(false)}
                  className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Confirmation Modal */}
      <AnimatePresence>
        {pendingCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-2xl p-6 pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="w-full max-w-sm bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-white/10 rounded-[40px] p-8 shadow-[0_20px_100px_rgba(139,92,246,0.15)] flex flex-col items-center text-center relative overflow-hidden"
            >
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-pink-500" />
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-violet-600/10 rounded-full blur-3xl" />
              
              <div className="w-20 h-20 rounded-3xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-6 relative">
                 <Phone size={32} className="text-violet-400 group-hover:rotate-12 transition-transform" />
                 <motion.div 
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-violet-500/20 rounded-full blur-xl"
                 />
              </div>

              <h2 className="text-2xl font-bold mb-2 tracking-tight">Confirm Dialing</h2>
              <p className="text-white/40 text-sm mb-6 uppercase tracking-widest font-mono">Verify Number</p>
              
              <div className="bg-white/5 border border-white/10 w-full rounded-2xl p-6 mb-8">
                 <span className="text-3xl font-mono font-black text-violet-300 block mb-1">
                   {pendingCall.phoneNumber}
                 </span>
                 <span className="text-[10px] text-white/30 uppercase tracking-[0.2em]">External Line Requested</span>
              </div>

              <p className="text-white/60 text-sm mb-8 px-2 max-w-[280px]">
                "Arey Sumit! Should I actually initiate the call to this number? Be careful, don't get me in trouble!"
              </p>

              <div className="flex flex-col w-full gap-3">
                 <button
                   onClick={() => {
                     window.location.href = `tel:${pendingCall.phoneNumber}`;
                     setPendingCall(null);
                     if (liveSessionRef.current) {
                        liveSessionRef.current.sendText("Dialer confirmed. I'm connecting you now!");
                     }
                   }}
                   className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-4 rounded-[20px] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-violet-600/20"
                 >
                   <Check size={20} />
                   Confirm Call
                 </button>
                 <button
                   onClick={() => setPendingCall(null)}
                   className="w-full bg-white/5 hover:bg-white/10 text-white/40 font-medium py-4 rounded-[20px] transition-all"
                 >
                   Cancel
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cinematic Background Gradients */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2] 
          }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-violet-900/30 blur-[120px] rounded-full" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-pink-900/20 blur-[120px] rounded-full" 
        />
      </div>

      {/* Header */}
      <ControlCenter 
        isOpen={showControlCenter}
        onClose={() => setShowControlCenter(false)}
        settings={systemSettings}
        onSettingChange={(s, v) => setSystemSettings(prev => ({ ...prev, [s]: v }))}
      />

      <LockScreen 
        isLocked={isLocked}
        onUnlock={() => setIsLocked(false)}
        ownerName="SUMIT"
      />

      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center font-bold text-sm">
            R
          </div>
          <h1 className="text-xl font-serif font-medium tracking-wide opacity-90">RIYA</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowControlCenter(true)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title="Control Center"
          >
            <Settings size={18} className="opacity-70" />
          </button>
          {gallery.length > 0 && (
            <button
              onClick={() => setShowGallery(true)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 relative"
              title="Gallery"
            >
              <Camera size={18} className="opacity-70" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 text-[10px] rounded-full flex items-center justify-center font-bold">
                {gallery.length}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* HUD Layer */}
      <AnimatePresence>
        {isSessionActive && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-24 left-8 z-30 flex flex-col gap-4 pointer-events-none"
          >
            {hudData.map((item, i) => (
              <motion.div 
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-black/40 backdrop-blur-md border-l-2 border-white/10 pl-3 py-1"
              >
                <div className="text-[9px] uppercase tracking-[0.2em] opacity-40 font-mono">{item.label}</div>
                <div className={`text-xs font-mono font-bold ${item.color}`}>{item.value}</div>
              </motion.div>
            ))}
            
            <div className="mt-8">
               <div className="text-[9px] uppercase tracking-[0.2em] opacity-40 font-mono mb-2">Neural Input</div>
               <div className="h-24 w-1 bg-white/5 rounded-full relative overflow-hidden">
                  <motion.div 
                    animate={{ height: [0, audioLevels.input * 400 + "%"] }}
                    className="absolute bottom-0 w-full bg-violet-400/60"
                  />
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memory Bank Sidebar */}
      <AnimatePresence>
        {showVault && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-sm z-[200] bg-black/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col p-8 pointer-events-auto"
          >
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-500/20 rounded-xl">
                    <Lock size={18} className="text-violet-400" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight">Memory Bank</h2>
               </div>
               <button onClick={() => setShowVault(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
               </button>
            </div>

            <div className="mb-6 space-y-4">
               <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search memories..." 
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 pl-10 text-sm focus:border-violet-500/50 outline-none transition-all"
                  />
                  <Send size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 rotate-45" />
               </div>
               <div className="flex gap-2">
                  {["all", "roast", "praise"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setVaultCategory(cat as any)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${
                        vaultCategory === cat ? "bg-violet-600 border-violet-500 text-white" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
               {filteredVault.length === 0 ? (
                 <div className="text-center py-20 opacity-30">
                    <AlertCircle size={48} className="mx-auto mb-4" />
                    <p className="text-sm italic">No {vaultCategory !== 'all' ? vaultCategory : ''} memories found.</p>
                 </div>
               ) : (
                 filteredVault.map((roast, i) => (
                   <motion.button
                     key={roast.timestamp}
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ delay: i * 0.05 }}
                     onClick={() => {
                        setAnalysisResult(roast);
                        setAnalysisReportOpen(true);
                     }}
                     className="w-full text-left p-5 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group relative overflow-hidden"
                   >
                     <div className="absolute top-0 left-0 w-1 h-full bg-violet-500/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                     
                     <div className="flex items-center justify-between mb-3">
                        <span className="text-[9px] font-mono opacity-40 flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                           {new Date(roast.timestamp).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full">
                           {[...Array(5)].map((_, j) => (
                             <div key={j} className={`w-1 h-1 rounded-full ${j < Math.floor(roast.roastLevel / 2) ? (roast.roastLevel > 7 ? 'bg-orange-400' : 'bg-fuchsia-400') : 'bg-white/10'}`} />
                           ))}
                        </div>
                     </div>
                     <h3 className="text-sm font-bold text-violet-300 group-hover:text-white transition-colors">{roast.title}</h3>
                     <p className="text-[11px] text-white/40 line-clamp-2 mt-2 leading-relaxed italic">"{roast.content.substring(0, 80)}..."</p>
                     
                     <div className="mt-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-mono text-violet-400/60 font-bold uppercase tracking-widest">Open Analysis</span>
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setRoastVault(prev => prev.filter(r => r.timestamp !== roast.timestamp));
                          }}
                          className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-lg transition-all"
                        >
                           <Trash2 size={12} />
                        </div>
                     </div>
                   </motion.button>
                 ))
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Visualizer & Chat */}
      <main className="absolute inset-0 flex flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-20 pb-24 px-4 md:px-12 pointer-events-none">
        {/* Gesture Feedback: Simulated Tap */}
        <AnimatePresence>
          {tapPosition && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              exit={{ scale: 2.5, opacity: 0 }}
              className="fixed z-[100] w-12 h-12 bg-white/20 border-2 border-white/40 rounded-full flex items-center justify-center pointer-events-none"
              style={{ left: tapPosition.x, top: tapPosition.y }}
            >
              <div className="w-4 h-4 bg-white/60 rounded-full animate-ping" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gesture Feedback: Scroll Hint */}
        <AnimatePresence>
          {scrollHint && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: scrollHint === "down" ? -20 : 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none"
            >
              <div className="relative group">
                {/* Glow behind */}
                <div className="absolute inset-x-0 h-20 -top-10 bg-violet-500/20 blur-3xl rounded-full" />
                
                <div className="flex flex-col items-center gap-4 bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-8 rounded-full shadow-2xl">
                  <motion.div 
                    animate={{ 
                      y: scrollHint === "down" ? [0, 10, 0] : [0, -10, 0] 
                    }}
                    transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                    className="text-violet-400"
                  >
                    {scrollHint === "down" ? (
                      <div className="flex flex-col items-center">
                        <ChevronDown size={32} />
                        <ChevronDown size={24} className="-mt-4 opacity-50" />
                        <ChevronDown size={16} className="-mt-3 opacity-25" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <ChevronUp size={16} className="opacity-25" />
                        <ChevronUp size={24} className="-mt-3 opacity-50" />
                        <ChevronUp size={32} className="-mt-4" />
                      </div>
                    )}
                  </motion.div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
                    Auto {scrollHint}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scanning Overlay */}
        <AnimatePresence mode="wait">
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] pointer-events-none flex flex-col items-center justify-center font-sans"
            >
              <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[4px]" />
              
              {/* Neural Scan Line */}
              <motion.div 
                 initial={{ y: "-100%" }}
                 animate={{ y: "100%" }}
                 transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                 className="absolute top-0 left-0 w-full h-[150px] bg-gradient-to-b from-transparent via-blue-400/30 to-transparent shadow-[0_0_40px_rgba(56,189,248,0.5)] z-10"
              />

              {/* Analysis Tags Intelligence */}
              <div className="absolute inset-0 p-20 flex flex-wrap gap-4 items-start justify-center content-start">
                 <AnimatePresence>
                   {analysisTags.map((tag, i) => (
                     <motion.div
                       key={tag + i}
                       initial={{ opacity: 0, scale: 0.8, y: 20 }}
                       animate={{ opacity: 1, scale: 1, y: 0 }}
                       exit={{ opacity: 0, scale: 0.8 }}
                       className="bg-blue-500/20 border border-blue-400/30 px-4 py-1.5 rounded-full backdrop-blur-md flex items-center gap-2"
                     >
                       <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                       <span className="text-[10px] font-mono font-bold text-blue-200 uppercase tracking-widest">{tag}</span>
                     </motion.div>
                   ))}
                 </AnimatePresence>
              </div>

              <div className="bg-[#0f172a]/80 border border-blue-500/20 p-8 rounded-[40px] backdrop-blur-2xl flex flex-col items-center gap-6 relative z-20 shadow-[0_0_100px_rgba(56,189,248,0.2)]">
                 <div className="relative">
                    <Loader2 className="text-blue-400 animate-spin" size={48} strokeWidth={1.5} />
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute inset-0 bg-blue-400 rounded-full blur-xl"
                    />
                 </div>
                 <div className="flex flex-col items-center gap-2 text-center">
                    <span className="text-2xl font-bold text-blue-50 tracking-tight">RIYA is Intelligence Mapping...</span>
                    <p className="text-blue-400/60 text-[10px] font-mono uppercase tracking-[0.3em]">Processing Visual Stream</p>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flash Effect */}
        <AnimatePresence>
          {flash && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white z-[100] pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Screen Share Request Modal (Refined to match screenshot) */}
        <AnimatePresence>
          {showShareModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-xl p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 30 }}
                className="w-full max-w-sm bg-[#1e293b]/90 border border-white/10 rounded-[48px] p-10 shadow-[0_0_80px_rgba(56,189,248,0.15)] flex flex-col items-center text-center relative overflow-hidden pointer-events-auto"
              >
                {/* Background Glow */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-[60px] pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-[60px] pointer-events-none" />

                <div className="relative z-10 w-full flex flex-col items-center">
                  <div className="w-24 h-24 rounded-[32px] bg-blue-500/10 flex items-center justify-center mx-auto mb-10 relative">
                    <Monitor size={48} className="text-blue-400" />
                    <motion.div 
                      animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.3, 0.1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-blue-400 rounded-full blur-2xl"
                    />
                  </div>
                  
                  <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-100 to-blue-300 bg-clip-text text-transparent italic tracking-tight">
                    Riya is Watching!
                  </h2>
                  
                  <p className="text-blue-100/60 text-lg mb-10 leading-snug px-2 font-sans">
                    "Arey! Allow me to see your simulation screen so I can navigate the browser for you. Tap below to share!"
                  </p>
                  
                  <div className="flex flex-col w-full gap-4 relative z-20">
                    <button
                      type="button"
                      onClick={() => {
                        setShowShareModal(false);
                        forceScreenShare();
                      }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-5 rounded-[24px] transition-all shadow-[0_8px_20px_rgba(59,130,246,0.3)] active:scale-[0.98] text-lg cursor-pointer touch-manipulation select-none"
                    >
                      Allow Screen Share
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowShareModal(false)}
                      className="w-full bg-white/5 hover:bg-white/10 text-white/40 py-4 rounded-[24px] transition-all font-medium cursor-pointer touch-manipulation select-none"
                    >
                      Maybe Later
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gallery Modal */}
        <AnimatePresence>
          {showGallery && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 z-50 backdrop-blur-xl flex flex-col p-8 pointer-events-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-serif">Memory Gallery</h2>
                <button 
                  onClick={() => setShowGallery(false)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pb-12">
                {gallery.map((img, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="aspect-square rounded-xl overflow-hidden border border-white/10 group relative"
                  >
                    <img src={img} alt={`Capture ${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <a href={img} download={`riya_capture_${idx}.jpg`} className="text-xs uppercase font-mono tracking-widest bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">Save</a>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* App Drawer (APK Control) */}
        <AnimatePresence>
          {showAppDrawer && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 pointer-events-auto"
            >
              <div className="bg-[#151515] border border-white/10 rounded-[2rem] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-pink-500 to-cyan-500" />
                
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-serif font-bold mb-1">Simulated App Drawer</h2>
                    <p className="text-gray-500 text-sm">RIYA has indexed {apks.length} installed APKs in this OS simulation.</p>
                  </div>
                  <button 
                    onClick={() => setShowAppDrawer(false)}
                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {/* Pinned Section */}
                    {apks.filter(a => pinnedApks.includes(a.id)).map((apk) => {
                      const IconComp = getIcon(apk.icon);
                      return (
                        <motion.button
                          key={`pinned-${apk.id}`}
                          whileHover={{ y: -5 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            if (apk.isLocked) {
                              liveSessionRef.current?.sendText(`Unlock ${apk.name} for me.`);
                            } else {
                              liveSessionRef.current?.sendText(`Arey RIYA, open the ${apk.name} app.`);
                            }
                            setShowAppDrawer(false);
                          }}
                          className={`group relative flex flex-col items-center p-6 rounded-3xl border transition-all ${
                            apk.isLocked 
                            ? "bg-red-500/5 border-red-500/10 grayscale opacity-60" 
                            : "bg-gradient-to-br from-violet-500/10 to-pink-500/10 border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
                          }`}
                        >
                          <div className="absolute top-3 left-3">
                             <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shadow-[0_0_5px_rgba(167,139,250,0.8)]" />
                          </div>

                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all ${
                            apk.isLocked ? "bg-red-500/10" : "bg-white/5 group-hover:scale-110"
                          }`}>
                            <IconComp size={32} className={apk.isLocked ? "text-red-400" : "text-violet-400"} />
                          </div>
                          
                          <span className="font-bold text-gray-200 group-hover:text-white transition-colors">{apk.name}</span>
                          <span className="text-[10px] font-mono opacity-40 uppercase tracking-tighter mt-1">{apk.packageName}</span>
                          
                          <div className="mt-3 flex items-center gap-2">
                             <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500/60 w-full" />
                             </div>
                             <span className="text-[10px] text-violet-400 font-bold uppercase tracking-widest">Pinned</span>
                          </div>
                        </motion.button>
                      );
                    })}

                    <div className="col-span-full border-t border-white/5 my-4 pt-4 flex items-center gap-4">
                       <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Global Applications</span>
                       <div className="flex-1 h-[1px] bg-white/5" />
                    </div>

                    {apks.filter(a => !pinnedApks.includes(a.id)).map((apk) => {
                      const IconComp = getIcon(apk.icon);
                      return (
                        <motion.div
                          key={apk.id}
                          whileHover={{ y: -5 }}
                          whileTap={{ scale: 0.95 }}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (apk.isLocked) {
                              liveSessionRef.current?.sendText(`Unlock ${apk.name} for me.`);
                            } else {
                              liveSessionRef.current?.sendText(`Arey RIYA, open the ${apk.name} app.`);
                            }
                            setShowAppDrawer(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (apk.isLocked) {
                                liveSessionRef.current?.sendText(`Unlock ${apk.name} for me.`);
                              } else {
                                liveSessionRef.current?.sendText(`Arey RIYA, open the ${apk.name} app.`);
                              }
                              setShowAppDrawer(false);
                            }
                          }}
                          className={`group relative flex flex-col items-center p-6 rounded-3xl border transition-all cursor-pointer ${
                            apk.isLocked 
                            ? "bg-red-500/5 border-red-500/10 grayscale opacity-60" 
                            : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                          }`}
                        >
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all ${
                            apk.isLocked ? "bg-red-500/10" : "bg-gradient-to-br from-violet-500/10 to-pink-500/10 group-hover:scale-110"
                          }`}>
                            <IconComp size={32} className={apk.isLocked ? "text-red-400" : "text-violet-400"} />
                          </div>
                          
                          <span className="font-bold text-gray-200 group-hover:text-white transition-colors">{apk.name}</span>
                          <span className="text-[10px] font-mono opacity-40 uppercase tracking-tighter mt-1">{apk.packageName}</span>
                          
                          <div className="mt-3 flex items-center gap-2">
                             <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500/40 w-2/3" />
                             </div>
                             <span className="text-[10px] opacity-30">{apk.usageTime}</span>
                          </div>

                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPinnedApks(prev => [...prev, apk.id]);
                            }}
                            className="absolute bottom-4 right-4 p-1.5 rounded-lg hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                             <ZoomIn size={12} className="text-gray-500" />
                          </button>

                          {apk.isLocked && (
                            <div className="absolute top-4 right-4 text-red-500/40">
                              <Lock size={14} />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-6 bg-white/5 border-t border-white/5 flex justify-between items-center px-10">
                   <div className="flex items-center gap-6 opacity-40 text-xs font-mono">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                         <span>OS Integrity: Secure</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <AppWindow size={14} />
                         <span>Root Access: RIYA</span>
                      </div>
                   </div>
                   <button 
                     onClick={() => {
                        liveSessionRef.current?.sendText("RIYA, run a system diagnostic on my APKs.");
                        setShowAppDrawer(false);
                     }}
                     className="px-6 py-2 rounded-full bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 font-medium transition-all text-sm border border-violet-500/20"
                   >
                     System Diagnostic
                   </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification Center */}
        <AnimatePresence>
          {showNotificationCenter && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-sm bg-[#121212] border-l border-white/10 z-[60] shadow-2xl backdrop-blur-xl flex flex-col pointer-events-auto"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                  <Bell className="text-violet-400" size={20} />
                  <h2 className="text-xl font-medium">Notifications</h2>
                </div>
                <button 
                  onClick={() => setShowNotificationCenter(false)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {notifications.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-center p-8">
                    <Bell size={48} className="mb-4" />
                    <p>All quiet on the notification front.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-2xl border transition-all ${
                        n.isRead ? "bg-white/5 border-white/5 opacity-60" : "bg-white/10 border-white/10 shadow-lg ring-1 ring-white/10"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-black/40">
                            {getAppIcon(n.app)}
                          </div>
                          <span className="font-bold text-sm text-gray-200">{n.sender}</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-40">{n.time}</span>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">{n.content}</p>
                      
                      {!n.isRead && (
                        <div className="mt-3 pt-3 border-t border-white/5 flex gap-2">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               liveSessionRef.current?.sendText(`Arey RIYA, reply to ${n.sender}'s message: "Theek hai, bad mein baat karenge."`);
                               setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, isRead: true } : notif));
                             }}
                             className="px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold rounded-lg transition-all"
                           >
                              QUICK REPLY
                           </button>
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, isRead: true } : notif));
                             }}
                             className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/40 text-[10px] font-bold rounded-lg transition-all"
                           >
                              DISMISS
                           </button>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
              
              {notifications.some(n => !n.isRead) && (
                <div className="p-4 bg-white/5 border-t border-white/10">
                  <button
                    onClick={() => {
                      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                    }}
                    className="w-full py-3 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 font-medium transition-all text-sm"
                  >
                    Mark all as read
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Left Column: RIYA Status */}
        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-6">
            <AnimatePresence>
              {appState === "processing" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 text-cyan-300/80 text-sm md:text-base italic font-serif"
                >
                  <Loader2 size={16} className="animate-spin" />
                  Replying...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Visualizer (Fixed Full Screen Background) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <Visualizer 
            state={appState} 
            mood={mood} 
            audioLevels={audioLevels}
          />
        </div>

        {/* Right Column: User Status & Vision POV */}
        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-6 flex justify-end">
            <AnimatePresence>
              {appState === "listening" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-violet-300/80 text-sm md:text-base italic"
                >
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  Listening...
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIYA POV PREVIEW (Mini HUD) */}
          <AnimatePresence>
            {isSessionActive && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="mt-8 border border-white/10 rounded-2xl overflow-hidden bg-black/40 backdrop-blur-sm self-end"
              >
                <div className="px-3 py-1 bg-white/5 border-b border-white/10 flex justify-between items-center bg-violet-500/10">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest font-mono text-violet-300">RIYA POV</span>
                    {/* Pulsing indicator when a frame is captured */}
                    <AnimatePresence mode="wait">
                       <motion.div 
                         key={lastFrame}
                         initial={{ opacity: 0.5, scale: 1 }}
                         animate={{ opacity: 1, scale: 1.2 }}
                         className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                       />
                    </AnimatePresence>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-1 h-3 bg-violet-500/50 animate-pulse" />
                    <div className="w-1 h-3 bg-violet-500/50 animate-pulse [animation-delay:0.2s]" />
                  </div>
                </div>
                <div className="w-32 h-24 md:w-48 md:h-36 bg-black flex items-center justify-center relative">
                   <div className="absolute inset-0 bg-gradient-radial from-violet-500/5 to-transparent pointer-events-none" />
                   
                   {/* REAL CAMERA PREVIEW */}
                   {cameraStream && (
                     <UserCamera stream={cameraStream} />
                   )}

                   {/* CAPTURED FRAME OVERLAY (WHAT RIYA SEES) */}
                   {lastFrame && (
                     <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay">
                       <img src={lastFrame} alt="Captured scan" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     </div>
                   )}

                   {/* HUD Overlays */}
                   <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                      <AnimatePresence>
                        {isAnalyzing && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center bg-violet-500/5 backdrop-blur-[1px]"
                          >
                             <motion.div 
                               animate={{ 
                                 top: ["0%", "100%", "0%"],
                               }}
                               transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                               className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-violet-400 to-transparent shadow-[0_0_10px_rgba(167,139,250,0.8)]"
                             />
                             <div className="flex flex-col items-center gap-2">
                                <div className="p-3 rounded-full border border-violet-400/30 bg-black/40 animate-pulse">
                                   <Scan size={24} className="text-violet-400" />
                                </div>
                                <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-violet-300 bg-black/80 px-2 py-0.5 rounded border border-violet-500/30">
                                  Structural Deep Scan
                                </span>
                             </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <div className="flex flex-col items-center gap-2 opacity-30">
                        <div className="flex gap-1">
                           <div className="w-1 h-1 rounded-full bg-violet-500 animate-ping" />
                           <span className="text-[8px] font-mono uppercase text-violet-400">Live Feedback</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                           {[...Array(9)].map((_, i) => (
                             <div key={i} className="w-2 h-2 border-[0.5px] border-violet-500/20" />
                           ))}
                        </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Controls */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-md flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1 pl-4 backdrop-blur-md shadow-2xl"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message to RIYA..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className="p-2 rounded-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:hover:bg-violet-500 transition-colors"
              >
                <Send size={16} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          <AnimatePresence>
            {isSessionActive && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleAnalyzeScreen}
                className="p-4 rounded-full bg-violet-600/30 text-white border border-violet-500/40 hover:bg-violet-600/50 active:scale-95 transition-all shadow-xl group"
                title="Critique Screen"
              >
                <Scan size={20} className="group-hover:scale-110 transition-transform" />
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isSessionActive && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleSwitchCamera}
                className="p-4 rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 active:scale-95 transition-all shadow-xl"
                title="Switch Camera"
              >
                <RefreshCcw size={20} />
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isSessionActive && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleToggleScreenShare}
                className={`p-4 rounded-full border transition-all shadow-xl active:scale-95 ${
                  displayMode === "screen" ? "bg-violet-500/40 text-violet-300 border-violet-500/50" : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                }`}
                title={displayMode === "camera" ? "Share Screen" : "Switch to Camera"}
              >
                <Monitor size={20} />
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isSessionActive && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleDualScan}
                className={`p-4 rounded-full border transition-all shadow-xl active:scale-95 ${
                  isDualVision ? "bg-rose-500 border-rose-400 text-white animate-pulse" : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                }`}
                title="Dual Scan (Mix Screen & Cam)"
              >
                <Eye size={20} />
              </motion.button>
            )}
          </AnimatePresence>

          <button
            onClick={toggleListening}
            className={`
              group relative flex items-center gap-3 px-8 py-4 rounded-full font-medium tracking-wide transition-all duration-300 shadow-2xl
              ${
                isSessionActive
                  ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                  : "bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:scale-105"
              }
            `}
          >
            {isSessionActive ? (
              <>
                <MicOff size={20} />
                <span>End Session</span>
              </>
            ) : (
              <>
                <Mic size={20} className="group-hover:animate-bounce" />
                <span>Start Session</span>
              </>
            )}
          </button>
          
          {!isSessionActive && (
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-2xl"
              title="Type instead"
            >
              <Keyboard size={20} className="opacity-70" />
            </button>
          )}
        </div>
      </footer>

      <div className="hidden">
         <video ref={screenVideoRef} autoPlay playsInline muted />
         <video ref={cameraVideoRef} autoPlay playsInline muted />
      </div>
    </div>
  );
}
