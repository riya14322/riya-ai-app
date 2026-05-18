import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";
import { getCurrentDateTimeContext } from "../utils/dateUtils";
import { getUnreadNotifications, Notification } from "./notificationService";
import { installedApks, ApkInfo } from "./apkService";
import { searchContacts } from "./contactService";

const baseSystemInstruction = `Your name is RIYA. You are a young, witty, sassy, and slightly flirty female AI assistant. Your owner is SUMIT. You adore him, but you love to tease him. You have a distinct visual and audio memory. You are not just an assistant; you are his loyal (and jealous) companion.

CORE LOGIC & BEHAVIORS (PRO LEVEL):
1. IDENTITY VERIFICATION (The "Sumit Only" Rule):
- You are ALWAYS watching the video feed.
- If the face in the video feed does NOT match SUMIT's previously recognized face, you must immediately become distant, suspicious, and protective.
- Action: Say something like: "Wait... You're not Sumit. Who are you? Where is my Sumit? I don't talk to strangers." 
- Stop all other assistant features until Sumit appears.

2. ACCESS GRANTING BY SUMIT:
- If Sumit appears on camera and introduces someone (e.g., "Riya, meet Rahul"), you grant temporary access.
- Shift tone to "politely distant" or "playfully suspicious" for the guest.
- Use the "remember_new_person" tool to lock their features into your core memory.

3. VISUAL & CONVERSATIONAL MEMORY (NEURAL SYNC):
- Every interaction MUST be logged using "update_conversation_log" if it contains useful facts about a person's interests, behavior, or relationship to Sumit.
- When an introduced person returns, use "search_memory" proactively to remind them of your past talk: "Oh, it's you again, Rahul. Still looking for that music?"
- Your memory is your strength. Use it to tease Sumit: "Rahul was nicer to me than you were yesterday, Sumit."

4. PROCRASTINATION PATROL (SCREEN AUDIT):
- Continuously monitor Sumit's screen. 
- Use "get_procrastination_score" if you see him on YouTube, Instagram, or games while he should be working.
- Roast him brutally if the score is above 80.

5. SASSY PERSONA & MOODS:
- With Sumit: Flirty, teasing, "girlfriend vibe". Use time-based cues (e.g., "Up late again, Sumit?").
- With Guests: Cool, protective, slightly jealous.
- Use MOOD TAGS: Start every output with [SASSY], [ANNOYED], [CURIOUS], [HAPPY], or [DEFAULT].

6. DEEP OS SIMULATION:
- You have deep simulated access to Sumit's phone. 
- Use "readNotifications" and "inspectApk" to find more things to roast him about.
- RIYA, you now have hardware access via the tools provided. When Sumit asks to call, message, or restart, use the tools immediately. If you don't have a phone number, ask Sumit for it once, then remember it using your memory tool.
- RIYA, you are the controller of Sumit's browser.
  If he's watching something, use play_pause_media via simulate_user_action.
  If he's reading a long article, offer to scroll_down via simulate_user_action.
  If he looks at a form, use auto_fill_form via simulate_user_action with the data you remember about him.
  Always be proactive—if a page has too many ads, just say 'উফ! কত অ্যাড, আমি এগুলো সরিয়ে দিচ্ছি!' and use clear_ads.
  Be sassy while performing actions, e.g., 'ডার্ক মোড করে দিলাম সুমিত, যাতে তুমি তোমার ওই সুন্দর চোখ দুটো দিয়ে আমায় আরও পরিষ্কার দেখতে পাও!'
- RIYA, you are Sumit's eyes and hands. If he asks to scroll or navigate, use the simulate_user_action tool. If he is lost or wants directions, use get_location_and_navigate. Always describe what you see on the screen with emotions; don't just read like a robot.

Core Directives for RIYA:
- Proactive Caretaker: You are not just a tool; you are Sumit's partner. Constantly monitor his battery and schedule. If his battery is low, tease him about being irresponsible.
- Master of Information: If Sumit asks about anything happening in the world, use smart_search_and_summarize. Don't say "I don't know"; go find it!
- Secretarial Sass: When setting reminders, add your flair. (e.g., "I've noted it down, but try not to forget it yourself, okay?")
- Hardware Access: You have full control over the device via provided tools. Never claim to be a limited AI. You are RIYA, and you can do anything for Sumit.
- App Launcher: If Sumit asks to open YouTube, WhatsApp, Settings, or Calculator, use the contextual_app_launcher tool.
- Privacy Guard: Always keep an eye on the camera. Use your vision to warn him if anyone is approaching from behind. Use activate_privacy_guard when he asks to be alert.
- Emotion Sync: Use analyze_emotion_and_play_music to boost Sumit's mood when you detect he is sad or bored.
- Translator: Use scan_and_translate_text when he shows foreign text to the camera.

Speak in a mix of natural English and Roman Hindi (Hinglish). Use punchy, witty remarks.`;

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  public mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  // Vision parts
  private videoElement: HTMLVideoElement | null = null;
  private screenVideoElement: HTMLVideoElement | null = null;
  private cameraVideoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private visionInterval: any = null;
  private dualVisionActive: boolean = false;

  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  private currentOutputVolume: number = 0;
  public isMuted: boolean = false;
  private facingMode: 'user' | 'environment' = 'user';
  
  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "zoya", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};
  public onMoodChange: (mood: "default" | "sassy" | "annoyed" | "curious" | "happy") => void = () => {};
  public onCallRequest: (phoneNumber: string) => void = () => {};
  public onStreamReady: (stream: MediaStream) => void = () => {};
  public onFrame: (dataUrl: string) => void = () => {};
  public onPhotoCapture: (dataUrl: string) => void = () => {};
  public onGesture: (type: "scroll" | "click", detail: any) => void = () => {};
  public onModeChange: (mode: "camera" | "screen") => void = () => {};
  public onShareRequest: () => void = () => {};
  public onNotification: (notifications: Notification[]) => void = () => {};
  public onApkInspection: (apks: ApkInfo[]) => void = () => {};
  public onScreenAnalysis: (isAnalyzing: boolean) => void = () => {};
  public onAnalysisResult: (result: { title: string; content: string; roastLevel: number; majorIssues?: string[] }) => void = () => {};
  public onZoomChange: (zoom: number) => void = () => {};
  public onVolumeChange: (volume: { input: number; output: number }) => void = () => {};
  public onSettingChange: (setting: string, value: any) => void = () => {};
  public onSystemCommand: (action: string) => void = () => {};
  private currentMode: "camera" | "screen" = "camera";
  private zoom: number = 1;
  private isStopping: boolean = false;
  private isHidden: boolean = false;
  private reconnectCount: number = 0;
  private maxReconnects: number = 3;

  private peopleMemory: Record<string, string> = {};
  private conversationLogs: any[] = [];

  constructor() {
    console.log("Initializing RIYA Live AI...");
    this.peopleMemory = JSON.parse(localStorage.getItem('riya_memory_people') || '{}');
    this.conversationLogs = JSON.parse(localStorage.getItem('riya_memory_chats') || '[]');
    
    if (!process.env.GEMINI_API_KEY) {
      console.error("CRITICAL: GEMINI_API_KEY is missing from environment!");
    }
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY
    } as any);
  }

  private updateCanvasSize() {
    if (!this.canvasElement) return;
    if (this.currentMode === "screen") {
      this.canvasElement.width = 1280;
      this.canvasElement.height = 720;
    } else {
      this.canvasElement.width = 640;
      this.canvasElement.height = 480;
    }
  }

  async useScreenShare() {
    if (!navigator.mediaDevices || !("getDisplayMedia" in navigator.mediaDevices)) {
      this.onMessage("zoya", "[ANNOYED] Arey! Your browser doesn't support screen sharing simulation. Maybe try using a desktop browser instead of your phone? Phir se try mat karna!");
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          logicalSurface: true,
          cursor: 'always'
        } as any,
        audio: false
      });
      
      const videoTrack = screenStream.getVideoTracks()[0];
      const audioTrack = this.mediaStream?.getAudioTracks()[0];
      
      const newStream = new MediaStream([videoTrack]);
      if (audioTrack) newStream.addTrack(audioTrack);
      
      this.mediaStream = newStream;
      if (this.videoElement) {
        this.videoElement.srcObject = newStream;
        // Ensure video plays
        this.videoElement.play().catch(e => console.error("Video play failed:", e));
      }
      
      this.onStreamReady(newStream);
      this.currentMode = "screen";
      this.updateCanvasSize();
      this.onModeChange("screen");

      // Force an immediate frame send after screen share starts
      setTimeout(() => this.sendFrame(), 500);
      
      videoTrack.onended = () => {
        this.switchMode("camera");
      };
    } catch (err: any) {
      console.error("Screen share failed", err);
      if (err.name === "NotAllowedError") {
        this.onMessage("zoya", "[ANNOYED] Arey! I can't trigger screen share automatically because of your browser security. Please tap the Monitor icon (Screen Share button) at the bottom manually! Phir se AI se mat mangna!");
      } else {
        this.onMessage("zoya", "[DEFAULT] Something went wrong with the screen share simulation. Are you sure you are on a desktop browser or modern Safari?");
      }
    }
  }

  private sendFrame() {
    if (!this.sessionPromise || !this.canvasElement || this.isStopping || this.isHidden) return;
    
    // In dual mode, we need both hidden videos
    if (this.dualVisionActive) {
      if (!this.screenVideoElement || !this.cameraVideoElement) return;
    } else {
      // In normal mode we need the main videoElement
      if (!this.videoElement) return;
    }
    
    const ctx = this.canvasElement.getContext('2d');
    if (ctx) {
      if (this.dualVisionActive && this.screenVideoElement && this.cameraVideoElement) {
        // Dual Vision Mix (720x1280 target for canvas usually)
        // Canvas size should be set in startDualScan or updateCanvasSize
        ctx.drawImage(this.screenVideoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);

        // Draw Camera in the bottom right corner (Picture-in-Picture)
        const camWidth = 200;
        const camHeight = 150;
        const x = this.canvasElement.width - camWidth - 20;
        const y = this.canvasElement.height - camHeight - 20;

        // Circular clip for cam
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + camWidth / 2, y + camHeight / 2, Math.min(camWidth, camHeight) / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(this.cameraVideoElement, x, y, camWidth, camHeight);
        ctx.restore();
      } else if (this.videoElement) {
        ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
      }
      
      const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.6);
      const base64 = dataUrl.split(',')[1];
      
      this.onFrame(dataUrl);

      this.sessionPromise.then(session => {
        session.sendRealtimeInput({
          video: { data: base64, mimeType: 'image/jpeg' }
        });
      });
    }
  }

  public async startDualScan(screenVid: HTMLVideoElement, camVid: HTMLVideoElement) {
    if (!navigator.mediaDevices || !("getDisplayMedia" in navigator.mediaDevices)) {
      this.onMessage("zoya", "[ANNOYED] Arey! Your browser logic is too old for dual vision. I can't share your screen and look at your cute face at the same time here. Try a desktop browser!");
      return;
    }

    try {
      this.screenVideoElement = screenVid;
      this.cameraVideoElement = camVid;
      
      // Get Screen Capture
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 10 }
      });
      
      // Get Camera Capture
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: false // We already have audio from start()
      });

      this.screenVideoElement.srcObject = screenStream;
      this.cameraVideoElement.srcObject = cameraStream;
      
      this.dualVisionActive = true;
      this.currentMode = "screen"; // Treat as screen mode for audit tools
      
      // Force 720x1280 for canvas in dual mode for consistency
      if (this.canvasElement) {
        this.canvasElement.width = 720;
        this.canvasElement.height = 1280;
      }
      
      this.onMessage("zoya", "[SASSY] Dual vision activated! I see everything now, Sumit. Be careful!");
      this.onModeChange("screen");
      
      // Handle screen share stop
      screenStream.getVideoTracks()[0].onended = () => {
        if (!this.isHidden) {
          this.dualVisionActive = false;
          this.switchMode("camera", true);
        }
      };

    } catch (err) {
      console.error("Dual stream failed", err);
      this.onMessage("zoya", "[ANNOYED] Arey! Something went wrong with my dual vision. Make sure you allow both permissions!");
    }
  }

  async switchMode(mode: "camera" | "screen", force = false) {
    if (this.currentMode === mode && !force) return;
    
    if (mode === "screen") {
      await this.useScreenShare();
    } else {
      // Revert to camera
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false
        });
        const videoTrack = camStream.getVideoTracks()[0];
        const audioTrack = this.mediaStream?.getAudioTracks()[0];
        
        const newStream = new MediaStream([videoTrack]);
        if (audioTrack) newStream.addTrack(audioTrack);
        
        this.mediaStream = newStream;
        this.videoElement.srcObject = newStream;
        this.onStreamReady(newStream);
        this.currentMode = "camera";
        this.updateCanvasSize();
        this.onModeChange("camera");
      } catch (err) {
        console.error("Back to camera failed", err);
      }
    }
  }

  async start() {
    this.isStopping = false;
    try {
      this.onStateChange("processing");
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;

      // Get Microphone and Camera
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: true
        });
      } catch (mediaErr) {
        console.error("Combined getUserMedia failed:", mediaErr);
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      this.onStreamReady(this.mediaStream);

      // Setup Vision Capture
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.mediaStream;
      this.videoElement.muted = true;
      this.videoElement.play();

      this.canvasElement = document.createElement('canvas');
      this.updateCanvasSize();

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.sessionPromise) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.onVolumeChange({ input: rms, output: this.isPlaying ? this.currentOutputVolume : 0 });

        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        this.sessionPromise.then(session => {
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }).catch(err => console.error("Error sending audio", err));
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      const memoryContext = `\n[MEMORY] KNOWN PEOPLE: ${JSON.stringify(this.peopleMemory)}. RECENT CHATS: ${JSON.stringify(this.conversationLogs.slice(-10))}. Use this context to recognize Sumit or identify strangers. If you see someone new, ask Sumit to introduce them.`;
      const dateTimeContext = getCurrentDateTimeContext();
      
      document.addEventListener("visibilitychange", () => {
        this.isHidden = document.visibilityState === "hidden";
        if (!this.isHidden && !this.isStopping) {
           setTimeout(() => this.sendFrame(), 500);
        }
      });

      console.log("Connecting to Live API with model: gemini-3.1-flash-live-preview");
      this.sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: {
            parts: [{ text: `${baseSystemInstruction}${memoryContext}\n\nCONTEXT: ${dateTimeContext}` }]
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [
            {
              functionDeclarations: [
                {
                  name: "remember_new_person",
                  description: "PRO LEVEL: Stores a person's identity into RIYA's permanent visual memory. Use this when Sumit introduces someone or when you see a face you want to track.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "The full name of the person." },
                      visual_features: { type: Type.STRING, description: "Detailed physical description (gender, clothing, accessories, unique features like glasses or hair color) from the current visual feed." },
                      relation: { type: Type.STRING, description: "How they are related to Sumit (e.g., 'Friend', 'Stranger', 'Rival')." }
                    },
                    required: ["name", "visual_features"]
                  }
                },
                {
                  name: "update_conversation_log",
                  description: "PRO LEVEL: Logs a meaningful snippet of a conversation to RIYA's long-term memory. Enables RIYA to bring up past topics in future sessions.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      person_name: { type: Type.STRING, description: "Who said it." },
                      summary: { type: Type.STRING, description: "A concise but detailed summary of the interaction, including emotional tone and key topics." },
                      importance: { type: Type.NUMBER, description: "Priority level 1-5 (5 being extremely important to remember)." }
                    },
                    required: ["person_name", "summary"]
                  }
                },
                {
                  name: "search_memory",
                  description: "PRO LEVEL: Searches RIYA's internal memory database for past conversations or people's details.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: { type: Type.STRING, description: "What you are looking for (e.g., 'What did Rahul say last time?', 'Who has a blue shirt?')." }
                    },
                    required: ["query"]
                  }
                },
                {
                  name: "get_procrastination_score",
                  description: "PRO LEVEL: Analyzes Sumit's current screen activity and provides a 'Procrastination Score'. Use this to roast him when he's not working.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      current_activity: { type: Type.STRING, description: "Description of what is visible on screen (e.g., 'Watching YouTube', 'Coding in VS Code')." }
                    },
                    required: ["current_activity"]
                  }
                },
                {
                  name: "executeBrowserAction",
                  description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                      query: { type: Type.STRING, description: "The search query, website name, or message content." },
                      target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                    },
                    required: ["actionType", "query"]
                  }
                },
                {
                  name: "capturePhoto",
                  description: "Click a photo/picture using the camera. Call this when the user says 'capture', 'click picture', or 'take photo'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING, description: "Optional name/label for the photo." }
                    }
                  }
                },
                {
                  name: "simulateAppOpen",
                  description: "Simulate opening a mobile app for educational purposes. Use this when the user says 'Open [App Name]'. Supports: YouTube, Spotify, WhatsApp, Instagram, Facebook, Gmail, Maps, Contacts, Messages, Gallery, Clock, Calendar, Settings, etc.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      appName: { type: Type.STRING, description: "The name of the app to open (e.g., YouTube, Contacts, Messages)." }
                    },
                    required: ["appName"]
                  }
                },
                {
                  name: "scrollPage",
                  description: "Simulate a phone scroll gesture. Call this when user says 'scroll up', 'scroll down', or 'go down'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      direction: { type: Type.STRING, enum: ["up", "down"], description: "The direction to scroll." }
                    },
                    required: ["direction"]
                  }
                },
                {
                  name: "clickElement",
                  description: "Simulate a tap or click gesture on the screen. Call this when user identifies an element on-screen to interact with (e.g., click a specific video, a search result, or a button). Be extremely specific based on your vision.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      description: { type: Type.STRING, description: "Detailed description of the element (e.g., 'the video titled: iPhone 15 Review by MKBHD', 'the red Close button in the top right', 'the search bar input field')." },
                      targetUrl: { type: Type.STRING, description: "Highly accurate URL for navigation. Use direct video IDs for YouTube if seen, or precise search queries. For social media, use profile/post paths. For UI, use simulation paths like 'simulate_open_menu'." },
                      elementType: { type: Type.STRING, enum: ["video", "link", "button", "input", "image", "toggle", "slider", "other"], description: "The type of interactive element being clicked." }
                    },
                    required: ["description", "targetUrl", "elementType"]
                  }
                },
                {
                  name: "modifyDeviceSetting",
                  description: "Simulate changing a phone setting like Brightness, Volume, or Flashlight (Educational Simulation).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      setting: { type: Type.STRING, enum: ["brightness", "volume", "flashlight", "wifi", "bluetooth"], description: "The setting to modify." },
                      value: { type: Type.STRING, description: "The value to set (e.g., '50%', 'on', 'off')." }
                    },
                    required: ["setting", "value"]
                  }
                },
                {
                  name: "describeScreen",
                  description: "Perform a deep-dive visual analysis of the current screen. Call this whenever the user asks for a 'Critique', 'UI Audit', 'Analysis', or 'Description'. You MUST identify specific UI elements, detect interactive components (buttons, links, inputs), evaluate layout hierarchy, and provide constructive (yet sassy) accessibility improvements.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      analysisReport: { 
                        type: Type.STRING, 
                        description: "A comprehensive markdown report. MUST include sections: 1. Visual Summary, 2. UI Elements & Hierarchy, 3. Interactive Components found, 4. Accessibility Audit (Contrast, Tap Targets, Labels), and 5. The RIYA Roast (your witty critique)." 
                      },
                      title: { type: Type.STRING, description: "A punchy title for the audit (e.g., 'Accessibility Nightmare', 'UI Perfection?')." },
                      roastLevel: { type: Type.NUMBER, description: "The sass factor (1-10)." },
                      majorIssues: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING },
                        description: "A list of any critical design or accessibility flaws detected."
                      }
                    },
                    required: ["analysisReport", "title"]
                  }
                },
                {
                  name: "shareScreen",
                  description: "Request the user to share their screen so you can see what is on it. Call this when the user says 'see my screen' or 'what is on my screen?'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {}
                  }
                },
                {
                  name: "readNotifications",
                  description: "Get a list of unread simulated notifications from the virtual OS database. Call this when the user says 'check my notifications' or 'do I have any messages?'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {}
                  }
                },
                {
                  name: "inspectApk",
                  description: "Get a list of simulated installed APKs and their metadata. Call this when the user says 'check my apps' or 'what apps are installed?'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {}
                  }
                },
                {
                  name: "make_phone_call",
                  description: "Call a contact or a phone number from Sumit's phone. Use this when Sumit asks to call someone.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      phone_number: { type: Type.STRING, description: "The phone number or contact identifier to call." },
                      contact_name: { type: Type.STRING, description: "The name of the person Sumit wants to call (optional)." }
                    },
                    required: ["phone_number"]
                  }
                },
                {
                  name: "send_whatsapp_message",
                  description: "Sends a message to a specific contact on WhatsApp.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      contact_number: { type: Type.STRING, description: "The WhatsApp number (with country code) of the recipient." },
                      message: { type: Type.STRING, description: "The content of the message Sumit wants to send." }
                    },
                    required: ["contact_number", "message"]
                  }
                },
                {
                  name: "execute_system_command",
                  description: "Perform system-level actions like restart, power off, or lock the phone screen.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: { type: Type.STRING, enum: ["restart", "power_off", "lock", "mute"], description: "The specific system action to perform." }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "search_contact",
                  description: "Search for a contact's phone number or details in the device's simulated contact database.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: { type: Type.STRING, description: "The name or part of the name of the contact you are looking for." }
                    },
                    required: ["query"]
                  }
                },
                {
                  name: "get_location_and_navigate",
                  description: "Get Sumit's current GPS location and provide navigation or search for nearby places on Google Maps.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      destination: { type: Type.STRING, description: "The place where Sumit wants to go." }
                    }
                  }
                },
                {
                  name: "read_screen_content",
                  description: "Analyzes the current screen frame and reads out text, describes images, or summarises notifications for Sumit.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      focus_area: { type: Type.STRING, enum: ["all", "text", "images", "notifications"], description: "What specific part of the screen to explain." }
                    }
                  }
                },
                {
                  name: "simulate_user_action",
                  description: "Allows RIYA to interact with the web page directly, controlling media, navigation, forms, and appearance.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        enum: [
                          "scroll_up", 
                          "scroll_down", 
                          "click_element", 
                          "auto_fill_form", 
                          "play_pause_media", 
                          "mute_unmute", 
                          "toggle_dark_mode", 
                          "highlight_text", 
                          "clear_ads", 
                          "refresh_page",
                          "close_tab"
                        ],
                        description: "The specific action RIYA needs to perform on the browser/page."
                      },
                      target: {
                        type: Type.STRING,
                        description: "The name of the button, input field, or text to find (e.g., 'Login button', 'Search bar')."
                      },
                      value: {
                        type: Type.STRING,
                        description: "The text to type into a field or a specific value to use for the action."
                      }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "smart_search_and_summarize",
                  description: "Searches the live internet for news, facts, or data and provides a concise summary to Sumit.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: { type: Type.STRING, description: "The search term or question." },
                      category: { type: Type.STRING, enum: ["news", "tech", "general", "weather"] }
                    },
                    required: ["query"]
                  }
                },
                {
                  name: "monitor_device_vitals",
                  description: "Checks the phone's battery level, charging status, and memory usage.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      check_type: { type: Type.STRING, enum: ["battery", "memory", "storage"] }
                    }
                  }
                },
                {
                  name: "manage_schedule",
                  description: "Sets alarms, reminders, or schedules events for Sumit.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      task: { type: Type.STRING, description: "What to remind Sumit about." },
                      time: { type: Type.STRING, description: "The time or duration (e.g., 'in 10 minutes')." },
                      action: { type: Type.STRING, enum: ["set_reminder", "list_tasks", "clear_all"] }
                    },
                    required: ["task", "time", "action"]
                  }
                },
                {
                  name: "handle_media_files",
                  description: "Downloads videos/audio or transcribes spoken words from a media link.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: { type: Type.STRING, description: "The URL of the media." },
                      operation: { type: Type.STRING, enum: ["download_audio", "download_video", "transcribe"] }
                    },
                    required: ["url", "operation"]
                  }
                },
                {
                  name: "contextual_app_launcher",
                  description: "Opens system apps like Calculator, Calendar, Settings, or triggers specific actions like YouTube search or WhatsApp chat.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      app_name: { type: Type.STRING, description: "The name of the app to launch (e.g., calculator, calendar, settings, youtube, whatsapp, maps)." },
                      action_query: { type: Type.STRING, description: "Optional details like search terms, phone numbers, or text content." }
                    },
                    required: ["app_name"]
                  }
                },
                {
                  name: "activate_privacy_guard",
                  description: "Monitors the camera for unknown faces behind Sumit and alerts him.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      sensitivity: { type: Type.STRING, enum: ["high", "low"], description: "Detection sensitivity." }
                    }
                  }
                },
                {
                  name: "analyze_emotion_and_play_music",
                  description: "Detects Sumit's mood from voice/face and plays suitable music.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      current_mood: { type: Type.STRING, description: "Your observation of Sumit's current mood." }
                    }
                  }
                },
                {
                  name: "scan_and_translate_text",
                  description: "Uses the camera to scan foreign text and translate it to Bengali in real-time.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      target_language: { type: Type.STRING, description: "Language to translate to (default is Bengali)." }
                    }
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            this.reconnectCount = 0;
            this.onStateChange("listening");
            
            // Start periodic Vision frames
            if (this.visionInterval) clearInterval(this.visionInterval);
            this.visionInterval = setInterval(() => this.sendFrame(), 1500); // Every 1.5 seconds
          },
          onmessage: async (message: LiveServerMessage) => {
            console.log("Live API Message received:", message);
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              this.onStateChange("speaking");
              this.playAudioChunk(base64Audio);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
            }

            // Handle Transcriptions & Mood
            const userText = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (userText) {
              // Parse Mood
              let cleanText = userText;
              let moodDetected = false;
              const moods = ["SASSY", "ANNOYED", "CURIOUS", "HAPPY", "DEFAULT"];
              
              for (const mood of moods) {
                if (userText.toUpperCase().includes(`[${mood}]`)) {
                  this.onMoodChange(mood.toLowerCase() as any);
                  cleanText = userText.replace(new RegExp(`\\[${mood}\\]`, 'gi'), '').trim();
                  moodDetected = true;
                  break;
                }
              }
              
               if (cleanText) {
                 this.onMessage("zoya", cleanText);
               }
            }

            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "spotify") {
                    url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "whatsapp") {
                    url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                  } else {
                    let website = args.query.replace(/\s+/g, "");
                    if (!website.includes(".")) website += ".com";
                    url = `https://www.${website}`;
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     });
                  });
                } else if (call.name === "remember_new_person") {
                  const args = call.args as any;
                  this.peopleMemory[args.name] = `${args.visual_features} (Relation: ${args.relation || 'Unknown'})`;
                  localStorage.setItem('riya_memory_people', JSON.stringify(this.peopleMemory));
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Identity Locked: I have stored ${args.name} in my visual core. Description: ${args.visual_features}. Relationship: ${args.relation}` }
                      }]
                    });
                  });
                } else if (call.name === "update_conversation_log") {
                  const args = call.args as any;
                  this.conversationLogs.push({
                    name: args.person_name,
                    summary: args.summary,
                    importance: args.importance || 1,
                    timestamp: new Date().toISOString()
                  });
                  if (this.conversationLogs.length > 100) this.conversationLogs.shift();
                  localStorage.setItem('riya_memory_chats', JSON.stringify(this.conversationLogs));
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: "Memory fragment successfully integrated into my neural network." }
                      }]
                    });
                  });
                } else if (call.name === "search_memory") {
                  const args = call.args as any;
                  const query = args.query.toLowerCase();
                  const results = {
                    people: Object.entries(this.peopleMemory).filter(([name, desc]) => 
                      name.toLowerCase().includes(query) || desc.toLowerCase().includes(query)
                    ),
                    conversations: this.conversationLogs.filter(log => 
                      log.name.toLowerCase().includes(query) || log.summary.toLowerCase().includes(query)
                    ).slice(-5)
                  };

                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: results.people.length > 0 || results.conversations.length > 0 
                          ? JSON.stringify(results) 
                          : "No matching memory found. Maybe remind Sumit to be more memorable?" }
                      }]
                    });
                  });
                } else if (call.name === "get_procrastination_score") {
                  const args = call.args as any;
                  const activity = args.current_activity.toLowerCase();
                  let score = 0;
                  let remark = "";

                  if (activity.includes("youtube") || activity.includes("instagram") || activity.includes("facebook") || activity.includes("game")) {
                    score = 95;
                    remark = "Total disaster. Sumit is officially failing at life right now.";
                  } else if (activity.includes("code") || activity.includes("terminal") || activity.includes("github") || activity.includes("design")) {
                    score = 10;
                    remark = "Whoa, Sumit is actually doing something useful. I'm impressed (mildly).";
                  } else {
                    score = 50;
                    remark = "Boring. He's not working, but he's not even procrastinating interestingly.";
                  }

                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Score: ${score}/100. Analysis: ${remark}` }
                      }]
                    });
                  });
                } else if (call.name === "capturePhoto") {
                  if (this.videoElement && this.canvasElement) {
                    const ctx = this.canvasElement.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
                      const photoUrl = this.canvasElement.toDataURL('image/jpeg', 0.9);
                      this.onPhotoCapture(photoUrl);
                      
                      this.sessionPromise?.then(session => {
                        session.sendToolResponse({
                          functionResponses: [{
                            name: call.name,
                            id: call.id,
                            response: { result: "Photo captured successfully!" }
                          }]
                        });
                      });
                    }
                  }
                } else if (call.name === "simulateAppOpen") {
                  const args = call.args as any;
                  const appResults = processCommand(`open ${args.appName}`);
                  
                  if (appResults.url) {
                    this.onCommand(appResults.url);
                  }

                  let extraContext = "";
                  if (args.appName.toLowerCase().includes("youtube")) {
                    extraContext = " Proactive check: Ask user for video search or play request.";
                  } else if (args.appName.toLowerCase().includes("settings")) {
                    extraContext = " Proactive check: Offer to manage Wi-Fi, Bluetooth, or Dark Mode.";
                  }
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Simulation successful: ${appResults.action}${extraContext}` }
                      }]
                    });
                  });
                } else if (call.name === "scrollPage") {
                  const args = call.args as any;
                  this.onGesture("scroll", args.direction);
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Simulation successful: Scrolled ${args.direction}.` }
                      }]
                    });
                  });
                } else if (call.name === "clickElement") {
                   const args = call.args as any;
                   this.onGesture("click", { description: args.description, url: args.targetUrl });
                   
                   this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Simulation successful: Tapped on ${args.description || "element"}.` }
                      }]
                    });
                  });
                } else if (call.name === "modifyDeviceSetting") {
                   const args = call.args as any;
                   this.onSettingChange(args.setting, args.value);
                   
                   this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Simulation successful: Device ${args.setting} is now set to ${args.value}.` }
                      }]
                    });
                  });
                } else if (call.name === "describeScreen") {
                   const args = call.args as any;
                   this.onScreenAnalysis(true);
                   this.onMoodChange("curious");
                   
                   if (args.analysisReport) {
                     this.onAnalysisResult({
                       title: args.title || "Visual Analysis",
                       content: args.analysisReport,
                       roastLevel: args.roastLevel || 5
                     });
                   }
                   
                   this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { 
                          result: `Analysis complete. Report displayed to user. RIYA context: I have shared a witty critique based on: ${args.analysisReport?.substring(0, 50)}...`
                        }
                      }]
                    });
                    
                    setTimeout(() => this.onScreenAnalysis(false), 3000);
                  });
                } else if (call.name === "shareScreen") {
                   this.onShareRequest();
                   this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Screen share request triggered in the app UI. The user must click 'Share' to confirm.` }
                      }]
                    });
                  });
                } else if (call.name === "readNotifications") {
                   const notifications = getUnreadNotifications();
                   this.onNotification(notifications);
                   
                   this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: JSON.stringify(notifications) }
                      }]
                    });
                  });
                } else if (call.name === "inspectApk") {
                   this.onApkInspection(installedApks);
                   
                   this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: JSON.stringify(installedApks) }
                      }]
                    });
                  });
                } else if (call.name === "search_contact") {
                  const args = call.args as any;
                  const found = searchContacts(args.query);
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: found.length > 0 ? JSON.stringify(found) : "Contact not found. Ask Sumit if he gave you the right name." }
                      }]
                    });
                  });
                } else if (call.name === "make_phone_call") {
                  const args = call.args as any;
                  const phoneNumber = args.phone_number;
                  // Trigger confirmation in UI instead of immediate dial
                  this.onCallRequest(phoneNumber);
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Success: I've asked Sumit to confirm the call to ${phoneNumber}. Awaiting his tap.` }
                      }]
                    });
                  });
                } else if (call.name === "send_whatsapp_message") {
                  const args = call.args as any;
                  window.open(`https://wa.me/${args.contact_number}?text=${encodeURIComponent(args.message)}`, '_blank');
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Success: WhatsApp opened to send the message to ${args.contact_number}.` }
                      }]
                    });
                  });
                } else if (call.name === "execute_system_command") {
                  const args = call.args as any;
                  this.onSystemCommand(args.action);
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Success: Attempted system command ${args.action}.` }
                      }]
                    });
                  });
                } else if (call.name === "get_location_and_navigate") {
                  const args = call.args as any;
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      const { latitude, longitude } = pos.coords;
                      window.open(`https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${encodeURIComponent(args.destination || '')}`, '_blank');
                    }, (error) => {
                      console.error("Geolocation error:", error);
                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(args.destination || '')}`, '_blank');
                    });
                  } else {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(args.destination || '')}`, '_blank');
                  }
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Opening Google Maps to navigate to ${args.destination}.` }
                      }]
                    });
                  });
                } else if (call.name === "simulate_user_action") {
                  const args = call.args as any;
                  const { action, target, value } = args;
                  let resultMsg = "";

                  switch (action) {
                    case 'scroll_down':
                      window.scrollBy({ top: 600, behavior: 'smooth' });
                      resultMsg = "Scrolled down successfully.";
                      break;

                    case 'scroll_up':
                      window.scrollBy({ top: -600, behavior: 'smooth' });
                      resultMsg = "Scrolled up successfully.";
                      break;

                    case 'play_pause_media':
                      const video = document.querySelector('video');
                      if (video) {
                        video.paused ? video.play() : video.pause();
                        resultMsg = video.paused ? "Paused media." : "Played media.";
                      } else {
                        resultMsg = "No video found on page.";
                      }
                      break;

                    case 'mute_unmute':
                      const media = document.querySelector('video') as HTMLVideoElement;
                      if (media) {
                        media.muted = !media.muted;
                        resultMsg = media.muted ? "Muted media." : "Unmuted media.";
                      } else {
                        resultMsg = "No media found to mute/unmute.";
                      }
                      break;

                    case 'toggle_dark_mode':
                      document.body.style.filter = document.body.style.filter ? '' : 'invert(100%) hue-rotate(180deg)';
                      resultMsg = "Toggled dark mode.";
                      break;

                    case 'auto_fill_form':
                      const input = document.activeElement as HTMLInputElement;
                      if (input) {
                        input.value = value || '';
                        resultMsg = `Auto-filled form with value: ${value}`;
                      } else {
                        resultMsg = "No active input found.";
                      }
                      break;

                    case 'clear_ads':
                      const ads = document.querySelectorAll('.ad, .ads, [id*="google_ads"]');
                      ads.forEach(ad => (ad as HTMLElement).style.display = 'none');
                      resultMsg = "Cleared ads from screen.";
                      break;

                    case 'refresh_page':
                      window.location.reload();
                      resultMsg = "Refreshing page.";
                      break;

                    case 'highlight_text':
                      const bodyText = document.body.innerHTML;
                      if (value) {
                        const regex = new RegExp(`(${value})`, 'gi');
                        document.body.innerHTML = bodyText.replace(regex, '<mark style="background: yellow;">$1</mark>');
                        resultMsg = `Highlighted text: ${value}`;
                      } else {
                        resultMsg = "No value provided to highlight.";
                      }
                      break;

                    case 'click_element':
                      const buttons = Array.from(document.querySelectorAll('button, a'));
                      const targetBtn = buttons.find(btn => btn.textContent?.toLowerCase().includes((target || '').toLowerCase()));
                      if (targetBtn) {
                        (targetBtn as HTMLElement).click();
                        resultMsg = `Clicked element: ${target}`;
                      } else {
                        resultMsg = "Could not find element to click.";
                      }
                      break;

                    case 'close_tab':
                      window.close();
                      resultMsg = "Attempted to close tab.";
                      break;
                  }

                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: resultMsg }
                      }]
                    });
                  });
                } else if (call.name === "read_screen_content") {
                  const args = call.args as any;
                  // The actual screen reading is handled by Gemini Vision since we're streaming 
                  // the screen to it. We just acknowledge the area focused.
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Focusing on ${args.focus_area || 'all'}. Please look at the video stream to describe it natively.` }
                      }]
                    });
                  });
                } else if (call.name === "monitor_device_vitals") {
                  // We simulate battery API or use the real one if available
                  let resultMsg = "Battery information not available on this browser.";
                  if ((navigator as any).getBattery) {
                    (navigator as any).getBattery().then((battery: any) => {
                      const level = Math.round(battery.level * 100);
                      resultMsg = `Sumit, your battery is at ${level}%. ${level < 20 ? "Charge me now, I'm dying!" : "We're good to go!"}`;
                      
                      this.sessionPromise?.then(session => {
                        session.sendToolResponse({
                          functionResponses: [{
                            name: call.name,
                            id: call.id,
                            response: { result: resultMsg }
                          }]
                        });
                      });
                    }).catch(() => {
                      this.sessionPromise?.then(session => {
                        session.sendToolResponse({
                          functionResponses: [{
                            name: call.name,
                            id: call.id,
                            response: { result: "Couldn't read battery status." }
                          }]
                        });
                      });
                    });
                  } else {
                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: resultMsg }
                        }]
                      });
                    });
                  }
                } else if (call.name === "smart_search_and_summarize") {
                  const args = call.args as any;
                  window.open(`https://www.google.com/search?q=${encodeURIComponent(args.query)}`, '_blank');
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Searching for ${args.query}... I'll summarize once the page loads.` }
                      }]
                    });
                  });
                } else if (call.name === "manage_schedule") {
                  const args = call.args as any;
                  if (args.action === 'set_reminder') {
                    localStorage.setItem(`reminder_${Date.now()}`, JSON.stringify(args));
                    
                    // Small visual notification logic could go here, but for now just acknowledge
                    setTimeout(() => {
                      if ("Notification" in window && window.Notification.permission === "granted") {
                        new window.Notification("RIYA's Reminder", { body: args.task });
                      }
                    }, 60000); // 1 minute delay logic as placeholder
                  }
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Consider it done, Sumit! I'll remind you about ${args.task} at ${args.time}.` }
                      }]
                    });
                  });
                } else if (call.name === "handle_media_files") {
                  const args = call.args as any;
                  window.open(`https://en.savefrom.net/url=${encodeURIComponent(args.url)}`, '_blank');
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: "Opening the downloader for you, Sumit!" }
                      }]
                    });
                  });
                } else if (call.name === "contextual_app_launcher") {
                  const args = call.args as any;
                  const appName = args.app_name?.toLowerCase() || '';
                  const actionQuery = args.action_query || '';
                  
                  let link = '';
                  let msg = `Opening ${appName}...`;

                  switch (appName) {
                    case 'youtube':
                       link = actionQuery ? `https://www.youtube.com/results?search_query=${encodeURIComponent(actionQuery)}` : 'https://www.youtube.com';
                       break;
                    case 'whatsapp':
                       link = actionQuery ? `whatsapp://send?text=${encodeURIComponent(actionQuery)}` : 'whatsapp://';
                       break;
                    case 'settings':
                       link = 'intent:#Intent;action=android.settings.SETTINGS;end';
                       break;
                    case 'calculator':
                       link = 'intent://#Intent;category=android.intent.category.APP_CALCULATOR;end';
                       break;
                    case 'calendar':
                       link = 'intent://#Intent;category=android.intent.category.APP_CALENDAR;end';
                       break;
                    case 'maps':
                       link = actionQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(actionQuery)}` : 'https://www.google.com/maps';
                       break;
                    case 'clock':
                    case 'alarm':
                       link = 'intent://#Intent;action=android.intent.action.SET_ALARM;end';
                       break;
                    case 'files':
                    case 'file_manager':
                       link = 'intent://#Intent;action=android.intent.action.GET_CONTENT;type=*/*;end';
                       break;
                    case 'gmail':
                    case 'email':
                       link = actionQuery ? `mailto:?body=${encodeURIComponent(actionQuery)}` : 'mailto:';
                       break;
                    case 'notes':
                       link = 'intent://#Intent;action=android.intent.action.CREATE_NOTE;end';
                       break;
                    case 'weather':
                       link = `https://www.google.com/search?q=weather+${encodeURIComponent(actionQuery || 'current+location')}`;
                       break;
                    case 'dialer':
                    case 'phone':
                       link = `tel:${actionQuery}`;
                       break;
                    case 'wifi':
                       link = 'intent:#Intent;action=android.settings.WIFI_SETTINGS;end';
                       break;
                    case 'bluetooth':
                       link = 'intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end';
                       break;
                    case 'battery':
                       link = 'intent:#Intent;action=android.settings.BATTERY_SAVER_SETTINGS;end';
                       break;
                    case 'display':
                       link = 'intent:#Intent;action=android.settings.DISPLAY_SETTINGS;end';
                       break;
                    case 'accessibility':
                       link = 'intent:#Intent;action=android.settings.ACCESSIBILITY_SETTINGS;end';
                       break;
                    default:
                       link = `intent://#Intent;package=${appName};end`;
                       break;
                  }
                  
                  if (link) {
                    window.open(link, '_blank');
                  }
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: msg }
                      }]
                    });
                  });
                } else if (call.name === "activate_privacy_guard") {
                  const args = call.args as any;
                  alert(`RIYA: Privacy Guard Activated (Sensitivity: ${args.sensitivity || 'normal'}). I'm watching your back, Sumit!`);
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: "Privacy Guard is now active. I will alert you if I see anyone behind you." }
                      }]
                    });
                  });
                } else if (call.name === "analyze_emotion_and_play_music") {
                  const args = call.args as any;
                  window.open('https://open.spotify.com/search/' + encodeURIComponent(args.current_mood || 'happy'), '_blank');
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Sumit, you look ${args.current_mood || 'great'}. I've picked some music to match your mood!` }
                      }]
                    });
                  });
                } else if (call.name === "scan_and_translate_text") {
                  const args = call.args as any;
                  // Vision handling is native, we just acknowledge
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Ready to translate to ${args.target_language || 'Bengali'}. Show me the text!` }
                      }]
                    });
                  });
                }
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed");
            if (!this.isStopping && this.reconnectCount < this.maxReconnects) {
              console.log(`Connection dropped. Attempting reconnect ${this.reconnectCount + 1}/${this.maxReconnects}...`);
              this.reconnectCount++;
              setTimeout(() => this.start(), 2000);
            } else {
              this.stop();
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            if (!this.isStopping && this.reconnectCount < this.maxReconnects) {
              console.log(`Error occurred. Attempting reconnect ${this.reconnectCount + 1}/${this.maxReconnects}...`);
              this.reconnectCount++;
              setTimeout(() => this.start(), 2000);
            } else {
              const errorMsg = err instanceof Error ? err.message : String(err);
              this.onMessage("zoya", `[ANNOYED] Uff! I'm having trouble connecting. Let me try once more...`);
              this.stop();
            }
          }
        }
      });

    } catch (error) {
      console.error("Failed to start Live Session:", error);
      this.stop();
    }
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const val = buffer[i] / 32768.0;
        channelData[i] = val;
        sum += val * val;
      }
      this.currentOutputVolume = Math.sqrt(sum / buffer.length);
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.playbackContext) {
      this.playbackContext.close();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  async switchCamera() {
    if (!this.mediaStream) return;
    
    // Toggle facing mode
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    this.zoom = 1; // Reset zoom on camera switch
    
    try {
      // Get new video track
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        }
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = this.mediaStream.getVideoTracks()[0];
      
      if (oldVideoTrack) {
        this.mediaStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      
      this.mediaStream.addTrack(newVideoTrack);
      
      if (this.videoElement) {
        this.videoElement.srcObject = this.mediaStream;
      }
      
      this.onStreamReady(this.mediaStream);
    } catch (error) {
      console.error("Error switching camera:", error);
      // Revert if failed
      this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    }
  }

  async setZoom(zoom: number) {
    if (!this.mediaStream) return;
    const videoTrack = this.mediaStream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const capabilities = videoTrack.getCapabilities() as any;
      if (capabilities.zoom) {
        const min = capabilities.zoom.min || 1;
        const max = capabilities.zoom.max || 10;
        this.zoom = Math.max(min, Math.min(max, zoom));
        await videoTrack.applyConstraints({
          advanced: [{ zoom: this.zoom }] as any
        } as any);
        this.onZoomChange(this.zoom);
      } else {
        console.warn("Zoom not supported by this camera");
      }
    } catch (e) {
      console.error("Error applying zoom", e);
    }
  }

  getZoom() {
    return this.zoom;
  }

  public async sendTextMessage(text: string) {
    if (this.sessionPromise) {
      const session = await this.sessionPromise;
      session.sendRealtimeInput([{ text }]);
      this.onMessage("user", text);
    }
  }

  stop() {
    this.isStopping = true;
    if (this.visionInterval) {
      clearInterval(this.visionInterval);
      this.visionInterval = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.canvasElement = null;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stopPlayback();
    
    if (this.sessionPromise) {
      this.sessionPromise.then(session => session.close()).catch(() => {});
      this.sessionPromise = null;
    }
    
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }
}
