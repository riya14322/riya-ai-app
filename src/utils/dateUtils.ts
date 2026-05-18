/**
 * Utility to get current time and Bengali calendar info
 */
export function getCurrentDateTimeContext(): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  // Basic Bengali calendar calculation for demo purposes (Pohela Boishakh is April 14th)
  // 14 April 2026 is 1st Boishakh 1433
  const bengaliYear = now.getFullYear() - 593; // Simple offset for 1433
  
  // April 19 is roughly 6th Boishakh
  // This is a simplified calculation for the system instruction
  const dayOfMonth = now.getDate();
  const bengaliDay = dayOfMonth >= 14 ? dayOfMonth - 13 : dayOfMonth + 17; // Very rough approximation
  const bengaliMonth = dayOfMonth >= 14 ? "Boishakh" : "Chaitra";
  
  return `Current Date: ${dateStr}. Current Time: ${timeStr}. Bengali Date (Bangla Calender): ${bengaliDay}th ${bengaliMonth}, ${bengaliYear}.`;
}
