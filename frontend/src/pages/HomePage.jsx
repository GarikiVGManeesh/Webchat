import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiMessageSquare,
  FiPhone,
  FiShield,
  FiImage,
  FiZap,
  FiVideo,
  FiArrowRight,
  FiSend,
  FiUsers,
  FiSmile,
  FiClock,
  FiShare2
} from 'react-icons/fi';

// ==================== INTERSECTION OBSERVER HOOK ====================
const useInView = (options = {}) => {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.15, ...options });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, isInView];
};

// ==================== ANIMATED COUNTER ====================
const AnimatedCounter = ({ end, duration = 2000, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const [ref, isInView] = useInView();

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
};

// ==================== NAVBAR ====================
const Navbar = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'glass shadow-lg shadow-primary-900/5' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <div className="flex items-center gap-2.5 group cursor-pointer">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 transition-shadow duration-300">
              <img src="/mahaa-logo.svg" alt="Mahaa Verse" className="w-full h-full" />
            </div>
            <span className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">
              Mahaa <span className="gradient-text">Verse</span>
            </span>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:inline-flex items-center px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-500/10 rounded-full transition-all duration-200"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="btn-primary inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 text-sm font-semibold"
            >
              Get Started
              <FiArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

// ==================== FLOATING PARTICLES BACKGROUND ====================
const ParticleBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Gradient orbs */}
    <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary-400/20 dark:bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow" />
    <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-secondary-400/20 dark:bg-secondary-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-400/10 dark:bg-accent-400/5 rounded-full blur-3xl" />

    {/* Dot grid pattern */}
    <div className="absolute inset-0 opacity-30 dark:opacity-20" style={{
      backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.22) 1px, transparent 1px)',
      backgroundSize: '40px 40px'
    }} />

    {/* Floating glass chips */}
    <div className="absolute top-24 left-[10%] w-12 h-12 glass rounded-2xl rounded-bl-md opacity-60 animate-float" style={{ animationDelay: '0s', animationDuration: '4s' }} />
    <div className="absolute top-44 right-[14%] w-9 h-9 glass rounded-2xl rounded-br-md opacity-50 animate-float" style={{ animationDelay: '1s', animationDuration: '5s' }} />
    <div className="absolute bottom-32 left-[18%] w-10 h-10 glass rounded-2xl rounded-bl-md opacity-40 animate-float" style={{ animationDelay: '2s', animationDuration: '4.5s' }} />
    <div className="absolute top-64 left-[68%] w-6 h-6 glass rounded-xl rounded-tl-md opacity-50 animate-float" style={{ animationDelay: '0.5s', animationDuration: '3.5s' }} />
    <div className="absolute bottom-48 right-[24%] w-14 h-14 glass rounded-2xl rounded-br-md opacity-40 animate-float" style={{ animationDelay: '1.5s', animationDuration: '5.5s' }} />
    <div className="absolute top-[32%] left-[5%] w-5 h-5 bg-secondary-300/40 dark:bg-secondary-500/20 rounded-full opacity-60 animate-float" style={{ animationDelay: '2.5s', animationDuration: '3s' }} />
    <div className="absolute bottom-[22%] right-[7%] w-7 h-7 bg-accent-300/40 dark:bg-accent-500/20 rounded-full opacity-50 animate-float" style={{ animationDelay: '3s', animationDuration: '4s' }} />
  </div>
);

