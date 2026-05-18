import React, { useState, useEffect } from "react";
import { Lock, Unlock, Fingerprint, Eye, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LockScreenProps {
  isLocked: boolean;
  onUnlock: () => void;
  ownerName: string;
}

export default function LockScreen({ isLocked, onUnlock, ownerName }: LockScreenProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleUnlockRequest = () => {
    setIsVerifying(true);
    // Simulate RIYA checking face
    setTimeout(() => {
      setIsVerifying(false);
      onUnlock();
    }, 2000);
  };

  if (!isLocked) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-between p-12 overflow-hidden pointer-events-auto"
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-900/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[100px] rounded-full" />
      </div>

      {/* Time & Date */}
      <div className="z-10 flex flex-col items-center gap-2 mt-12">
        <h1 className="text-7xl font-bold tracking-tighter text-white/90">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </h1>
        <p className="text-lg font-medium text-white/40">
          {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Lock Icon / Verification Area */}
      <div className="z-10 flex flex-col items-center gap-6">
        <AnimatePresence mode="wait">
          {isVerifying ? (
            <motion.div
              key="verifying"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-2 border-violet-500/30 flex items-center justify-center">
                   <Eye size={40} className="text-violet-400 animate-pulse" />
                </div>
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-8px] border-t-2 border-violet-500 rounded-full"
                />
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-violet-400">Verifying Identity...</span>
            </motion.div>
          ) : (
            <motion.button
              key="locked"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={handleUnlockRequest}
              className="group flex flex-col items-center gap-6"
            >
              <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-active:scale-95 transition-all">
                <Lock size={32} className="text-white/60 group-hover:text-white transition-colors" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-medium text-white/40">Registered to</span>
                <span className="text-lg font-bold text-white tracking-wide">{ownerName}</span>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="z-10 flex flex-col items-center gap-8 mb-8 w-full max-w-xs">
        <div className="flex items-center gap-12 text-white/30">
          <button className="flex flex-col items-center gap-2 hover:text-white transition-colors">
            <Fingerprint size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">BioAuth</span>
          </button>
          <button className="flex flex-col items-center gap-2 hover:text-white transition-colors">
             <ShieldAlert size={24} />
             <span className="text-[10px] font-bold uppercase tracking-widest">Emergency</span>
          </button>
        </div>
        
        <div className="w-full h-1 bg-white/5 rounded-full relative overflow-hidden">
           <motion.div 
             animate={{ x: ["-100%", "100%"] }}
             transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
             className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"
           />
        </div>
        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/20">Swipe to reveal more</p>
      </div>
    </motion.div>
  );
}
