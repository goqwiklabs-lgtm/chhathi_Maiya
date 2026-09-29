import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, User, ChevronUp, AlertTriangle, AlertCircle, Mail, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';

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
    message: 'Chhath Puja Aane wali hai! Taiyaar Rahee, Chhathi Maiya Apni Kripa sb par krengi',
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
          // Clean out previous temporary demo names
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

  // Onboarding Form States (Email OTP Verification Only)
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
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
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUserBlocked, setIsUserBlocked] = useState(false);

  // YouTube-Style Speed Rate Limiting (10 messages per 40s)
  const [recentSendTimestamps, setRecentSendTimestamps] = useState<number[]>([]);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [rateLimitAlert, setRateLimitAlert] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);

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
    if (!trimmed) return null;
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

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  // Send 6-Digit Code to Devotee Email
  const handleSendEmailOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isOnboardingSubmitting) return;

    const nErr = validateName(nameInput);
    if (nErr) {
      setOnboardingError(nErr);
      return;
    }

    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail) {
      setOnboardingError('Please enter your Email ID (@gmail.com or @outlook.com).');
      return;
    }

    const eErr = validateEmail(trimmedEmail);
    if (eErr) {
      setOnboardingError(eErr);
      return;
    }

    setIsOnboardingSubmitting(true);
    setOnboardingError(null);

    try {
      const bodyParams = new URLSearchParams();
      bodyParams.append('name', nameInput.trim());
      bodyParams.append('email', trimmedEmail);

      const res = await fetch('./api/messages.php?action=send_email_otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: bodyParams.toString()
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

  // Verify 6-Digit Email Code
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
      const bodyParams = new URLSearchParams();
      bodyParams.append('name', nameInput.trim());
      bodyParams.append('email', emailInput.trim());
      bodyParams.append('otp', trimmedOtp);

      const res = await fetch('./api/messages.php?action=verify_email_otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: bodyParams.toString()
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
        try {
          localStorage.setItem('chhathi_chat_user_name', finalName);
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

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch messages from InfinityFree PHP + MySQL backend
  useEffect(() => {
    let isCancelled = false;

    const fetchMessages = async () => {
      try {
        const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;
        const res = await fetch(`./api/messages.php?action=get_messages&after_id=${lastId}&t=${Date.now()}`, {
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const text = await res.text();
          let data: any = null;
          try {
            data = JSON.parse(text);
          } catch {
            // Received non-JSON (e.g. security challenge or HTML error)
          }

          if (data && data.is_blocked) {
            setIsUserBlocked(true);
            setErrorMessage('Your IP address has been blocked for violating safety guidelines.');
          }

          if (data && data.success && Array.isArray(data.messages)) {
            if (!isCancelled) {
              setIsBackendConnected(true);
              if (data.messages.length > 0) {
                setMessages((prev) => {
                  const existingIds = new Set(prev.map((m) => m.id));
                  const newItems = data.messages.filter((m: ChatMessage) => !existingIds.has(m.id));
                  if (newItems.length === 0) return prev;
                  const updated = [...prev, ...newItems].slice(-100);
                  try {
                    localStorage.setItem('chhathi_cached_chat_v2', JSON.stringify(updated));
                  } catch {}
                  return updated;
                });
              }
            }
          }
        }
      } catch {
        // Backend not available (e.g. running on local dev without PHP)
        if (!isCancelled) {
          setIsBackendConnected(false);
        }
      }
    };

    let timeoutId: any = null;

    const scheduleNextPoll = () => {
      if (isCancelled) return;
      // If user minimized or switched tab, slow polling to 15s to save server load
      const baseDelay = document.hidden ? 15000 : 3500;
      // Random jitter avoids thundering herd problem for 40k+ users
      const jitter = Math.floor(Math.random() * 800);

      timeoutId = setTimeout(async () => {
        await fetchMessages();
        scheduleNextPoll();
      }, baseDelay + jitter);
    };

    fetchMessages().then(scheduleNextPoll);

    const handleVisibilityChange = () => {
      if (!document.hidden && !isCancelled) {
        fetchMessages();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [messages]);

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

    // Send to PHP + MySQL backend via native form params
    try {
      const bodyParams = new URLSearchParams();
      bodyParams.append('name', finalName);
      bodyParams.append('message', textToSend);

      const res = await fetch('./api/messages.php?action=send_message', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: bodyParams.toString()
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {}

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
        setIsBackendConnected(true);
        // Replace optimistic ID with real MySQL ID
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...data.message } : m))
        );
      }
    } catch {
      // Local fallback mode
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
        className="mb-6 flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs sm:text-sm font-medium text-white backdrop-blur-md shadow-lg transition-all active:scale-95 cursor-pointer"
        title="Back to Music Player"
      >
        <ChevronUp className="w-4 h-4" />
        <span>Back to Music Player</span>
      </button>

      {/* Main Glass Chat Card */}
      <div className="w-full max-w-2xl rounded-3xl bg-black/75 backdrop-blur-3xl border border-white/20 shadow-[0_16px_50px_rgba(0,0,0,0.85)] flex flex-col h-[75dvh] sm:h-[78dvh] overflow-hidden">
        
        {/* Chat Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/15 bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40">
              <MessageCircle className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-sm sm:text-base text-white tracking-wide">
              Public Chat
            </h2>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] text-white/80">
            <span
              className={`h-2 w-2 rounded-full ${
                isBackendConnected
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
              }`}
            />
            <span className="font-mono text-[10px]">
              {isBackendConnected ? 'MySQL Connected' : 'Live'}
            </span>
          </div>
        </div>

        {/* Safety Alert Banner */}
        {errorMessage && (
          <div className="mx-4 my-2 px-3.5 py-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center justify-between shadow-lg animate-in fade-in">
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
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5"
        >
          {messages.map((msg) => {
            const isAdmin =
              msg.name.toLowerCase() === 'admin' ||
              msg.name.toLowerCase().includes('admin');
            const isSelf = !isAdmin && userName && msg.name === userName;
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/25 border border-amber-400/50 text-[11px] sm:text-xs font-semibold text-amber-300 shadow-sm">
                      👑 By Admin
                    </span>
                  ) : (
                    <span className="text-[11px] sm:text-xs font-medium text-amber-300/90 font-devanagari">
                      {msg.name}
                    </span>
                  )}
                  {msg.time_formatted && (
                    <span className="text-[10px] text-white/40 font-mono">
                      {msg.time_formatted}
                    </span>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm text-white/95 leading-relaxed break-words shadow-md ${
                    isAdmin
                      ? 'bg-amber-950/40 border border-amber-400/50 rounded-tl-none ring-1 ring-amber-400/30 text-amber-50 shadow-[0_4px_16px_rgba(245,158,11,0.2)]'
                      : isSelf
                      ? 'bg-amber-500/25 border border-amber-400/40 rounded-tr-none'
                      : 'bg-white/10 border border-white/15 rounded-tl-none'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Section: Blocked State OR One-time Verification OR Active Chat Bar */}
        {isUserBlocked ? (
          <div className="p-4 border-t border-red-500/30 bg-red-950/60 text-center select-none">
            <span className="text-xs sm:text-sm text-red-300 font-medium">
              🔒 Access Denied: Your IP address has been permanently blocked due to violations of community safety rules.
            </span>
          </div>
        ) : !userName ? (
          <div className="p-4 sm:p-5 border-t border-white/15 bg-white/5 flex flex-col gap-3.5">
            {/* Header */}
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-white">
                  Devotee Verification & Onboarding
                </h4>
                <p className="text-[11px] text-white/60">
                  Verify your identity once with OTP or Email to join chat
                </p>
              </div>
            </div>

            {/* Privacy Caution Banner */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] sm:text-xs leading-relaxed text-amber-200/90">
                <strong className="text-amber-300">⚠️ Caution:</strong> We do not collect or store your private data (Phone Number / Email). We only verify this once to confirm real devotees and prevent bots / fake users.
              </div>
            </div>

            {/* Step 2: Entering 6-digit Email Verification Code */}
            {otpStep === 'otp_sent' ? (
              <form onSubmit={handleVerifyEmailOtp} className="flex flex-col gap-3 p-3.5 rounded-2xl bg-black/40 border border-amber-400/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium">
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
                    className="text-[10px] text-white/50 hover:text-white flex items-center gap-1 underline cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Edit Email
                  </button>
                </div>

                <p className="text-[11px] text-white/70">
                  Verification code dispatched to <strong className="text-white">{emailInput.trim()}</strong>.<br/>
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
                    className="w-full text-center tracking-[0.4em] font-mono font-bold text-lg py-2 rounded-xl bg-white/10 border border-white/20 text-amber-300 placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    autoFocus
                  />
                </div>

                {onboardingError && (
                  <div className="text-[11px] text-red-400 font-medium px-1 flex items-center gap-1.5 bg-red-950/40 p-2 rounded-lg border border-red-500/30">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{onboardingError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-white/60 px-0.5">
                  <span>Didn't receive code?</span>
                  {resendCountdown > 0 ? (
                    <span className="font-mono text-amber-300/80">Resend in {resendCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendEmailOtp()}
                      disabled={isOnboardingSubmitting}
                      className="text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer"
                    >
                      Resend Email Code
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={otpCode.length !== 6 || isVerifyingOtp}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs sm:text-sm font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
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
              /* Step 1: Real Name + Email ID Form */
              <form onSubmit={handleSendEmailOtp} className="flex flex-col gap-3">
                {/* Real Name Input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-white/80 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    Your Real Name <span className="text-amber-400">*</span>
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
                    className="w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    autoFocus
                  />
                </div>

                {/* Email Input */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-white/80 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-amber-400" />
                      Email ID <span className="text-amber-400">*</span>
                    </label>
                    <span className="text-[10px] text-amber-300/80">(@gmail or @outlook only)</span>
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
                    className="w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                {onboardingError && (
                  <div className="text-[11px] text-red-400 font-medium px-1 flex items-center gap-1.5 bg-red-950/40 p-2 rounded-lg border border-red-500/30">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{onboardingError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!nameInput.trim() || !emailInput.trim() || isOnboardingSubmitting}
                  className="mt-1 w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs sm:text-sm font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
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
          <div className="p-3 sm:p-4 border-t border-white/15 bg-white/5 flex flex-col gap-2">
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

            {/* User Status Bar */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-white/60">
                Posting as: <strong className="text-amber-300 font-medium">{userName}</strong>
              </span>
              <button
                onClick={() => {
                  setUserName('');
                  setNameInput('');
                  setEmailInput('');
                  try {
                    localStorage.removeItem('chhathi_chat_user_name');
                    localStorage.removeItem('chhathi_chat_user_email');
                  } catch {}
                }}
                className="text-[10px] text-white/40 hover:text-white/80 transition cursor-pointer underline"
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
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={cooldownSeconds > 0}
                placeholder={cooldownSeconds > 0 ? `Speed limit: please wait ${cooldownSeconds}s...` : "Type a message..."}
                maxLength={400}
                className="flex-1 px-4 py-2.5 rounded-full bg-white/10 border border-white/20 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-amber-400/60 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending || cooldownSeconds > 0}
                className="grid h-10 w-10 place-items-center rounded-full bg-amber-400 hover:bg-amber-300 text-black font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex-shrink-0"
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