// ==================== HERO SECTION ====================
const HeroSection = () => {
  const navigate = useNavigate();
  const [typedText, setTypedText] = useState('');
  const fullText = 'Connect. Chat. Share.';

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      <ParticleBackground />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left content */}
          <div className="text-center lg:text-left space-y-6 sm:space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-sm font-semibold text-primary-600 dark:text-primary-300 animate-fade-in-down">
              <FiZap className="w-4 h-4" />
              <span>Lightning-fast messaging</span>
            </div>

            {/* Main heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-gray-900 dark:text-white leading-tight animate-fade-in-up">
              Conversations that
              <br />
              <span className="gradient-text">feel effortless</span>
            </h1>

            {/* Typed tagline */}
            <div className="h-12 flex items-center justify-center lg:justify-start">
              <p className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-600 dark:text-gray-300">
                {typedText}
                <span className="inline-block w-0.5 h-7 bg-primary-500 ml-1 animate-pulse" />
              </p>
            </div>

            {/* Description */}
            <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-lg mx-auto lg:mx-0 animate-fade-in-up" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
              Real-time messaging with crystal-clear voice &amp; video calls, stories,
              and vanishing messages — wrapped in a beautiful, modern interface.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 animate-fade-in-up" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
              <button
                onClick={() => navigate('/signup')}
                className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 text-base font-bold text-white rounded-full transition-all duration-300 hover:scale-105 active:scale-95 animate-glow"
                style={{
                  background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
                  boxShadow: '0 12px 32px -10px rgba(124, 58, 237, 0.6)',
                }}
              >
                Get Started Free
                <FiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-gray-700 dark:text-gray-200 glass rounded-full hover:scale-105 active:scale-95 transition-all duration-200"
              >
                Sign In
              </button>
            </div>

            {/* Social proof */}
            <div className="flex items-center justify-center lg:justify-start gap-6 pt-4 animate-fade-in-up" style={{ animationDelay: '0.7s', animationFillMode: 'both' }}>
              <div className="flex -space-x-3">
                {[
                  'bg-gradient-to-br from-primary-400 to-primary-600',
                  'bg-gradient-to-br from-secondary-400 to-secondary-600',
                  'bg-gradient-to-br from-accent-400 to-accent-600',
                  'bg-gradient-to-br from-amber-400 to-orange-500',
                ].map((color, i) => (
                  <div key={i} className={`w-9 h-9 rounded-full ${color} border-2 border-white dark:border-dark-900 flex items-center justify-center shadow-md`}>
                    <FiUsers className="w-4 h-4 text-white" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-bold text-gray-800 dark:text-gray-200">10,000+</span> users already connected
              </p>
            </div>
          </div>

          {/* Right side - Chat mockup */}
          <div className="hidden lg:flex items-center justify-center animate-fade-in-up" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
            <ChatMockup />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
        <div className="w-6 h-10 glass rounded-full flex items-start justify-center p-1.5">
          <div className="w-1.5 h-3 bg-primary-400 rounded-full animate-slide-up" />
        </div>
      </div>
    </section>
  );
};

// ==================== CHAT MOCKUP ====================
const ChatMockup = () => (
  <div className="relative w-full max-w-sm">
    {/* Glow effects behind mockup */}
    <div className="absolute -inset-4 bg-gradient-to-r from-primary-400/25 via-secondary-400/15 to-accent-400/25 rounded-[3rem] blur-2xl" />

    {/* Phone frame */}
    <div className="relative glass rounded-[2.5rem] shadow-2xl shadow-primary-900/10 dark:shadow-black/40 overflow-hidden animate-float" style={{ animationDuration: '6s' }}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-6 py-3 glass border-b border-primary-500/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Alex Johnson</p>
            <p className="text-xs text-green-600 dark:text-green-400">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center">
            <FiPhone className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center">
            <FiVideo className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div className="p-4 space-y-3 bg-white/30 dark:bg-white/[0.02] min-h-[280px] chat-wallpaper">
        <div className="flex justify-start">
          <div className="message-bubble-received">
            <p className="text-sm">Hey! Have you tried Mahaa Verse yet? 🚀</p>
            <p className="text-[10px] text-gray-400 mt-1">10:42 AM</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="message-bubble-sent">
            <p className="text-sm text-white">Yes! The video calls are crystal clear ✨</p>
            <p className="text-[10px] text-white/70 mt-1">10:43 AM</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="message-bubble-received">
            <p className="text-sm">Vanish mode is such a cool feature 😎</p>
            <p className="text-[10px] text-gray-400 mt-1">10:44 AM</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="message-bubble-sent">
            <p className="text-sm text-white">Best messaging app I&apos;ve used! 💯</p>
            <p className="text-[10px] text-white/70 mt-1">10:44 AM</p>
          </div>
        </div>

        {/* Typing indicator */}
        <div className="flex justify-start">
          <div className="message-bubble-received">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-typing-dot" />
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-typing-dot" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-typing-dot" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-3 glass border-t border-primary-500/10">
        <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center">
          <FiSmile className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1 bg-white/40 dark:bg-white/5 rounded-full px-4 py-2 border border-primary-500/10">
          <p className="text-xs text-gray-400">Type a message...</p>
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md shadow-primary-500/30" style={{ background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)' }}>
          <FiSend className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  </div>
);

// ==================== FEATURES SECTION ====================
const features = [
  {
    icon: FiMessageSquare,
    title: 'Real-time Messaging',
    description: 'Send text, emojis, and reactions instantly with read receipts and typing indicators.',
    color: 'from-primary-400 to-primary-600',
    bgColor: 'bg-primary-500/10',
  },
  {
    icon: FiVideo,
    title: 'Voice & Video Calls',
    description: 'Crystal-clear HD voice and video calls with mute and camera controls.',
    color: 'from-secondary-400 to-secondary-600',
    bgColor: 'bg-secondary-500/10',
  },
  {
    icon: FiClock,
    title: 'Vanish Mode',
    description: 'Messages that disappear — choose 5 minutes or up to 7 days. Privacy in your control.',
    color: 'from-accent-400 to-accent-600',
    bgColor: 'bg-accent-500/10',
  },
  {
    icon: FiImage,
    title: 'Rich Media Sharing',
    description: 'Share photos, videos, documents, voice notes, and stories with lightning-fast delivery.',
    color: 'from-amber-400 to-orange-500',
    bgColor: 'bg-amber-500/10',
  },
];

const FeaturesSection = () => {
  const [sectionRef, sectionInView] = useInView();

  return (
    <section ref={sectionRef} className="relative py-20 sm:py-32 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/20 to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className={`text-center mb-16 transition-all duration-700 ${sectionInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 glass rounded-full text-sm font-semibold text-primary-600 dark:text-primary-300 mb-4">
            <FiZap className="w-3.5 h-3.5" />
            Features
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
            Everything you need to
            <br />
            <span className="gradient-text">stay connected</span>
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Packed with powerful features designed to make communication effortless,
            secure, and enjoyable.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} index={index} parentInView={sectionInView} />
          ))}
        </div>
      </div>
    </section>
  );
};

