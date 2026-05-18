import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

type VisualizerState = "idle" | "listening" | "processing" | "speaking";

export type VisualizerMood = "default" | "sassy" | "annoyed" | "curious" | "happy" | "roasting";

interface VisualizerProps {
  state: VisualizerState;
  mood?: VisualizerMood;
  audioLevels?: { input: number; output: number };
}

export default function Visualizer({ state, mood = "default", audioLevels = { input: 0, output: 0 } }: VisualizerProps) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    if (state === "speaking" || state === "listening") {
      const interval = setInterval(() => {
        setParticles(prev => [
          ...prev.slice(-20),
          { id: Date.now(), x: Math.random() * 100 - 50, y: Math.random() * 100 - 50 }
        ]);
      }, 200);
      return () => clearInterval(interval);
    } else {
      setParticles([]);
    }
  }, [state]);

  const getRingAnimation = (index: number, reverse: boolean = false) => {
    const baseSpeed = state === "listening" ? 2 : state === "processing" ? 1 : state === "speaking" ? 1.5 : 20;
    
    let moodMultiplier = 1;
    if (mood === "sassy") moodMultiplier = 0.5;
    if (mood === "annoyed") moodMultiplier = 0.3;
    if (mood === "curious") moodMultiplier = 2;
    if (mood === "happy") moodMultiplier = 1.2;

    const duration = (baseSpeed + index * 1.5) * moodMultiplier;
    
    return {
      rotate: reverse ? [-360, 0] : [0, 360],
      scale: mood === "annoyed" ? [1, 1.05, 0.95, 1] : mood === "sassy" ? [1, 1.02, 1] : 1,
      transition: { 
        duration: duration, 
        repeat: Infinity, 
        ease: "linear"
      }
    };
  };

  const getPulseAnimation = () => {
    const inputVol = (audioLevels?.input || 0);
    const outputVol = (audioLevels?.output || 0);
    const volumeBoost = (inputVol + outputVol) * 2;
    const baseScale = 1 + volumeBoost;

    if (state === "speaking") {
      return {
        scale: [baseScale, baseScale * 1.1, baseScale],
        opacity: [0.8, 1, 0.8],
        transition: { duration: 0.1, ease: "linear" }
      };
    }
    if (state === "listening") {
      return {
        scale: [baseScale, baseScale * 1.05, baseScale],
        opacity: [0.7, 1, 0.7],
        transition: { duration: 0.1, ease: "linear" }
      };
    }
    if (state === "processing") {
      return {
        scale: [0.95, 1.05, 0.95],
        opacity: [0.5, 0.8, 0.5],
        transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
      };
    }
    return {
      scale: [1, 1.02, 1],
      opacity: [0.2, 0.4, 0.2],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
    };
  };

  const getTheme = () => {
    if (state === "processing") return { 
      color: "rgba(56, 189, 248, 1)", 
      glow: "shadow-sky-400/80", 
      border: "border-sky-400", 
      particle: "bg-sky-400",
      gradient: "from-sky-500/20 to-transparent"
    };
    
    switch (mood) {
      case "sassy": 
        return { color: "rgba(236, 72, 153, 1)", glow: "shadow-pink-500/80", border: "border-pink-500", particle: "bg-pink-400", gradient: "from-pink-500/20 to-transparent" };
      case "annoyed": 
        return { color: "rgba(239, 68, 68, 1)", glow: "shadow-red-500/80", border: "border-red-500", particle: "bg-red-400", gradient: "from-red-500/20 to-transparent" };
      case "curious": 
        return { color: "rgba(234, 179, 8, 1)", glow: "shadow-yellow-500/80", border: "border-yellow-500", particle: "bg-yellow-400", gradient: "from-yellow-500/20 to-transparent" };
      case "happy": 
        return { color: "rgba(34, 197, 94, 1)", glow: "shadow-green-500/80", border: "border-green-500", particle: "bg-green-400", gradient: "from-green-500/20 to-transparent" };
      case "roasting":
        return { color: "rgba(249, 115, 22, 1)", glow: "shadow-orange-500/80", border: "border-orange-500", particle: "bg-orange-500", gradient: "from-orange-500/20 to-transparent" };
      default: 
        return { color: "rgba(6, 182, 212, 1)", glow: "shadow-cyan-500/40", border: "border-cyan-500", particle: "bg-cyan-400", gradient: "from-cyan-500/20 to-transparent" };
    }
  };

  const theme = getTheme();

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      {/* Ambient Large Glow */}
      <motion.div
        animate={getPulseAnimation() as any}
        className={`absolute w-[150%] h-[150%] rounded-full blur-[150px] opacity-10 ${theme.glow}`}
        style={{ backgroundColor: theme.color }}
      />

      {/* Ripple Background on Speaking */}
      <AnimatePresence>
        {state === "speaking" && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            className={`absolute w-[80%] h-[80%] rounded-full border-2 ${theme.border} opacity-20`}
          />
        )}
      </AnimatePresence>

      {/* Floating Insight Particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x * 10, y: p.y * 10, opacity: 0, scale: 0 }}
          className={`absolute w-1.5 h-1.5 rounded-full ${theme.particle} blur-[0.5px]`}
        />
      ))}

      {/* Ornaments/Symbols (Indian Inspired Dots) */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[0, 90, 180, 270].map((deg) => (
          <motion.div
            key={deg}
            animate={{
              rotate: deg,
              scale: state === "listening" ? [1, 1.5, 1] : 1,
              opacity: state === "idle" ? 0.3 : 0.8
            }}
            className="absolute top-1/2 left-1/2"
            style={{ originX: "0px", originY: "0px", transform: `rotate(${deg}deg) translateY(-180px)` }}
          >
            <div className={`w-3 h-3 rounded-full ${theme.particle} shadow-lg`} />
          </motion.div>
        ))}
      </div>

      {/* Concentric Rings with different styles */}
      {[
        { size: "w-[120%] h-[120%]", rev: false, border: "border-dashed", op: "opacity-[0.05]" },
        { size: "w-[100%] h-[100%]", rev: true, border: "border-dotted", op: "opacity-[0.1]" },
        { size: "w-[80%] h-[80%]", rev: false, border: "border-[1px]", op: "opacity-[0.15]" },
        { size: "w-[60%] h-[60%]", rev: true, border: "border-[2px] border-t-transparent border-b-transparent", op: "opacity-[0.25]" },
        { size: "w-[45%] h-[45%]", rev: false, border: "border-[3px] border-dotted", op: "opacity-[0.4]" },
      ].map((ring, i) => (
        <motion.div
          key={i}
          animate={getRingAnimation(i, ring.rev) as any}
          className={`absolute ${ring.size} rounded-full ${ring.border} ${theme.border} ${ring.op}`}
        />
      ))}

      {/* The Core Orb */}
      <motion.div
        animate={getPulseAnimation() as any}
        className={`relative w-[28%] h-[28%] rounded-full border-[2px] ${theme.border} bg-black/40 backdrop-blur-2xl flex items-center justify-center overflow-hidden`}
        style={{ 
          boxShadow: `0 0 80px ${theme.color}44, inset 0 0 40px ${theme.color}66`,
        }}
      >
        {/* Internal Swirling Plasma */}
        <motion.div
          animate={{
            rotate: [0, 360],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className={`absolute inset-0 bg-gradient-to-tr ${theme.gradient} blur-xl`}
        />

        {/* Dynamic Emotional "Eye" or Dot */}
        <motion.div
          animate={{
            scaleY: mood === "annoyed" ? [1, 0.1, 1] : 1, // Blinking when annoyed
            scaleX: mood === "curious" ? 1.5 : 1,
            y: state === "listening" ? [0, -5, 5, 0] : 0,
          }}
          transition={{ duration: 0.15 }}
          className={`w-4 h-4 rounded-full ${theme.particle} z-20 shadow-[0_0_20px_white]`}
        />

        {/* Center Name */}
        <div className="absolute bottom-6 flex flex-col items-center">
            <motion.span 
              className="text-xs font-black tracking-[0.5em] text-white/50 uppercase"
              animate={{ opacity: state === "idle" ? 0.5 : 1 }}
            >
              System
            </motion.span>
            <motion.h1 
              className="text-3xl md:text-5xl font-black text-white tracking-widest"
              style={{ textShadow: `0 0 20px ${theme.color}` }}
            >
              RIYA
            </motion.h1>
         </div>

         {/* Grid Overlay inside Core */}
         <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `radial-gradient(${theme.color} 1px, transparent 1px)`, backgroundSize: '10px 10px' }} />
      </motion.div>

      {/* Processing Status Text (Only when processing) */}
      <AnimatePresence>
        {state === "processing" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`absolute bottom-[15%] text-xs font-mono tracking-widest ${theme.particle.replace('bg-', 'text-')} bg-black/50 px-4 py-1 rounded-full backdrop-blur-md`}
          >
            NEURAL SCANNING...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
