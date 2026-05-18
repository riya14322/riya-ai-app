import { ReactNode } from "react";
import { 
  Youtube, 
  MessageCircle, 
  Instagram, 
  Facebook, 
  Settings, 
  MapPin, 
  Music, 
  Phone, 
  Mail, 
  Camera, 
  Search, 
  LayoutGrid
} from "lucide-react";

export interface ApkInfo {
  id: string;
  name: string;
  packageName: string;
  icon: string;
  category: 'social' | 'system' | 'entertainment' | 'utility';
  usageTime: string;
  isLocked: boolean;
}

export const installedApks: ApkInfo[] = [
  { id: "1", name: "WhatsApp", packageName: "com.whatsapp", icon: "MessageCircle", category: "social", usageTime: "2h 45m", isLocked: false },
  { id: "2", name: "YouTube", packageName: "com.google.android.youtube", icon: "Youtube", category: "entertainment", usageTime: "4h 12m", isLocked: false },
  { id: "3", name: "Instagram", packageName: "com.instagram.android", icon: "Instagram", category: "social", usageTime: "1h 20m", isLocked: true },
  { id: "4", name: "Maps", packageName: "com.google.android.apps.maps", icon: "MapPin", category: "utility", usageTime: "15m", isLocked: false },
  { id: "5", name: "Settings", packageName: "com.android.settings", icon: "Settings", category: "system", usageTime: "5m", isLocked: false },
  { id: "6", name: "Spotify", packageName: "com.spotify.music", icon: "Music", category: "entertainment", usageTime: "3h 50m", isLocked: false },
  { id: "7", name: "Gmail", packageName: "com.google.android.gm", icon: "Mail", category: "utility", usageTime: "45m", isLocked: false },
  { id: "8", name: "Phone", packageName: "com.android.dialer", icon: "Phone", category: "system", usageTime: "22m", isLocked: false },
  { id: "9", name: "Camera", packageName: "com.android.camera", icon: "Camera", category: "system", usageTime: "10m", isLocked: false },
  { id: "10", name: "Chrome", packageName: "com.android.chrome", icon: "Search", category: "utility", usageTime: "2h 10m", isLocked: false },
  { id: "11", name: "Calculator", packageName: "com.android.calculator2", icon: "LayoutGrid", category: "utility", usageTime: "2m", isLocked: false },
  { id: "12", name: "Facebook", packageName: "com.facebook.katana", icon: "Facebook", category: "social", usageTime: "1h 05m", isLocked: false },
  { id: "13", name: "LinkedIn", packageName: "com.linkedin.android", icon: "Search", category: "social", usageTime: "30m", isLocked: true },
  { id: "14", name: "Netflix", packageName: "com.netflix.mediaclient", icon: "Youtube", category: "entertainment", usageTime: "5h 20m", isLocked: false },
  { id: "15", name: "Gallery", packageName: "com.android.gallery3d", icon: "Camera", category: "system", usageTime: "12m", isLocked: false },
];

export const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'Youtube': return Youtube;
    case 'MessageCircle': return MessageCircle;
    case 'Instagram': return Instagram;
    case 'Facebook': return Facebook;
    case 'Settings': return Settings;
    case 'MapPin': return MapPin;
    case 'Music': return Music;
    case 'Phone': return Phone;
    case 'Mail': return Mail;
    case 'Camera': return Camera;
    case 'Search': return Search;
    default: return LayoutGrid;
  }
};