const FeatureCard = ({ feature, index, parentInView }) => {
  const Icon = feature.icon;

  return (
    <div
      className={`group relative p-6 sm:p-8 glass rounded-[2rem] transition-all duration-500 hover:shadow-xl hover:shadow-primary-500/10 hover:-translate-y-2 ${
        parentInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      <div className="relative z-10">
        {/* Icon */}
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${feature.bgColor} mb-5 group-hover:scale-110 transition-transform duration-300`}>
          <div className={`bg-gradient-to-br ${feature.color} p-2.5 rounded-xl shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feature.description}</p>
      </div>
    </div>
  );
};

// ==================== HOW IT WORKS SECTION ====================
const steps = [
  {
    number: '01',
    title: 'Create your account',
    description: 'Sign up in seconds with your email. No phone number required.',
    icon: FiUsers,
  },
  {
    number: '02',
    title: 'Find your friends',
    description: 'Search by username or invite friends directly with a link.',
    icon: FiMessageSquare,
  },
  {
    number: '03',
    title: 'Start chatting',
    description: 'Send messages, make calls, and share media instantly.',
    icon: FiZap,
  },
];

const HowItWorksSection = () => {
  const [sectionRef, sectionInView] = useInView();

  return (
    <section ref={sectionRef} className="relative py-20 sm:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className={`text-center mb-16 transition-all duration-700 ${sectionInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 glass rounded-full text-sm font-semibold text-secondary-600 dark:text-secondary-300 mb-4">
            <FiZap className="w-3.5 h-3.5" />
            How it works
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
            Get started in
            <br />
            <span className="gradient-text">three simple steps</span>
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            From signup to your first message in under a minute.
          </p>
        </div>

        {/* Steps */}
        <div className="relative max-w-4xl mx-auto">
          {/* Connecting line (desktop) */}
          <div className="hidden lg:block absolute top-24 left-[16%] right-[16%] h-0.5">
            <div className={`h-full bg-gradient-to-r from-primary-400 via-secondary-400 to-accent-400 rounded-full transition-all duration-1000 ${sectionInView ? 'scale-x-100' : 'scale-x-0'}`} style={{ transformOrigin: 'left' }} />
          </div>

          <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={index}
                  className={`relative text-center transition-all duration-700 ${sectionInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                  style={{ transitionDelay: `${index * 200 + 200}ms` }}
                >
                  {/* Step circle */}
                  <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full opacity-15 animate-pulse-slow" />
                    <div className="relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/30" style={{ background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)' }}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    {/* Step number badge */}
                    <div className="absolute -top-1 -right-1 w-7 h-7 glass border-2 border-primary-400 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-primary-600 dark:text-primary-300">{step.number}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

// ==================== STATS SECTION ====================
const StatsSection = () => {
  const [ref, inView] = useInView();

  return (
    <section ref={ref} className="relative py-16 sm:py-20 overflow-hidden">
      {/* Glass band */}
      <div className="absolute inset-0 mx-4 sm:mx-8 lg:mx-16 rounded-[3rem] glass shadow-xl shadow-primary-900/5" />
      {/* Pattern overlay */}
      <div className="absolute inset-0 mx-4 sm:mx-8 lg:mx-16 rounded-[3rem] opacity-10" style={{
        backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.6) 1px, transparent 1px)',
        backgroundSize: '30px 30px'
      }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-8 py-12 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {[
            { value: 10, suffix: 'K+', label: 'Active Users' },
            { value: 5, suffix: 'M+', label: 'Messages Sent' },
            { value: 99.9, suffix: '%', label: 'Uptime' },
            { value: 150, suffix: '+', label: 'Countries' },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <p className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600 dark:from-primary-400 dark:to-secondary-400 mb-1">
                {inView ? <AnimatedCounter end={stat.value} suffix={stat.suffix} /> : `0${stat.suffix}`}
              </p>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==================== CTA SECTION ====================
const CTASection = () => {
  const navigate = useNavigate();
  const [ref, inView] = useInView();

  return (
    <section ref={ref} className="relative py-20 sm:py-32 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-400/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`glass rounded-[3rem] p-10 sm:p-16 text-center space-y-8 shadow-xl shadow-primary-900/5 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Emoji */}
          <div className="text-5xl sm:text-6xl animate-bounce-slow inline-block bg-gradient-to-br from-primary-400 to-secondary-400 bg-clip-text">💬</div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white">
            Ready to start
            <br />
            <span className="gradient-text">chatting?</span>
          </h2>

          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            Join thousands of people who have already made the switch to a faster,
            safer, and more beautiful messaging experience.
          </p>

          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => navigate('/signup')}
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-10 py-4 text-lg font-bold text-white rounded-full transition-all duration-300 hover:scale-105 active:scale-95 animate-glow"
              style={{
                background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
                boxShadow: '0 12px 32px -10px rgba(124, 58, 237, 0.6)',
              }}
            >
              Create Free Account
              <FiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==================== FOOTER ====================
const Footer = () => (
  <footer className="relative py-8 border-t border-primary-500/10">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl overflow-hidden">
            <img src="/mahaa-logo.svg" alt="Mahaa Verse" className="w-full h-full" />
          </div>
          <span className="text-lg font-extrabold text-gray-900 dark:text-white">
            Mahaa <span className="gradient-text">Verse</span>
          </span>
        </div>

        {/* Built by */}
        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          Built with <span className="text-red-500 animate-pulse">❤️</span> by
          <span className="font-semibold text-gray-700 dark:text-gray-300">Pavan Teja</span>
        </p>

        {/* Copyright */}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} Mahaa Verse. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

// ==================== MAIN HOME PAGE ====================
const HomePage = () => {
  useEffect(() => {
    // Smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <StatsSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default HomePage;
