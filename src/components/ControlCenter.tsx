import React from "react";
import { 
  Wifi, 
  Bluetooth, 
  Zap, 
  Moon, 
  RotateCw, 
  Sun, 
  Volume2, 
  Flashlight, 
  Plane, 
  Battery, 
  Settings,
  Bell,
  HardDrive,
  Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface SystemSettings {
  wifi: boolean;
  bluetooth: boolean;
  flashlight: boolean;
  airplaneMode: boolean;
  doNotDisturb: boolean;
  autoRotate: boolean;
  brightness: number;
  volume: number;
  battery: number;
  ramUsage: number;
  storageUsage: number;
}

interface ControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSettingChange: (setting: keyof SystemSettings, value: any) => void;
}

export default function ControlCenter({ isOpen, onClose, settings, onSettingChange }: ControlCenterProps) {
  const toggleSetting = (setting: keyof SystemSettings) => {
    onSettingChange(setting, !settings[setting]);
  };

  const gridButtons = [
    { id: "wifi", icon: Wifi, label: "Wi-Fi", active: settings.wifi },
    { id: "bluetooth", icon: Bluetooth, label: "Bluetooth", active: settings.bluetooth },
    { id: "flashlight", icon: Flashlight, label: "Torch", active: settings.flashlight },
    { id: "airplaneMode", icon: Plane, label: "Airplane", active: settings.airplaneMode },
    { id: "doNotDisturb", icon: Moon, label: "Silent", active: settings.doNotDisturb },
    { id: "autoRotate", icon: RotateCw, label: "Rotate", active: settings.autoRotate },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] pointer-events-auto"
          />
          <motion.div
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-[160] bg-[#1a1a1a]/95 border-b border-x border-white/10 rounded-b-[2rem] p-6 shadow-2xl pointer-events-auto backdrop-blur-2xl"
          >
            {/* Grab Handle */}
            <div 
              onClick={onClose}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full cursor-pointer hover:bg-white/40 transition-colors" 
            />

            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Vitals Card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Device Vitals</span>
                  <Settings size={12} className="opacity-30" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                     <div className="flex items-center gap-2">
                        <Battery size={14} className={settings.battery < 20 ? "text-red-400" : "text-green-400"} />
                        <span className="text-sm font-bold">{settings.battery}%</span>
                     </div>
                     <span className="text-[9px] opacity-30">Power Stable</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${settings.battery}%` }}
                      className={`h-full ${settings.battery < 20 ? "bg-red-500" : "bg-green-500"}`} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 opacity-40">
                         <Cpu size={10} />
                         <span className="text-[8px] uppercase tracking-tighter">RAM</span>
                      </div>
                      <span className="text-[10px] font-mono">{settings.ramUsage}GB Used</span>
                   </div>
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 opacity-40">
                         <HardDrive size={10} />
                         <span className="text-[8px] uppercase tracking-tighter">Disk</span>
                      </div>
                      <span className="text-[10px] font-mono">{settings.storageUsage}% Full</span>
                   </div>
                </div>
              </div>

              {/* Sliders Card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-4">
                 <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-white/40">
                      <Sun size={12} />
                      <span className="text-[9px] font-bold">{settings.brightness}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={settings.brightness}
                      onChange={(e) => onSettingChange("brightness", parseInt(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                 </div>
                 <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-white/40">
                      <Volume2 size={12} />
                      <span className="text-[9px] font-bold">{settings.volume}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={settings.volume}
                      onChange={(e) => onSettingChange("volume", parseInt(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-400"
                    />
                 </div>
              </div>
            </div>

            {/* Function Toggles */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {gridButtons.map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => toggleSetting(btn.id as any)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                    btn.active 
                    ? "bg-violet-600 shadow-[0_0_15px_rgba(139,92,246,0.3)] text-white" 
                    : "bg-white/5 text-white/40 hover:bg-white/10"
                  }`}>
                    <btn.icon size={20} />
                  </div>
                  <span className={`text-[10px] font-medium transition-colors ${btn.active ? "text-white" : "text-white/40"}`}>
                    {btn.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
               <div className="flex items-center gap-2 text-white/20">
                  <Bell size={12} />
                  <span className="text-[10px] font-mono tracking-widest uppercase">System Control Center</span>
               </div>
               <button 
                onClick={onClose}
                className="text-[10px] font-bold text-violet-400 hover:text-violet-300 uppercase tracking-widest"
               >
                 Close Panel
               </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
