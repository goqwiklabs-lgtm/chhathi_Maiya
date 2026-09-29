import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, User, ChevronUp, AlertTriangle, AlertCircle, Mail, Phone, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';

interface ChatMessage {
  id: number;
  name: string;
  message: string;
  time_formatted?: string;
  timestamp?: number;
}

// Pre-text Admin Notice Message
const INITIAL_DEMO_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    name: 'Admin',
    message: 'Chhath Puja Aane wali hai! Taiyaar Rahee, Chhathi Maiya Apni Kripa sb par krengi 🙏🌅',
    time_formatted: '06:00 AM'
  }
];

export const PublicChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('chhathi_cached_chat_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter(
            (m: ChatMessage) =>
              !m.name.includes('अमित') &&
              !m.name.includes('प्रिया') &&
              !m.name.includes('राहुल')
          );
          if (filtered.length > 0) return filtered;
        }
      }
    } catch {}
    return INITIAL_DEMO_MESSAGES;
  });

  const [userName, setUserName] = useState<string>(() => {
    try {
      return localStorage.getItem('chhathi_chat_user_name') || '';
    } catch {
      return '';
    }
  });

  // Onboarding Form States (Name + Email + Required Phone)
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [isOnboardingSubmitting, setIsOnboardingSubmitting] = useState(false);

  // Email OTP states
  const [otpStep, setOtpStep] = useState<'input' | 'otp_sent'>('input');
  const [otpCode, setOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState<number>(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);

  // Chat & Connection States
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isDbOnline, setIsDbOnline] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUserBlocked, setIsUserBlocked] = useState(false);

  // Typing indicators (Discord style above input + WhatsApp 3 dots bubble in chat)
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const lastTypingPingRef = useRef<number>(0);

  // YouTube-Style Speed Rate Limiting (10 messages per 40s)
  const [recentSendTimestamps, setRecentSendTimestamps] = useState<number[]>([]);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [rateLimitAlert, setRateLimitAlert] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          setRateLimitAlert(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Client-side Real-Name Validator
  const validateName = (name: string): string | null => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return 'Real name must be at least 3 characters.';
    if (trimmed.length > 30) return 'Name cannot exceed 30 characters.';
    if (!/^[a-zA-Z\s\.\u0900-\u097F]+$/.test(trimmed)) {
      return 'Please enter your real name (letters only, no numbers or symbols).';
    }
    const clean = trimmed.toLowerCase().replace(/[\s\.]/g, '');
    const unique = new Set(clean);
    if (unique.size < 2 || /(asdf|qwerty|zxcv|1234|qwer|hjkl|aaaa|zzzz)/i.test(clean)) {
      return 'Invalid name entered. Please type your genuine real name.';
    }
    return null;
  };

  // Client-side Email Validator (Only @gmail.com or @outlook.com)
  const validateEmail = (email: string): string | null => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return 'Email ID is required.';
    const match = trimmed.match(/^[a-z0-9]([a-z0-9\._]{2,30})@(gmail\.com|outlook\.com)$/);
    if (!match) {
      return 'Email must end with @gmail.com or @outlook.com';
    }
    const prefix = match[1];
    if (/(asdf|qwerty|zxcv|hjkl|1234|qwer|yuiop)/i.test(prefix)) {
      return 'Please enter a genuine personal email address.';
    }
    if (/(.)\1{3,}/.test(prefix)) {
      return 'Email contains invalid repeating characters.';
    }
    if (!/[aeiou]/i.test(prefix)) {
      return 'Please enter a valid, real email address.';
    }
    if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(prefix)) {
      return 'Invalid email address entered.';
    }
    if (/^(test|fake|dummy|temp|sample|spam|random|none|admin|noemail)/i.test(prefix)) {
      return 'Disposable or dummy emails are not allowed.';
    }
    return null;
  };

  // Client-side Indian Phone Validator (10 digits, starts with 6-9)
  const validatePhone = (phone: string): string | null => {
    const trimmed = phone.trim();
    if (!trimmed) return 'Phone number is required.';
    let clean = trimmed.replace(/[\s\-\(\)\.]/g, '');
    if (clean.startsWith('+91')) clean = clean.substring(3);
    else if (clean.startsWith('91') && clean.length === 12) clean = clean.substring(2);
    else if (clean.startsWith('0') && clean.length === 11) clean = clean.substring(1);

    if (!/^\d{10}$/.test(clean)) {
      return 'Phone number must be exactly 10 digits.';
    }
    if (!/^[6-9]/.test(clean)) {
      return 'Mobile number must start with 6, 7, 8, or 9.';
    }
    if (/^(\d)\1{9}$/.test(clean)) {
      return 'Fake phone number detected (all identical digits).';
    }
    if (/(.)\1{5,}/.test(clean)) {
      return 'Fake phone number detected (too many repeating digits).';
    }
    const fakeSequences = [
      '0123456789', '1234567890', '2345678901', '3456789012',
      '9876543210', '8765432109', '7654321098', '6543210987',
      '9898989898', '9090909090', '9191919191', '9797979797',
      '9999900000', '9876500000', '1212121212'
    ];
    if (fakeSequences.includes(clean)) {
      return 'Please enter a genuine, active 10-digit mobile number.';
    }
    const uniqueDigits = new Set(clean.split('')).size;
    if (uniqueDigits < 4) {
      return 'Invalid phone number with insufficient unique digits.';
    }
    return null;
  };

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  // Send 6-Digit Code to Devotee Email (Passes Name, Email, and Phone)
  const handleSendEmailOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isOnboardingSubmitting) return;

    const nErr = validateName(nameInput);
    if (nErr) {
      setOnboardingError(nErr);
      return;
    }

    const trimmedEmail = emailInput.trim();
    const eErr = validateEmail(trimmedEmail);
    if (eErr) {
      setOnboardingError(eErr);
      return;
    }

    const trimmedPhone = phoneInput.trim();
    const pErr = validatePhone(trimmedPhone);
    if (pErr) {
      setOnboardingError(pErr);
      return;
    }

    setIsOnboardingSubmitting(true);
    setOnboardingError(null);

    try {
      const res = await fetch('./api/messages.php?action=send_email_otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: nameInput.trim(),
          email: trimmedEmail,
          phone: trimmedPhone
        })
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('send_email_otp non-JSON response:', text);
      }

      if (data && data.success) {
        setOtpStep('otp_sent');
        setResendCountdown(45);
        setOtpCode('');
        setOnboardingError(null);
      } else if (data && data.error) {
        setOnboardingError(data.error);
      } else {
        const cleaned = text.replace(/<[^>]*>?/gm, '').trim();
        setOnboardingError(cleaned.slice(0, 140) || 'Failed to dispatch email verification code. Please try again.');
      }
    } catch (err: any) {
      console.error('Email dispatch error:', err);
      setOnboardingError(err?.message ? `Connection error: ${err.message}` : 'Connection error sending email code.');
    } finally {
      setIsOnboardingSubmitting(false);
    }
  };

  // Verify 6-Digit Email Code (Saves Name, Email, and Phone into Database)
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifyingOtp) return;

    const trimmedOtp = otpCode.trim();
    if (trimmedOtp.length !== 6 || !/^\d{6}$/.test(trimmedOtp)) {
      setOnboardingError('Please enter the 6-digit code received on your email.');
      return;
    }

    setIsVerifyingOtp(true);
    setOnboardingError(null);

    try {
      const res = await fetch('./api/messages.php?action=verify_email_otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: nameInput.trim(),
          email: emailInput.trim(),
          phone: phoneInput.trim(),
          otp: trimmedOtp
        })
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('verify_email_otp non-JSON response:', text);
      }

      if (data && data.success) {
        const finalName = data.name || nameInput.trim();
        setUserName(finalName);
        if (data.mysql_online !== undefined) {
          setIsDbOnline(Boolean(data.mysql_online));
        }
        try {
          localStorage.setItem('chhathi_chat_user_name', finalName);
          localStorage.setItem('chhathi_chat_user_email', emailInput.trim());
          localStorage.setItem('chhathi_chat_user_phone', phoneInput.trim());
          localStorage.setItem('chhathi_chat_email_verified', 'true');
        } catch {}
        setOnboardingError(null);
      } else if (data && data.error) {
        setOnboardingError(data.error);
      } else {
        const cleaned = text.replace(/<[^>]*>?/gm, '').trim();
        setOnboardingError(cleaned.slice(0, 140) || 'Invalid 6-digit code. Please check your email.');
      }
    } catch (err: any) {
      console.error('Email verify error:', err);
      setOnboardingError(err?.message ? `Connection error: ${err.message}` : 'Error verifying email OTP.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Scroll to bottom on new messages or typing
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  // Realtime Polling Loop for Multi-Device Sync (PC & Phone)
  const fetchMessages = async () => {
    try {
      const res = await fetch(`./api/messages.php?action=get_messages&limit=60&_t=${Date.now()}`, {
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      if (res.ok) {
        const text = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {}

        if (data && data.is_blocked) {
          setIsUserBlocked(true);
          setErrorMessage('Your IP address has been blocked for violating safety guidelines.');
        }

        if (data && data.mysql_online !== undefined) {
          setIsDbOnline(Boolean(data.mysql_online));
        }

        if (data && Array.isArray(data.typing)) {
          // Filter out current user from typing indicators
          const currentTypers = data.typing.filter((u: string) => u && u.toLowerCase() !== userName.toLowerCase());
          setTypingUsers(currentTypers);
        }

        if (data && data.success && Array.isArray(data.messages)) {
          const incoming: ChatMessage[] = data.messages;
          if (incoming.length > 0) {
            setMessages((prev) => {
              // Combine and merge cleanly by ID
              const map = new Map<number, ChatMessage>();
              prev.forEach((m) => map.set(m.id, m));
              incoming.forEach((m) => map.set(m.id, m));
              const combined = Array.from(map.values()).sort((a, b) => a.id - b.id).slice(-100);
              try {
                localStorage.setItem('chhathi_cached_chat_v2', JSON.stringify(combined));
              } catch {}
              return combined;
            });
          }
        }
      } else {
        // If HTTP 500 or unreachable, mark DB offline
        setIsDbOnline(false);
      }
    } catch {
      setIsDbOnline(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    let timerId: any = null;

    const poll = async () => {
      if (isCancelled) return;
      await fetchMessages();
      if (isCancelled) return;
      const delay = document.hidden ? 10000 : 2500;
      timerId = setTimeout(poll, delay);
    };

    poll();

    const handleVisibilityChange = () => {
      if (!document.hidden && !isCancelled) {
        fetchMessages();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userName]);

  // Broadcast typing status when typing in chat box
  const handleTyping = () => {
    if (!userName) return;
    const now = Date.now();
    if (now - lastTypingPingRef.current > 2000) {
      lastTypingPingRef.current = now;
      fetch('./api/messages.php?action=typing', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName })
      }).catch(() => {});
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isSending || isUserBlocked) return;

    // Rate limiting check (YouTube-style speed warning: 10 messages per 40s)
    const now = Date.now();
    const past40s = recentSendTimestamps.filter((t) => now - t < 40000);
    if (past40s.length >= 10 || cooldownSeconds > 0) {
      setCooldownSeconds(10);
      setRateLimitAlert('Your Message Speed is Fast Try after 10 Sec');
      return;
    }

    setIsSending(true);
    const finalName = userName.trim() || 'Devotee';
    try {
      localStorage.setItem('chhathi_chat_user_name', finalName);
    } catch {}

    const tempId = Date.now();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      name: finalName,
      message: textToSend,
      time_formatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Math.floor(Date.now() / 1000)
    };

    // Optimistically update UI
    setMessages((prev) => {
      const updated = [...prev, optimisticMsg].slice(-100);
      try {
        localStorage.setItem('chhathi_cached_chat_v2', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (!customText) {
      setInputMessage('');
    }

    // Record send timestamp
    setRecentSendTimestamps((prev) => [...prev.filter((t) => now - t < 40000), now]);

    // Send to PHP + MySQL backend
    try {
      const res = await fetch('./api/messages.php?action=send_message', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: finalName,
          message: textToSend
        })
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {}

      if (data && data.mysql_online !== undefined) {
        setIsDbOnline(Boolean(data.mysql_online));
      }

      // Handle YouTube-style 429 rate limit error
      if (res.status === 429 || (data && data.rate_limited)) {
        const cd = data?.cooldown || 10;
        setCooldownSeconds(cd);
        setRateLimitAlert(data?.error || 'Your Message Speed is Fast Try after 10 Sec');
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }

      if (data && data.blocked) {
        setIsUserBlocked(true);
        setErrorMessage(data.error || 'Your IP address has been permanently blocked.');
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } else if (data && !data.success) {
        setErrorMessage(data.error || 'Message rejected.');
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } else if (data && data.success && data.message) {
        setErrorMessage(null);
        setRateLimitAlert(null);
        // Replace optimistic ID with real MySQL ID
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...data.message } : m))
        );
        // Trigger fresh sync immediately
        fetchMessages();
      }
    } catch {
      // Local fallback mode
      setIsDbOnline(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section
      id="public-chat-section"
      className="relative z-20 min-h-[90dvh] w-full flex flex-col items-center justify-start px-4 py-8 sm:py-12 select-none"
    >
      {/* Back to Music Player Button */}
      <button
        onClick={handleScrollToTop}
        className="mb-6 flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/30 text-xs sm:text-sm font-medium text-cyan-200 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all active:scale-95 cursor-pointer"
        title="Back to Music Player"
      >
        <ChevronUp className="w-4 h-4 text-cyan-400" />
        <span>Back to Music Player</span>
      </button>

      {/* Main Glass Chat Card - Black & Light Gradient Blue Palette */}
      <div className="w-full max-w-2xl rounded-3xl bg-[#030712]/90 backdrop-blur-2xl border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col h-[75dvh] sm:h-[78dvh] overflow-hidden">
        
        {/* Chat Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-cyan-500/20 bg-gradient-to-r from-slate-950 via-[#060c1c] to-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <MessageCircle className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent tracking-wide">
                Chhathi Maiya Public Chat
              </h2>
              <span className="text-[10px] text-cyan-400/60 font-mono">Live Devotee Community</span>
            </div>
          </div>

          {/* MySQL Status Pill (Exact User Requirement) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] text-white/80">
            <span
              className={`h-2 w-2 rounded-full ${
                isDbOnline
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse'
              }`}
            />
            <span className={`font-mono text-[10px] ${isDbOnline ? 'text-white/90' : 'text-red-300'}`}>
              {isDbOnline ? 'MySQL Online' : 'MySQL Offline'}
            </span>
          </div>
        </div>

        {/* Database Maintenance Mode Banner (Prominently Shown If DB Crashed/Offline) */}
        {!isDbOnline && (
          <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-red-950/90 border border-red-500/60 text-red-200 text-xs sm:text-sm flex items-center gap-2.5 shadow-lg animate-pulse">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="font-semibold tracking-wide">
              ⚠️ Database is in Maintenance Mode! Try After sometime
            </span>
          </div>
        )}

        {/* Safety Error Alert Banner */}
        {errorMessage && (
          <div className="mx-4 my-2 px-3.5 py-2 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center justify-between shadow-lg animate-in fade-in">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-white text-xs ml-2 cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Messages Stream */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scroll-smooth"
        >
          {messages.map((msg) => {
            const isAdmin =
              msg.name.toLowerCase() === 'admin' ||
              msg.name.toLowerCase().includes('admin');
            const isSelf = !isAdmin && userName && msg.name.toLowerCase() === userName.toLowerCase();
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  isAdmin ? 'items-start' : isSelf ? 'items-end' : 'items-start'
                } transition-opacity duration-200`}
              >
                {/* Sender Name & Time */}
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-[11px] sm:text-xs font-semibold text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.25)]">
                      👑 By Admin
                    </span>
                  ) : (
                    <span className="text-[11px] sm:text-xs font-medium text-cyan-300/90 font-devanagari">
                      {msg.name}
                    </span>
                  )}
                  {msg.time_formatted && (
                    <span className="text-[10px] text-cyan-200/40 font-mono">
                      {msg.time_formatted}
                    </span>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words shadow-md ${
                    isAdmin
                      ? 'bg-blue-950/60 border border-cyan-400/40 rounded-tl-none ring-1 ring-cyan-400/30 text-cyan-50 shadow-[0_4px_16px_rgba(6,182,212,0.15)]'
                      : isSelf
                      ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 border border-cyan-400/40 text-white rounded-tr-none shadow-[0_2px_12px_rgba(14,165,233,0.3)]'
                      : 'bg-[#0b1220] border border-cyan-500/20 text-slate-100 rounded-tl-none'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })}

          {/* WhatsApp / Instagram Style 3 Bouncing Dots Bubble in Chat Stream */}
          {typingUsers.length > 0 && (
            <div className="flex items-end gap-2 my-1.5 animate-in fade-in duration-200">
              <div className="w-7 h-7 rounded-full bg-cyan-950/80 border border-cyan-400/40 flex items-center justify-center text-[11px] font-bold text-cyan-300 uppercase shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                {typingUsers[0].charAt(0)}
              </div>
              <div className="bg-[#0b1220] border border-cyan-500/30 px-3.5 py-2.5 rounded-2xl rounded-bl-sm shadow-md flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-cyan-200 animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section: Blocked State OR Devotee Onboarding OR Active Chat Input */}
        {isUserBlocked ? (
          <div className="p-4 border-t border-red-500/30 bg-red-950/60 text-center select-none">
            <span className="text-xs sm:text-sm text-red-300 font-medium">
              🔒 Access Denied: Your IP address has been permanently blocked due to violations of community safety rules.
            </span>
          </div>
        ) : !userName ? (
          <div className="p-4 sm:p-5 border-t border-cyan-500/20 bg-slate-950/80 flex flex-col gap-3.5">
            {/* Header */}
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-white">
                  Devotee Verification & Onboarding
                </h4>
                <p className="text-[11px] text-cyan-200/60">
                  Verify your identity once via Email OTP to join public chat
                </p>
              </div>
            </div>

            {/* Privacy Caution Banner */}
            <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] sm:text-xs leading-relaxed text-cyan-200/90">
                <strong className="text-cyan-300">⚠️ Secure Verification:</strong> Name, Email, and Phone number are required to prevent spam & bots. Only Email receives the 6-digit OTP code.
              </div>
            </div>

            {/* Step 2: Entering 6-digit Email Verification Code */}
            {otpStep === 'otp_sent' ? (
              <form onSubmit={handleVerifyEmailOtp} className="flex flex-col gap-3 p-3.5 rounded-2xl bg-[#060c1a] border border-cyan-500/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-medium">
                    <KeyRound className="w-4 h-4" />
                    <span>Enter 6-Digit Email Code</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('input');
                      setOtpCode('');
                      setOnboardingError(null);
                    }}
                    className="text-[10px] text-cyan-400 hover:text-white flex items-center gap-1 underline cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Edit Details
                  </button>
                </div>

                <p className="text-[11px] text-cyan-100/80">
                  Verification code dispatched to <strong className="text-cyan-300">{emailInput.trim()}</strong>.<br/>
                  Please check your inbox or spam folder and enter the 6-digit code below:
                </p>

                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, ''));
                      setOnboardingError(null);
                    }}
                    placeholder="• • • • • •"
                    className="w-full text-center tracking-[0.4em] font-mono font-bold text-lg py-2 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-300 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    autoFocus
                  />
                </div>

                {onboardingError && (
                  <div className="text-[11px] text-red-400 font-medium px-1 flex items-center gap-1.5 bg-red-950/40 p-2 rounded-lg border border-red-500/30">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{onboardingError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-cyan-300/60 px-0.5">
                  <span>Didn't receive code?</span>
                  {resendCountdown > 0 ? (
                    <span className="font-mono text-cyan-300/80">Resend in {resendCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendEmailOtp()}
                      disabled={isOnboardingSubmitting}
                      className="text-cyan-400 hover:text-cyan-200 underline font-medium cursor-pointer"
                    >
                      Resend Email Code
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={otpCode.length !== 6 || isVerifyingOtp}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 text-white text-xs sm:text-sm font-semibold shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isVerifyingOtp ? (
                    <span>Verifying Code...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify Code & Join Chat</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Step 1: Real Name + Email ID + Required Phone Form */
              <form onSubmit={handleSendEmailOtp} className="flex flex-col gap-3">
                {/* Real Name Input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-cyan-200/90 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    Your Real Name (नाम) <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setOnboardingError(null);
                    }}
                    placeholder="Enter your real name (e.g. Rahul Sharma)"
                    maxLength={30}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-cyan-500/30 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    autoFocus
                  />
                </div>

                {/* Email Input */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-cyan-200/90 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-cyan-400" />
                      Email ID (ईमेल - OTP received here) <span className="text-cyan-400">*</span>
                    </label>
                    <span className="text-[10px] text-cyan-300/70">(@gmail / @outlook only)</span>
                  </div>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setOnboardingError(null);
                    }}
                    placeholder="e.g. devotee@gmail.com"
                    maxLength={50}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-cyan-500/30 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                </div>

                {/* Phone Input (Required - saved into database, no SMS OTP needed) */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-cyan-200/90 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-cyan-400" />
                      Mobile Number (मोबाइल नंबर - Required) <span className="text-cyan-400">*</span>
                    </label>
                    <span className="text-[10px] text-cyan-300/70">(10-digit Indian Mobile)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-2 rounded-xl bg-slate-900 border border-cyan-500/30 text-xs font-mono text-cyan-300">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => {
                        setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10));
                        setOnboardingError(null);
                      }}
                      placeholder="e.g. 9876543210"
                      maxLength={10}
                      className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-cyan-500/30 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono"
                    />
                  </div>
                </div>

                {onboardingError && (
                  <div className="text-[11px] text-red-400 font-medium px-1 flex items-center gap-1.5 bg-red-950/50 p-2 rounded-lg border border-red-500/40">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{onboardingError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!nameInput.trim() || !emailInput.trim() || !phoneInput.trim() || isOnboardingSubmitting}
                  className="mt-1 w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 text-white text-xs sm:text-sm font-semibold shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isOnboardingSubmitting ? (
                    <span>Sending 6-Digit Email Code...</span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Send 6-Digit Email Code</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="p-3 sm:p-4 border-t border-cyan-500/20 bg-slate-950/90 flex flex-col gap-2">
            {/* YouTube-Style Speed Warning Banner */}
            {cooldownSeconds > 0 && (
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs sm:text-sm animate-pulse shadow-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="font-semibold">
                    Your Message Speed is Fast Try after {cooldownSeconds} Sec
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-red-500/30 text-red-100 font-mono text-xs">
                  {cooldownSeconds}s
                </span>
              </div>
            )}

            {/* Discord-Style Typing Indicator Bar Just Above Chat Input Box */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 px-2 py-0.5 text-xs text-cyan-300 font-medium animate-pulse">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]"></span>
                <span>
                  {typingUsers.length === 1
                    ? `${typingUsers[0]} is typing...`
                    : `${typingUsers.slice(0, 2).join(', ')} are typing...`}
                </span>
              </div>
            )}

            {/* User Status Bar */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-cyan-200/60">
                Posting as: <strong className="text-cyan-300 font-medium">{userName}</strong>
              </span>
              <button
                onClick={() => {
                  setUserName('');
                  setNameInput('');
                  setEmailInput('');
                  setPhoneInput('');
                  try {
                    localStorage.removeItem('chhathi_chat_user_name');
                    localStorage.removeItem('chhathi_chat_user_email');
                    localStorage.removeItem('chhathi_chat_user_phone');
                  } catch {}
                }}
                className="text-[10px] text-cyan-400/60 hover:text-cyan-300 transition cursor-pointer underline"
              >
                Change Details
              </button>
            </div>

            {/* Text Input & Send Button */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  handleTyping();
                }}
                disabled={cooldownSeconds > 0}
                placeholder={cooldownSeconds > 0 ? `Speed limit: please wait ${cooldownSeconds}s...` : "Type a message..."}
                maxLength={400}
                className="flex-1 px-4 py-2.5 rounded-full bg-slate-900 border border-cyan-500/30 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/70 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending || cooldownSeconds > 0}
                className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 text-white font-semibold shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex-shrink-0"
                title="Send"
                aria-label="Send Message"
              >
                <Send className="w-4 h-4 fill-current ml-0.5" />
              </button>
            </form>
          </div>
        )}

      </div>
    </section>
  );
};
