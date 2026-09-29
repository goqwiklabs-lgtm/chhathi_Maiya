import { useState, useEffect } from 'react';

export function useTime() {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format: 8:42 am (12-hour format without leading zeros for hours)
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12; // hour '0' should be '12'
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      
      setTimeStr(`${hours}:${formattedMinutes} ${ampm}`);

      // Also readable date e.g. "Chhath Mahaparv"
      setDateStr(now.toLocaleDateString('hi-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return { timeStr, dateStr };
}
