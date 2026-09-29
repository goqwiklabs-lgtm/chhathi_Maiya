import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  User,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  Mail,
  Phone,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
  Smile,
  Paperclip,
  Edit3,
  Trash2,
  Pin,
  Ban,
  Image as ImageIcon,
  Loader2,
  Check
} from 'lucide-react';

interface ChatMessage {
  id: number;
  name: string;
  message: string;
  avatar_url?: string | null;
  image_url?: string | null;
  sender_ip?: string | null;
  is_admin?: number | boolean;
  is_pinned?: number | boolean;
  time_formatted?: string;
  timestamp?: number;
}

// Pre-text Admin Notice Message matching upd/chatsys.png
const INITIAL_DEMO_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    name: 'Admin',
    message: 'Chhath Puja Aane wali hai! Taiyaar Rahee, Chhathi Maiya Apni Kripa sb par krengi 🙏🌅',
    is_admin: 1,
    time_formatted: '02:48 PM'
  }
];

const FESTIVE_EMOJIS = [
  '🪔', '🌅', '🙏', '🌺', '✨', '☀️', '🌊', '🥥', '🌾', '🍎',
  '❤️', '😊', '🙌', '👍', '🔥', '🎉', '🚩', '💐', '🔔', '🥭'
];

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
];

export const PublicChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('chhathi_cached_chat_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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

  const [userEmail, setUserEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('chhathi_chat_user_email') || '';
    } catch {
      return '';
    }
  });

  const [userAvatar, setUserAvatar] = useState<string>(() => {
    try {
      return localStorage.getItem('chhathi_chat_user_avatar') || '';
    } catch {
      return '';
    }
  });

  const [isAdminUser, setIsAdminUser] = useState<boolean>(() => {
    try {
      const em = (localStorage.getItem('chhathi_chat_user_email') || '').toLowerCase();
      const admToken = localStorage.getItem('chhathi_admin_jwt');
      return em === 'omkumar.working@gmail.com' || Boolean(admToken);
    } catch {
      return false;
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
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);

  // Mentions (@devotee)
  const [activeDevotees, setActiveDevotees] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);

  // Media Attachment (Images & GIFs up to 3MB)
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Emoji Drawer
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Edit Profile Modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [editAvatarInput, setEditAvatarInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Typing indicators
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const lastTypingPingRef = useRef<number>(0);

  // YouTube-Style Speed Rate Limiting (10 messages per 40s)
  const [recentSendTimestamps, setRecentSendTimestamps] = useState<number[]>([]);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [rateLimitAlert, setRateLimitAlert] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Sync profile from backend on mount (enforces 1 user per IP)
  useEffect(() => {
    const fetchCurrentProfile = async () => {
      try {
        const res = await fetch('./api/messages.php?action=get_profile', {
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.devotee) {
            const dev = data.devotee;
            if (dev.name && !userName) {
              setUserName(dev.name);
              try {
                localStorage.setItem('chhathi_chat_user_name', dev.name);
              } catch {}
            }
            if (dev.email) {
              setUserEmail(dev.email);
              try {
                localStorage.setItem('chhathi_chat_user_email', dev.email);
              } catch {}
            }
            if (dev.avatar_url) {
              setUserAvatar(dev.avatar_url);
              try {
                localStorage.setItem('chhathi_chat_user_avatar', dev.avatar_url);
              } catch {}
            }
            if (data.is_admin || dev.email?.toLowerCase() === 'omkumar.working@gmail.com') {
              setIsAdminUser(true);
            }
          }
        }
      } catch {}
    };
    fetchCurrentProfile();
  }, []);

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
        console.error('send_email_otp parse error:', text);
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
        console.error('verify_email_otp parse error:', text);
      }

      if (data && data.success) {
        const finalName = data.name || nameInput.trim();
        const finalEmail = data.email || emailInput.trim();
        setUserName(finalName);
        setUserEmail(finalEmail);
        if (data.avatar_url) setUserAvatar(data.avatar_url);
        if (data.is_admin || finalEmail.toLowerCase() === 'omkumar.working@gmail.com') {
          setIsAdminUser(true);
        }
        if (data.mysql_online !== undefined) {
          setIsDbOnline(Boolean(data.mysql_online));
        }
        try {
          localStorage.setItem('chhathi_chat_user_name', finalName);
          localStorage.setItem('chhathi_chat_user_email', finalEmail);
          localStorage.setItem('chhathi_chat_user_phone', phoneInput.trim());
          if (data.avatar_url) localStorage.setItem('chhathi_chat_user_avatar', data.avatar_url);
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
  }, [messages, typingUsers, attachedImageUrl]);

  // Realtime Polling Loop for Multi-Device Sync (PC & Phone)
  const fetchMessages = async () => {
    try {
      const res = await fetch(`./api/messages.php?action=get_messages&limit=60&name=${encodeURIComponent(userName)}&_t=${Date.now()}`, {
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

        if (data && data.pinned_message) {
          setPinnedMessage(data.pinned_message);
        } else if (data && data.pinned_message === null) {
          setPinnedMessage(null);
        }

        if (data && Array.isArray(data.active_devotees)) {
          setActiveDevotees(data.active_devotees);
        }

        if (data && Array.isArray(data.typing)) {
          const currentTypers = data.typing.filter((u: string) => u && u.toLowerCase() !== userName.toLowerCase());
          setTypingUsers(currentTypers);
        }

        if (data && data.success && Array.isArray(data.messages)) {
          const incoming: ChatMessage[] = data.messages;
          if (incoming.length > 0) {
            setMessages((prev) => {
              const map = new Map<number, ChatMessage>();
              prev.forEach((m) => map.set(m.id, m));
              incoming.forEach((m) => map.set(m.id, m));
              const combined = Array.from(map.values()).sort((a, b) => a.id - b.id).slice(-100);
              try {
                localStorage.setItem('chhathi_cached_chat_v3', JSON.stringify(combined));
              } catch {}
              return combined;
            });
          }
        }
      } else {
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

  // Broadcast typing status
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

  // Mention (@) input handler
  const handleInputChange = (val: string) => {
    setInputMessage(val);
    handleTyping();

    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && lastAt >= val.length - 20) {
      const query = val.slice(lastAt + 1).toLowerCase();
      if (!query.includes(' ')) {
        setMentionQuery(query);
        setShowMentionSuggestions(true);
        return;
      }
    }
    setShowMentionSuggestions(false);
  };

  const handleSelectMention = (name: string) => {
    if (!inputMessage) return;
    const lastAt = inputMessage.lastIndexOf('@');
    if (lastAt !== -1) {
      const before = inputMessage.slice(0, lastAt);
      setInputMessage(`${before}@${name} `);
    }
    setShowMentionSuggestions(false);
  };

  // File / Media Upload (Small Images & GIFs up to 3MB)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('File size exceeds maximum limit of 3MB.');
      return;
    }

    setIsUploadingMedia(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('./api/messages.php?action=upload_media', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
      });
      const data = await res.json();
      if (data && data.success && data.url) {
        setAttachedImageUrl(data.url);
      } else {
        alert(data?.error || 'Failed to upload media.');
      }
    } catch {
      alert('Error uploading media to server.');
    } finally {
      setIsUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText !== undefined ? customText : inputMessage).trim();
    if ((!textToSend && !attachedImageUrl) || isSending || isUserBlocked) return;

    // Rate limiting check (10 messages per 40s)
    const now = Date.now();
    const past40s = recentSendTimestamps.filter((t) => now - t < 40000);
    if (past40s.length >= 10 || cooldownSeconds > 0) {
      setCooldownSeconds(10);
      setRateLimitAlert('Your Message Speed is Fast Try after 10 Sec');
      return;
    }

    setIsSending(true);
    const finalName = userName.trim() || 'Devotee';
    const sentImage = attachedImageUrl;

    const tempId = Date.now();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      name: finalName,
      message: textToSend,
      avatar_url: userAvatar || null,
      image_url: sentImage,
      is_admin: isAdminUser ? 1 : 0,
      time_formatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Math.floor(Date.now() / 1000)
    };

    setMessages((prev) => {
      const updated = [...prev, optimisticMsg].slice(-100);
      try {
        localStorage.setItem('chhathi_cached_chat_v3', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (customText === undefined) {
      setInputMessage('');
    }
    setAttachedImageUrl(null);
    setShowEmojiPicker(false);
    setShowMentionSuggestions(false);

    setRecentSendTimestamps((prev) => [...prev.filter((t) => now - t < 40000), now]);

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
          message: textToSend,
          avatar_url: userAvatar || '',
          image_url: sentImage || '',
          email: userEmail
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
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...data.message } : m))
        );
        fetchMessages();
      }
    } catch {
      setIsDbOnline(false);
    } finally {
      setIsSending(false);
    }
  };

  // Admin Superpowers: Pin Message
  const handlePinMessage = async (msgId: number, pin: boolean) => {
    try {
      const res = await fetch('./api/messages.php?action=pin_message', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msgId, pinned: pin ? 1 : 0, email: userEmail })
      });
      const data = await res.json();
      if (data && data.success) {
        fetchMessages();
      } else {
        alert(data?.error || 'Failed to update pinned message.');
      }
    } catch {
      alert('Error updating pinned message.');
    }
  };

  // Admin Superpowers: Delete Message
  const handleDeleteMessage = async (msgId: number) => {
    if (!window.confirm('Delete this message from live chat?')) return;
    try {
      const res = await fetch('./api/messages.php?action=delete_message', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msgId, email: userEmail })
      });
      const data = await res.json();
      if (data && data.success) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
      }
    } catch {
      alert('Error deleting message.');
    }
  };

  // Admin Superpowers: Block Devotee
  const handleBlockDevotee = async (msg: ChatMessage) => {
    if (!window.confirm(`Permanently block IP for devotee "${msg.name}"?`)) return;
    try {
      const res = await fetch('./api/messages.php?action=block_devotee', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: msg.sender_ip, message_id: msg.id, email: userEmail })
      });
      const data = await res.json();
      if (data && data.success) {
        alert(`Devotee IP (${data.blocked_ip}) blocked permanently.`);
        fetchMessages();
      }
    } catch {
      alert('Error blocking devotee.');
    }
  };

  // Save Profile (Username & Avatar)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = editNameInput.trim();
    const cleanAvatar = editAvatarInput.trim();

    const nErr = validateName(cleanName);
    if (nErr) {
      alert(nErr);
      return;
    }

    setIsSavingProfile(true);
    setProfileSuccessMsg(null);

    try {
      const res = await fetch('./api/messages.php?action=update_profile', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, avatar_url: cleanAvatar })
      });
      const data = await res.json();
      if (data && data.success) {
        setUserName(cleanName);
        setUserAvatar(cleanAvatar);
        try {
          localStorage.setItem('chhathi_chat_user_name', cleanName);
          localStorage.setItem('chhathi_chat_user_avatar', cleanAvatar);
        } catch {}
        setProfileSuccessMsg('Profile updated successfully!');
        setTimeout(() => {
          setIsEditProfileOpen(false);
          setProfileSuccessMsg(null);
        }, 1200);
      } else {
        alert(data?.error || 'Failed to update profile.');
      }
    } catch {
      alert('Error updating profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Open Edit Profile Modal
  const handleOpenEditProfile = () => {
    setEditNameInput(userName);
    setEditAvatarInput(userAvatar);
    setIsEditProfileOpen(true);
  };

  // Render message with highlighted @mentions
  const renderMessageContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@[a-zA-Z0-9_\u0900-\u097F]+(?:\s+[a-zA-Z0-9_\u0900-\u097F]+)?)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            className="inline-block px-1.5 py-0.5 mx-0.5 rounded-md bg-[#eaddc5] text-[#5e3810] font-semibold text-[12px] sm:text-[13px] border border-[#cbba98]"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section
      id="public-chat-section"
      className="relative z-20 min-h-[90dvh] w-full flex flex-col items-center justify-start px-3 sm:px-6 py-6 sm:py-10 select-none"
    >
      {/* Back to Music Player Button */}
      <button
        onClick={handleScrollToTop}
        className="mb-5 flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#f4ebe1]/90 hover:bg-[#ece1d4] border border-[#d6c4a5] text-xs sm:text-sm font-medium text-[#734b1a] backdrop-blur-md shadow-sm transition-all active:scale-95 cursor-pointer"
        title="Back to Music Player"
      >
        <ChevronUp className="w-4 h-4 text-[#8c5a27]" />
        <span>Back to Music Player</span>
      </button>

      {/* Main Glass Chat Card - Warm Light Golden-Amber Theme from upd/chatsys.png */}
      <div className="w-full max-w-2xl rounded-[32px] bg-[#faf5eb]/95 backdrop-blur-2xl border border-[#ded0b6] shadow-[0_12px_45px_rgba(150,100,30,0.12)] flex flex-col h-[76dvh] sm:h-[80dvh] overflow-hidden">
        
        {/* Chat Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-[#e8ddc7] bg-[#f7efe0]/90">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-[#d8c8a8] bg-[#f5ede0] text-[#7d541f] shadow-inner">
              <MessageCircle className="w-5 h-5 text-[#8c5a27]" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-[#6e4618] tracking-wide">
                Chhath Maiya Public Chat
              </h2>
              <span className="text-[11px] text-[#9c7a4d] font-mono">Live Devotee Community</span>
            </div>
          </div>

          {/* MySQL Status Pill (Exact Match to upd/chatsys.png) */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#cbb58a] bg-gradient-to-b from-[#f3e7ce] to-[#dfcb9f] text-[#5c3e17] text-[11px] font-medium shadow-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                isDbOnline
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]'
                  : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse'
              }`}
            />
            <span className="font-mono text-[10px] sm:text-[11px]">
              {isDbOnline ? 'MySQL Online' : 'MySQL Offline'}
            </span>
          </div>
        </div>

        {/* Pinned Announcement Sticky Banner */}
        {pinnedMessage && (
          <div className="mx-4 mt-2.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-[#f3e7ce] via-[#f9f2e5] to-[#f3e7ce] border border-[#d4be95] shadow-sm flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <Pin className="w-4 h-4 text-[#8a5d24] flex-shrink-0" />
              <div className="text-xs text-[#523714] truncate">
                <strong className="font-semibold text-[#7c5025]">Pinned Notice: </strong>
                <span>{pinnedMessage.message}</span>
              </div>
            </div>
            {isAdminUser && (
              <button
                onClick={() => handlePinMessage(pinnedMessage.id, false)}
                className="text-[10px] text-[#8a5d24] hover:underline flex-shrink-0 ml-2 cursor-pointer font-medium"
              >
                Unpin
              </button>
            )}
          </div>
        )}

        {/* Database Maintenance Mode Banner */}
        {!isDbOnline && (
          <div className="mx-4 mt-2.5 px-3.5 py-2.5 rounded-2xl bg-[#fee2e2] border border-[#f87171] text-[#991b1b] text-xs sm:text-sm flex items-center gap-2.5 shadow-sm animate-pulse">
            <AlertTriangle className="w-4 h-4 text-[#dc2626] flex-shrink-0" />
            <span className="font-semibold tracking-wide">
              Database is in Maintenance Mode! Try After sometime
            </span>
          </div>
        )}

        {/* Safety Error Alert Banner */}
        {errorMessage && (
          <div className="mx-4 my-2 px-3.5 py-2 rounded-xl bg-red-100 border border-red-300 text-red-800 text-xs flex items-center justify-between shadow-sm animate-in fade-in">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-700 hover:text-red-950 text-xs ml-2 cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Messages Stream */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 scroll-smooth bg-[#faf5eb]/70"
        >
          {messages.map((msg) => {
            const isAdminMsg =
              msg.is_admin ||
              msg.name.toLowerCase() === 'admin' ||
              msg.name.toLowerCase().includes('admin');
            const isSelf = !isAdminMsg && userName && msg.name.toLowerCase() === userName.toLowerCase();

            return (
              <div
                key={msg.id}
                className={`group relative flex flex-col ${
                  isAdminMsg ? 'items-start' : isSelf ? 'items-end' : 'items-start'
                } transition-opacity duration-200`}
              >
                {/* Header: Sender Name, Avatar & Timestamp */}
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  {isAdminMsg ? (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-gradient-to-b from-[#b88349] to-[#8c5a27] text-amber-50 text-[11px] font-semibold shadow-sm">
                      👑 By Admin
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {msg.avatar_url ? (
                        <img
                          src={msg.avatar_url}
                          alt={msg.name}
                          className="w-5 h-5 rounded-full object-cover border border-[#d6c7b0]"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[#eadecb] text-[#735229] font-bold text-[10px] flex items-center justify-center">
                          {msg.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <button
                        onClick={() => handleSelectMention(msg.name)}
                        className="text-[11px] sm:text-xs font-semibold text-[#6e4618] hover:text-[#b45309] hover:underline cursor-pointer font-devanagari transition"
                        title={`Mention @${msg.name}`}
                      >
                        {msg.name}
                      </button>
                    </div>
                  )}

                  {msg.time_formatted && (
                    <span className="text-[10px] text-[#9c8266] font-mono">
                      {msg.time_formatted}
                    </span>
                  )}

                  {/* Admin Actions on hover */}
                  {isAdminUser && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2 bg-[#f4ebe1] px-1.5 py-0.5 rounded-md border border-[#d8c8a8]">
                      <button
                        onClick={() => handlePinMessage(msg.id, !msg.is_pinned)}
                        title={msg.is_pinned ? 'Unpin Message' : 'Pin Message'}
                        className="text-[#8c5a27] hover:text-black"
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="Delete Message"
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleBlockDevotee(msg)}
                        title="Block Devotee IP"
                        className="text-red-700 hover:text-red-900"
                      >
                        <Ban className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[88%] sm:max-w-[78%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words shadow-sm ${
                    isAdminMsg
                      ? 'bg-gradient-to-r from-[#ece4d6] to-[#e4dac8] border border-[#d6c7b0] text-[#332616] rounded-tl-sm shadow-[0_2px_8px_rgba(100,70,30,0.08)]'
                      : isSelf
                      ? 'bg-gradient-to-b from-[#d98b2c] to-[#b36916] text-white rounded-tr-sm shadow-md shadow-amber-900/15'
                      : 'bg-[#fcfaf5] border border-[#e8decb] text-[#2b1f13] rounded-tl-sm'
                  }`}
                >
                  {renderMessageContent(msg.message)}

                  {/* Attached Media Image / GIF */}
                  {msg.image_url && (
                    <div className="mt-2">
                      <img
                        src={msg.image_url}
                        alt="Attached media"
                        className="max-h-56 rounded-xl border border-black/10 object-cover shadow-sm"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* WhatsApp / Instagram Style 3 Bouncing Dots Bubble in Chat Stream */}
          {typingUsers.length > 0 && (
            <div className="flex items-end gap-2 my-1.5 animate-in fade-in duration-200">
              <div className="w-7 h-7 rounded-full bg-[#f0e4d0] border border-[#d8c8a8] flex items-center justify-center text-[11px] font-bold text-[#7d541f] uppercase shadow-sm">
                {typingUsers[0].charAt(0)}
              </div>
              <div className="bg-[#fcfaf5] border border-[#e8decb] px-3.5 py-2.5 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#d98b2c] animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-[#b8761d] animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-[#8c5a27] animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section: Blocked State OR Devotee Onboarding OR Active Chat Input */}
        {isUserBlocked ? (
          <div className="p-4 border-t border-red-300 bg-red-50 text-center select-none">
            <span className="text-xs sm:text-sm text-red-800 font-medium">
              🔒 Access Denied: Your IP address has been permanently blocked due to violations of community safety rules.
            </span>
          </div>
        ) : !userName ? (
          /* Devotee Verification & Onboarding Card - Styled with Warm Golden Cream */
          <div className="p-4 sm:p-6 border-t border-[#e8ddc7] bg-[#f8f1e5] flex flex-col gap-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#8c5a27] flex-shrink-0" />
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-[#5c3e17]">
                  Devotee Verification & Onboarding
                </h4>
                <p className="text-[11px] text-[#9c7a4d]">
                  Verify your identity once via Email OTP to join public chat
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#faeee0] border border-[#e8cdb0] text-[#7a4918] text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#b45309] flex-shrink-0 mt-0.5" />
              <div className="text-[11px] sm:text-xs leading-relaxed">
                <strong className="text-[#8c5a27]">Secure Devotee Join:</strong> Enter your Name, Email, and Phone number. Only Email receives the 6-digit verification code. Strictly 1 user per IP.
              </div>
            </div>

            {otpStep === 'otp_sent' ? (
              <form onSubmit={handleVerifyEmailOtp} className="flex flex-col gap-3 p-3.5 rounded-2xl bg-[#fffdf9] border border-[#decbb2] shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-[#734b1a] font-medium">
                    <KeyRound className="w-4 h-4 text-[#8c5a27]" />
                    <span>Enter 6-Digit Email Code</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('input');
                      setOtpCode('');
                      setOnboardingError(null);
                    }}
                    className="text-[10px] text-[#8c5a27] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Edit Details
                  </button>
                </div>

                <p className="text-[11px] text-[#5e4222]">
                  Verification code dispatched to <strong className="text-[#8c5a27]">{emailInput.trim()}</strong>.<br/>
                  Please check your inbox or spam folder and enter the 6-digit code:
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
                    className="w-full text-center tracking-[0.4em] font-mono font-bold text-lg py-2 rounded-xl bg-[#faf5eb] border border-[#d6c4a5] text-[#5c3e17] placeholder-black/20 focus:outline-none focus:ring-1 focus:ring-[#c29e61]"
                    autoFocus
                  />
                </div>

                {onboardingError && (
                  <div className="text-[11px] text-red-700 font-medium px-2 py-1.5 rounded-lg bg-red-100 border border-red-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{onboardingError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-[#734b1a] px-0.5">
                  <span>Didn't receive code?</span>
                  {resendCountdown > 0 ? (
                    <span className="font-mono text-[#8c5a27]">Resend in {resendCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendEmailOtp()}
                      disabled={isOnboardingSubmitting}
                      className="text-[#8c5a27] hover:underline font-semibold cursor-pointer"
                    >
                      Resend Email Code
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={otpCode.length !== 6 || isVerifyingOtp}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#dca248] to-[#b8761d] hover:from-[#e4ad55] hover:to-[#c68224] text-white text-xs sm:text-sm font-semibold shadow-md transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
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
              <form onSubmit={handleSendEmailOtp} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[#5c3e17] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#8c5a27]" />
                    Your Real Name (नाम) <span className="text-red-500">*</span>
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
                    className="w-full px-3.5 py-2 rounded-xl bg-[#faf5eb] border border-[#d6c4a5] text-xs sm:text-sm text-[#382b1d] placeholder-[#a69780] focus:outline-none focus:ring-1 focus:ring-[#c29e61]"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-[#5c3e17] flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#8c5a27]" />
                      Email ID (ईमेल - OTP received here) <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-[#9c7a4d]">(@gmail / @outlook only)</span>
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
                    className="w-full px-3.5 py-2 rounded-xl bg-[#faf5eb] border border-[#d6c4a5] text-xs sm:text-sm text-[#382b1d] placeholder-[#a69780] focus:outline-none focus:ring-1 focus:ring-[#c29e61]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-[#5c3e17] flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#8c5a27]" />
                      Mobile Number (मोबाइल नंबर - Required) <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-[#9c7a4d]">(10-digit Indian Mobile)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-2 rounded-xl bg-[#faf5eb] border border-[#d6c4a5] text-xs font-mono text-[#734b1a]">
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
                      className="flex-1 px-3.5 py-2 rounded-xl bg-[#faf5eb] border border-[#d6c4a5] text-xs sm:text-sm text-[#382b1d] placeholder-[#a69780] focus:outline-none focus:ring-1 focus:ring-[#c29e61] font-mono"
                    />
                  </div>
                </div>

                {onboardingError && (
                  <div className="text-[11px] text-red-700 font-medium px-2 py-1.5 rounded-lg bg-red-100 border border-red-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{onboardingError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!nameInput.trim() || !emailInput.trim() || !phoneInput.trim() || isOnboardingSubmitting}
                  className="mt-1 w-full py-2.5 rounded-xl bg-gradient-to-b from-[#dca248] to-[#b8761d] hover:from-[#e4ad55] hover:to-[#c68224] text-white text-xs sm:text-sm font-semibold shadow-md transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
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
          /* Active Chat Input Area matching upd/chatsys.png */
          <div className="p-3 sm:p-4 border-t border-[#e8ddc7] bg-[#f8f1e5]/90 flex flex-col gap-2">
            {/* Speed warning */}
            {cooldownSeconds > 0 && (
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-xs sm:text-sm animate-pulse shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span className="font-semibold">
                    Your Message Speed is Fast Try after {cooldownSeconds} Sec
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-mono text-xs">
                  {cooldownSeconds}s
                </span>
              </div>
            )}

            {/* Discord-Style Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 px-2 py-0.5 text-xs text-[#8c5a27] font-medium animate-pulse">
                <span className="w-2 h-2 rounded-full bg-[#d98b2c] shadow-[0_0_6px_rgba(217,139,44,0.8)]"></span>
                <span>
                  {typingUsers.length === 1
                    ? `${typingUsers[0]} is typing...`
                    : `${typingUsers.slice(0, 2).join(', ')} are typing...`}
                </span>
              </div>
            )}

            {/* Mention Suggestions Popup */}
            {showMentionSuggestions && activeDevotees.length > 0 && (
              <div className="p-2 rounded-2xl bg-[#fffdfa] border border-[#d6c4a5] shadow-lg flex flex-col gap-1 max-h-36 overflow-y-auto animate-in fade-in">
                <span className="text-[10px] text-[#9c7a4d] px-2 font-mono">Select Devotee to Mention:</span>
                {activeDevotees
                  .filter((d) => !mentionQuery || d.toLowerCase().includes(mentionQuery))
                  .slice(0, 5)
                  .map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleSelectMention(d)}
                      className="px-2.5 py-1 rounded-lg text-left text-xs text-[#5c3e17] hover:bg-[#faeee0] flex items-center gap-1.5 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-[#8c5a27]" />
                      <span>{d}</span>
                    </button>
                  ))}
              </div>
            )}

            {/* Attached Media Preview */}
            {attachedImageUrl && (
              <div className="relative inline-flex items-center gap-2 p-1.5 rounded-xl bg-white border border-[#d6c4a5] shadow-sm max-w-fit">
                <img
                  src={attachedImageUrl}
                  alt="Attachment preview"
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div className="text-[11px] text-[#5c3e17] pr-2">
                  <span className="font-semibold">Image Attached</span>
                  <p className="text-[10px] text-[#9c7a4d]">Ready to send with message</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedImageUrl(null)}
                  className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center cursor-pointer shadow hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Sub-bar matching upd/chatsys.png */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] sm:text-xs text-[#734b1a]">
                  Posting as: <strong className="text-[#5c3e17] font-semibold">{userName}</strong>
                </span>

                {/* Emoji button */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  title="Festive Emojis"
                  className="text-[#8c5a27] hover:text-[#5c3e17] transition cursor-pointer p-0.5 rounded"
                >
                  <Smile className="w-4 h-4" />
                </button>

                {/* Paperclip attachment button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach Image or GIF (up to 3MB)"
                  disabled={isUploadingMedia}
                  className="text-[#8c5a27] hover:text-[#5c3e17] transition cursor-pointer p-0.5 rounded disabled:opacity-50"
                >
                  {isUploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                />
              </div>

              {/* Edit Profile Button (Replaces "Change Details" per user instruction) */}
              <button
                type="button"
                onClick={handleOpenEditProfile}
                className="text-[11px] text-[#8c5a27] hover:text-[#5c3e17] hover:underline font-medium cursor-pointer flex items-center gap-1"
                title="Edit Username and Avatar Profile"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            </div>

            {/* Emoji Drawer Popover */}
            {showEmojiPicker && (
              <div className="p-2.5 rounded-2xl bg-[#fffdfa] border border-[#d6c4a5] shadow-lg grid grid-cols-10 gap-1.5 animate-in fade-in">
                {FESTIVE_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      setInputMessage((prev) => prev + em);
                      setShowEmojiPicker(false);
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-[#faeee0] text-base sm:text-lg flex items-center justify-center transition active:scale-95 cursor-pointer"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            {/* Text Input & Pill Send Button matching upd/chatsys.png */}
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
                onChange={(e) => handleInputChange(e.target.value)}
                disabled={cooldownSeconds > 0}
                placeholder={cooldownSeconds > 0 ? `Speed limit: please wait ${cooldownSeconds}s...` : "Type your message here..."}
                maxLength={400}
                className="flex-1 px-5 py-3 rounded-full bg-[#fbf9f4] border border-[#d8c8a8] text-xs sm:text-sm text-[#382b1d] placeholder-[#aa9980] focus:outline-none focus:ring-1 focus:ring-[#c29e61] shadow-inner disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={(!inputMessage.trim() && !attachedImageUrl) || isSending || cooldownSeconds > 0}
                className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-[#dca248] to-[#b8761d] hover:from-[#e4ad55] hover:to-[#c68224] text-white font-semibold shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex-shrink-0"
                title="Send Message"
                aria-label="Send Message"
              >
                <Send className="w-4 h-4 fill-current ml-0.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Edit Profile Modal (User can change username & upload avatar) */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-[#fbf7ee] border border-[#d6c4a5] shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-[#5c3e17] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#8c5a27]" />
                Edit Devotee Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="text-[#9c7a4d] hover:text-[#5c3e17] text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#5c3e17] font-medium">Display Name (Username)</label>
                <input
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  required
                  maxLength={30}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#faf5eb] border border-[#d6c4a5] text-xs text-[#382b1d] focus:outline-none focus:ring-1 focus:ring-[#c29e61]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#5c3e17] font-medium">Avatar Profile Image URL</label>
                <input
                  type="url"
                  value={editAvatarInput}
                  onChange={(e) => setEditAvatarInput(e.target.value)}
                  placeholder="https://... image url"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#faf5eb] border border-[#d6c4a5] text-xs text-[#382b1d] focus:outline-none focus:ring-1 focus:ring-[#c29e61]"
                />
              </div>

              {/* Quick Pick Presets */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-[#9c7a4d]">Or choose a devotee avatar:</span>
                <div className="flex items-center gap-2">
                  {DEFAULT_AVATARS.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEditAvatarInput(av)}
                      className={`w-9 h-9 rounded-full overflow-hidden border-2 transition ${
                        editAvatarInput === av ? 'border-[#b8761d] scale-105' : 'border-transparent'
                      }`}
                    >
                      <img src={av} alt="avatar option" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {profileSuccessMsg && (
                <div className="p-2 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#ece1d4] hover:bg-[#e4d6c7] text-xs text-[#5c3e17]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 rounded-xl bg-gradient-to-b from-[#dca248] to-[#b8761d] hover:from-[#e4ad55] hover:to-[#c68224] text-white text-xs font-semibold shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
