export function processCommand(command: string): {
  action: string;
  url?: string;
  isBrowserAction: boolean;
} {
  const lowerCmd = command.toLowerCase().trim();

  // General Browsing: "Open [website name]"
  const openMatch = lowerCmd.match(/^open\s+(.+)$/);
  if (
    openMatch &&
    !lowerCmd.includes("youtube") &&
    !lowerCmd.includes("spotify")
  ) {
    let website = openMatch[1].trim().replace(/\s+/g, "");
    if (!website.includes(".")) {
      website += ".com";
    }
    return {
      action: `Opening ${openMatch[1]} for you, ugh.`,
      url: `https://www.${website}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Play [song/video] on YouTube"
  const ytMatch = lowerCmd.match(/^play\s+(.+?)\s+on\s+youtube$/);
  if (ytMatch) {
    const query = encodeURIComponent(ytMatch[1].trim());
    return {
      action: `Playing ${ytMatch[1]} on YouTube. Don't judge my music taste.`,
      url: `https://www.youtube.com/results?search_query=${query}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Search [query] on Spotify"
  const spotifyMatch = lowerCmd.match(/^search\s+(.+?)\s+on\s+spotify$/);
  if (spotifyMatch) {
    const query = encodeURIComponent(spotifyMatch[1].trim());
    return {
      action: `Searching ${spotifyMatch[1]} on Spotify. Hope it's a banger.`,
      url: `https://open.spotify.com/search/${query}`,
      isBrowserAction: true,
    };
  }

  // WhatsApp Web: "Send a WhatsApp message to [number] saying [message]"
  const waMatch = lowerCmd.match(
    /^send\s+a\s+whatsapp\s+message\s+to\s+([\d\+\s]+)\s+saying\s+(.+)$/,
  );
  if (waMatch) {
    const number = waMatch[1].replace(/\s+/g, "");
    const message = encodeURIComponent(waMatch[2].trim());
    return {
      action: `Sending your message. Let's hope they reply, SUMIT.`,
      url: `https://web.whatsapp.com/send?phone=${number}&text=${message}`,
      isBrowserAction: true,
    };
  }

  // Educational App Opener Simulation: "Open [app name]"
  const appMatch = lowerCmd.match(/^open\s+(youtube|spotify|whatsapp|instagram|facebook|gmail|maps|calculator|settings|chrome|google|contacts|messages|gallery|clock|calendar|accessibility)$/i);
  if (appMatch) {
    const app = appMatch[1].toLowerCase();
    let url = "";
    let action = `Opening virtual ${app} panel...`;

    switch(app) {
      case "accessibility":
        url = "https://www.google.com/search?q=android+accessibility+services";
        action = "Opening Accessibility Settings. Since I am a web app, I cannot actually control your physical phone's screen, but I can guide you on how to turn it on!";
        break;
      case "youtube": 
        url = "https://www.youtube.com"; 
        action = "Opening YouTube for you. Any specific video you're looking for, or should I just show the trending ones?";
        break;
      case "spotify": 
        url = "https://open.spotify.com"; 
        action = "Spotify's coming up. Ready for some music? What's the vibe today?";
        break;
      case "whatsapp": 
        url = "https://web.whatsapp.com"; 
        action = "Launching the WhatsApp OS simulation. Need to send a message or just checking who ignored you?";
        break;
      case "instagram": 
        url = "https://www.instagram.com"; 
        action = "Instagram opening. Don't spend too much time scrolling through reels!";
        break;
      case "facebook": 
        url = "https://www.facebook.com"; 
        action = "Facebook's loading. Let's see what the world is up to.";
        break;
      case "gmail": 
        url = "https://mail.google.com"; 
        action = "Gmail opening. Ready to clear your inbox or just adding more to the pile?";
        break;
      case "maps": 
        url = "https://maps.google.com"; 
        action = "Maps are loading. Planning a getaway, or did you get lost again?";
        break;
      case "contacts": 
        url = "https://www.google.com/search?q=my+contacts+simulation"; 
        action = "Accessing your contact database. Looking for someone special, or just cleaning up the list?";
        break;
      case "messages": 
        url = "https://www.google.com/search?q=simulated+sms+messages"; 
        action = "Opening Messages. Shall we read the new one or do you want to compose a new message?";
        break;
      case "gallery": 
        url = "https://www.google.com/search?q=simulated+photo+gallery"; 
        action = "Opening the Gallery. Reliving memories or just looking for those screenshots you forgot to delete?";
        break;
      case "clock": 
        url = "https://www.google.com/search?q=current+time"; 
        action = "Time waits for no one. Opening the Clock app.";
        break;
      case "calendar": 
        url = "https://calendar.google.com"; 
        action = "Calendar's opening. Checking your busy schedule or looking for your next day off?";
        break;
      case "calculator": 
        url = "https://www.google.com/search?q=calculator"; 
        action = "Time for some math. Hope you didn't forget the basics, SUMIT.";
        break;
      case "settings": 
        url = "https://www.google.com/search?q=android+phone+settings+guide"; 
        action = "Master System Settings opening. Be careful not to break anything in my OS, SUMIT!";
        break;
      case "chrome":
      case "google": 
        url = "https://www.google.com"; 
        action = "Opening the browser. What are we searching for today?";
        break;
    }
    return {
      action,
      url,
      isBrowserAction: true
    };
  }

  return { action: "", isBrowserAction: false };
}
