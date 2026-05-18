export interface Notification {
  id: string;
  sender: string;
  content: string;
  time: string;
  app: 'whatsapp' | 'gmail' | 'instagram' | 'messages';
  isRead: boolean;
}

export const mockNotifications: Notification[] = [
  {
    id: "1",
    sender: "Mom",
    content: "Beta, khana khaya? Call me back when you're free.",
    time: "2m ago",
    app: "whatsapp",
    isRead: false
  },
  {
    id: "2",
    sender: "Strict Boss",
    content: "Sumit, where is the report? The client is waiting. Don't tell me your AI ate it.",
    time: "15m ago",
    app: "gmail",
    isRead: false
  },
  {
    id: "3",
    sender: "Instagram",
    content: "Anjali liked your photo: 'Trying to be productive with RIYA'.",
    time: "32m ago",
    app: "instagram",
    isRead: false
  },
  {
    id: "4",
    sender: "Bank of India",
    content: "Alert: Your account has been credited with ₹0.01. Don't spend it all at once!",
    time: "1h ago",
    app: "messages",
    isRead: false
  },
  {
    id: "5",
    sender: "Zomato",
    content: "Feeling hungry? Your favorite Momos are just a tap away! (Actually just open the fridge, Sumit).",
    time: "2h ago",
    app: "whatsapp",
    isRead: false
  }
];

export function getUnreadNotifications() {
  return mockNotifications.filter(n => !n.isRead);
}

export function markAllAsRead() {
  mockNotifications.forEach(n => n.isRead = true);
}
