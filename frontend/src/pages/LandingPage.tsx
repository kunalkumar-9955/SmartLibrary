import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen, QrCode, Armchair, CalendarCheck, LifeBuoy, Bell,
  ShieldCheck, ChevronRight, Menu, X, Phone, MapPin, LogIn,
  ArrowRight, CheckCircle, Users, Building2, Code2, Sparkles,
  Youtube, Instagram, Clock, Award, CheckCircle2,
} from 'lucide-react';

// -----------------------------------------------------------------------
// Asset paths (served from /public)
// -----------------------------------------------------------------------
const IMG_BANNER     = '/Banner.jpeg';
const IMG_DIRECTOR   = '/Monu_Singh_Director.png';
const IMG_MANAGER    = '/Sonu_Singh_Manager.png';
const IMG_DEV_KUNAL  = '/Kunal_Kumar_Developer.png';
const IMG_DEV_CHHOTU = '/Chhotu_Kumar_Developer.jpeg';

// Social URLs (Provided strictly by user)
const URL_YOUTUBE = 'https://youtube.com/@lakshyaclassesbymonusir?si=lrf3-BwXjqxBCW1w';
const URL_INSTAGRAM = 'https://www.instagram.com/lakshayaclasses9431?stkn=YWpxcnY2dGxybTRy';

// -----------------------------------------------------------------------
// Scroll reveal hook
// -----------------------------------------------------------------------
function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

const SectionReveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({
  children, className = '', delay = 0,
}) => {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(22px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

// -----------------------------------------------------------------------
// Profile Card — Large Square Container (No Circles, Zero Overlap)
// -----------------------------------------------------------------------
interface PersonCardProps {
  img: string;
  alt: string;
  name: string;
  title: string;
  org: string;
}

const PersonCard: React.FC<PersonCardProps> = ({ img, alt, name, title, org }) => (
  <div className="w-full max-w-[360px] sm:max-w-[380px] bg-white rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-xl border border-slate-200/90 transition-all duration-300 hover:-translate-y-1.5 flex flex-col items-center text-center group">
    {/* Large Square Photo Container */}
    <div className="w-full max-w-[260px] sm:max-w-[280px] aspect-square rounded-2xl sm:rounded-3xl overflow-hidden bg-stone-100 border border-slate-200 shadow-inner mb-5 flex items-center justify-center">
      <img
        src={img}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
      />
    </div>

    {/* Exact Hierarchy: Name -> Spacing -> Designation -> Spacing -> Organization */}
    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">
      {name}
    </h3>
    <p className="text-sm font-bold text-indigo-600 mb-1">
      {title}
    </p>
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
      {org}
    </p>
  </div>
);

// -----------------------------------------------------------------------
// FeatureCard Component
// -----------------------------------------------------------------------
interface FeatureCardProps { icon: React.ReactNode; title: string; desc: string; delay?: number; }
const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, desc, delay = 0 }) => {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(22px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
      className="group bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-indigo-200 transition-all duration-300 flex flex-col h-full"
    >
      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shadow-sm">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mt-auto">{desc}</p>
    </div>
  );
};

// -----------------------------------------------------------------------
// StepCard Component
// -----------------------------------------------------------------------
const StepCard: React.FC<{ step: number; title: string; desc: string; delay?: number }> = ({
  step, title, desc, delay = 0,
}) => {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
      className="flex gap-4 items-start bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-600/20">
        {step}
      </div>
      <div className="pt-0.5">
        <p className="text-sm sm:text-base font-bold text-slate-900 mb-1">{title}</p>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------
// Navbar Component
// -----------------------------------------------------------------------
const NAV_LINKS = [
  { label: 'Home',            href: 'home' },
  { label: 'Benefits',        href: 'benefits' },
  { label: 'About',           href: 'about' },
  { label: 'Features',        href: 'features' },
  { label: 'How It Works',    href: 'how-it-works' },
  { label: 'Lakshya Classes', href: 'lakshya-classes' },
  { label: 'Management',      href: 'management' },
  { label: 'Developers',      href: 'developers' },
];

const Navbar: React.FC<{ isAuth: boolean; role?: string }> = ({ isAuth, role }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -72;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-md border-b border-slate-200/80 py-2.5'
          : 'bg-slate-950/75 backdrop-blur-md border-b border-white/10 py-3.5'
      }`}
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12 sm:h-14">
          {/* Brand */}
          <button
            onClick={() => scrollTo('home')}
            className="flex items-center gap-2.5 group cursor-pointer text-left"
            aria-label="Go to top"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md group-hover:bg-indigo-700 transition-colors">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className={`text-sm sm:text-base font-black tracking-tight block transition-colors ${
                scrolled ? 'text-slate-900' : 'text-white'
              }`}>
                LAKSHYA SMART LIBRARY
              </span>
              <span className="text-[10px] block text-indigo-400 font-medium tracking-wide">
                50 Smart Seats • Personal System
              </span>
            </div>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  scrolled
                    ? 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/70'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* CTA Right */}
          <div className="hidden lg:block">
            {isAuth ? (
              <button
                onClick={() => navigate(role === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard')}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" /> Go to Dashboard
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className={`lg:hidden p-2 rounded-lg transition-colors cursor-pointer ${
              scrolled ? 'text-slate-700' : 'text-white'
            }`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 shadow-2xl">
          <div className="px-4 pt-3 pb-5 space-y-1">
            {NAV_LINKS.map(link => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
              >
                {link.label}
              </button>
            ))}
            <div className="pt-3 border-t border-slate-100 mt-2">
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
              >
                <LogIn className="w-4 h-4" /> {isAuth ? 'Go to Dashboard' : 'Sign In'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

// -----------------------------------------------------------------------
// Main Landing Page Component
// -----------------------------------------------------------------------
export const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 70);
    return () => clearTimeout(t);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -72;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const anim = (show: boolean, delayMs = 0, yFrom = 20) => ({
    opacity: show ? 1 : 0,
    transform: show ? 'translateY(0)' : `translateY(${yFrom}px)`,
    transition: `opacity 0.65s ease ${delayMs}ms, transform 0.65s ease ${delayMs}ms`,
  });

  return (
    <div className="min-h-screen font-sans bg-[#faf9f6] text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
      {/* 1. NAVBAR */}
      <Navbar isAuth={isAuthenticated} role={user?.role} />

      {/* ==============================================================
          2. HERO — REDESIGNED TO PREVENT LOGO COLLISION & DUPLICATION
      ============================================================== */}
      <section
        id="home"
        className="relative min-h-[92vh] sm:min-h-screen flex items-center justify-center overflow-hidden pt-28 sm:pt-36 pb-20 sm:pb-28 px-4 sm:px-6"
      >
        {/* Full-width banner background with sophisticated multi-layer overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={IMG_BANNER}
            alt="Lakshya Smart Library Background"
            className="w-full h-full object-cover object-center filter brightness-[0.92]"
          />
          {/* Multi-layer gentle overlay: preserves original banner graphics and colors while ensuring crisp text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-900/40 to-slate-950/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-black/30" />
        </div>

        {/* Hero Content Panel — Translucent glass panel so text never competes with background banner logo */}
        <div className="relative z-10 max-w-3xl mx-auto text-center w-full">
          <div
            style={anim(heroVisible, 100)}
            className="bg-slate-950/60 backdrop-blur-md border border-white/20 rounded-3xl p-6 sm:p-10 shadow-2xl"
          >
            {/* System Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/25 border border-indigo-400/40 rounded-full text-indigo-200 text-xs sm:text-sm font-semibold mb-6 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Personal Library Management &amp; Attendance System</span>
            </div>

            {/* Primary Headline — Value focused, NO duplicate giant brand name over banner */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4 drop-shadow-sm">
              A Smarter Way to Manage Your Library Experience
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-200 font-medium mb-7 max-w-xl mx-auto leading-relaxed">
              Personal digital attendance, 50 dedicated seats, automated visit history, and instant student support.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mb-8">
              {[
                'Smart QR Attendance',
                '50 Smart Seats',
                'Attendance History',
                'Notices & Complaints',
                'Secure Student Access',
              ].map(tag => (
                <span
                  key={tag}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/15 rounded-full text-xs font-medium text-slate-200 backdrop-blur-sm"
                >
                  <CheckCircle className="w-3 h-3 text-indigo-300 flex-shrink-0" />
                  {tag}
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto">
              {isAuthenticated ? (
                <button
                  onClick={() => navigate(user?.role === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base rounded-2xl transition-all shadow-xl shadow-indigo-600/30 group cursor-pointer"
                >
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base rounded-2xl transition-all shadow-xl shadow-indigo-600/30 group"
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <button
                    onClick={() => scrollTo('features')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-sm sm:text-base rounded-2xl transition-all backdrop-blur-sm cursor-pointer"
                  >
                    Explore Features
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ==============================================================
          3. LIBRARY BENEFITS (CORE VALUE PILLARS)
      ============================================================== */}
      <section id="benefits" className="py-16 sm:py-20 bg-white border-b border-stone-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
              Why Lakshya Smart Library
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
              Designed for Focused Academic Excellence
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto text-sm leading-relaxed">
              Every feature is built around the student's productivity, discipline, and comfort.
            </p>
          </SectionReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Armchair className="w-6 h-6 text-indigo-600" />,
                title: '50 Reserved Desks',
                desc: 'A dedicated personal space. No seat hunting, no reservations confusion.',
              },
              {
                icon: <Clock className="w-6 h-6 text-indigo-600" />,
                title: 'Contactless Check-In',
                desc: 'Scan the dynamic QR code on entry and exit in less than 5 seconds.',
              },
              {
                icon: <Award className="w-6 h-6 text-indigo-600" />,
                title: 'Daily Study Tracking',
                desc: 'Monitor your study hours, consistency, and monthly visit percentages.',
              },
              {
                icon: <LifeBuoy className="w-6 h-6 text-indigo-600" />,
                title: 'Fast Issue Resolution',
                desc: 'Report Wi-Fi, AC, or maintenance issues directly to library management.',
              },
            ].map((item, i) => (
              <SectionReveal key={item.title} delay={i * 60}>
                <div className="p-6 rounded-2xl bg-stone-50/70 border border-stone-200/80 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all duration-300 h-full flex flex-col">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                    {item.icon}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1.5">{item.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mt-auto">{item.desc}</p>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ==============================================================
          4. ABOUT LAKSHYA SMART LIBRARY (TWO-COLUMN DESKTOP LAYOUT)
      ============================================================== */}
      <section id="about" className="py-20 sm:py-24 bg-[#faf9f6] border-b border-stone-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column: About Narrative */}
            <SectionReveal delay={0}>
              <div>
                <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
                  About Our Institution
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-5 leading-snug">
                  A Modern, Fully Digital Single Library Study System
                </h2>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-4">
                  Lakshya Smart Library is a personal, premium study center featuring exactly <strong>50 numbered seats</strong>. Built to eliminate overcrowding, chaotic manual registers, and neglected facility complaints, our system brings digital ease to daily self-study.
                </p>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6">
                  Every enrolled student receives a verified account with access to encrypted QR check-ins, automated study time logs, direct administrative notices, and digital ticket support.
                </p>

                <div className="space-y-3">
                  {[
                    'Strictly 50 seats — zero overcrowding, complete silence',
                    'Dynamic QR verification prevents proxy and attendance tampering',
                    'Direct communication with Director Monu Kumar & Manager Sonu Singh',
                  ].map(feat => (
                    <div key={feat} className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionReveal>

            {/* Right Column: Digital Specs Card */}
            <SectionReveal delay={120}>
              <div className="bg-white rounded-3xl p-8 sm:p-10 border border-stone-200/90 shadow-lg">
                <div className="flex items-center justify-between pb-6 mb-6 border-b border-stone-100">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">Lakshya Smart Library</h3>
                    <p className="text-xs text-indigo-600 font-semibold">Official Study Center</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                    Active &amp; Open
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60">
                    <p className="text-2xl font-black text-slate-900">50</p>
                    <p className="text-xs text-slate-500 font-medium">Smart Seats</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60">
                    <p className="text-2xl font-black text-slate-900">100%</p>
                    <p className="text-xs text-slate-500 font-medium">Digital Attendance</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60">
                    <p className="text-2xl font-black text-slate-900">45s</p>
                    <p className="text-xs text-slate-500 font-medium">QR Refresh Cycle</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60">
                    <p className="text-2xl font-black text-slate-900">24/7</p>
                    <p className="text-xs text-slate-500 font-medium">Ticket Filing</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Associated with Lakshya Classes</p>
                    <p className="text-[11px] text-slate-600">Coaching classes 9th–12th located directly above</p>
                  </div>
                </div>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ==============================================================
          5. SMART LIBRARY FEATURES
      ============================================================== */}
      <section id="features" className="py-20 sm:py-24 bg-white border-b border-stone-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12 sm:mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
              System Highlights
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
              Comprehensive Library Features
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
              Engineered specifically for single-library efficiency without the unnecessary bloat of multi-branch systems.
            </p>
          </SectionReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              delay={0}
              icon={<QrCode className="w-6 h-6" />}
              title="Smart QR Attendance"
              desc="Contactless, dynamic QR codes refresh automatically. Eliminates proxy and provides instantaneous check-in."
            />
            <FeatureCard
              delay={60}
              icon={<Armchair className="w-6 h-6" />}
              title="50 Dedicated Desks"
              desc="Real-time seat assignment and occupancy indicators assure students of their allocated quiet study corner."
            />
            <FeatureCard
              delay={120}
              icon={<CalendarCheck className="w-6 h-6" />}
              title="Attendance Records"
              desc="Detailed visit history with check-in, check-out, and total hours logged on each student's personal portal."
            />
            <FeatureCard
              delay={180}
              icon={<LifeBuoy className="w-6 h-6" />}
              title="Complaint Desk"
              desc="Lodge complaints for Wi-Fi speed, air conditioning, power sockets, or cleanliness with live admin updates."
            />
            <FeatureCard
              delay={240}
              icon={<Bell className="w-6 h-6" />}
              title="Digital Notices"
              desc="Important announcements, festive holiday alerts, and schedule changes broadcast straight to dashboards."
            />
            <FeatureCard
              delay={300}
              icon={<ShieldCheck className="w-6 h-6" />}
              title="Encrypted Access"
              desc="Strict separation between Admin and Student portals powered by secure JWT sessions and bcrypt authentication."
            />
          </div>
        </div>
      </section>

      {/* ==============================================================
          6. HOW IT WORKS (5-STEP PROCESS)
      ============================================================== */}
      <section id="how-it-works" className="py-20 sm:py-24 bg-[#faf9f6] border-b border-stone-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12 sm:mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
              User Workflow
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
              How It Works
            </h2>
            <p className="text-slate-600 max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
              Simple, smooth, and designed for your phone. Study without interruptions.
            </p>
          </SectionReveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Step Cards List */}
            <div className="space-y-4">
              <StepCard
                delay={0}
                step={1}
                title="Login to Your Account"
                desc="Access your personal portal using the registered credentials provided by the library administrator."
              />
              <StepCard
                delay={70}
                step={2}
                title="Check Assigned Seat"
                desc="Verify your allotted seat number and read any newly posted library updates on your dashboard."
              />
              <StepCard
                delay={140}
                step={3}
                title="Scan QR at Entry"
                desc="Tap 'Scan Entry' on your mobile camera and scan the library's dynamic desk QR code."
              />
              <StepCard
                delay={210}
                step={4}
                title="Enter & Study in Peace"
                desc="Your check-in time is recorded. Take your dedicated seat and focus on your studies."
              />
              <StepCard
                delay={280}
                step={5}
                title="Scan QR on Exit"
                desc="Scan the exit QR code before departing. Your total study duration is automatically logged."
              />
            </div>

            {/* Visual Preview Graphic */}
            <SectionReveal delay={150}>
              <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-2xl border border-slate-800">
                <div className="flex items-center gap-3.5 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30">
                    <QrCode className="w-6 h-6 text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg">Smart QR Attendance</h3>
                    <p className="text-indigo-300 text-xs">Automated • Tamper-proof • Fast</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {[
                    '1. Log into personal student portal',
                    '2. View allotted seat & announcements',
                    '3. Scan dynamic Entry QR on arrival',
                    '4. Quiet study session at seat',
                    '5. Scan Exit QR to record visit hours',
                  ].map((step, i) => (
                    <div
                      key={step}
                      className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </div>
                      <p className="flex-1 text-xs sm:text-sm font-medium text-slate-200">{step}</p>
                      {i < 4 ? (
                        <ChevronRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-5 border-t border-slate-800 text-center">
                  <p className="text-xs text-indigo-300 font-medium">
                    🛡️ Dynamic QR codes expire every 45 seconds for foolproof security
                  </p>
                </div>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ==============================================================
          7. LAKSHYA CLASSES — WARM IVORY / SOFT CREAM / ACADEMIC
      ============================================================== */}
      <section id="lakshya-classes" className="py-20 sm:py-24 bg-[#fcf9f2] border-b border-amber-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <SectionReveal>
            <div className="rounded-3xl bg-white p-8 sm:p-12 shadow-lg border border-amber-200/80 relative overflow-hidden">
              {/* Subtle warm decorative accents */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                {/* Secondary badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-100 border border-amber-300/60 rounded-full text-amber-900 text-xs font-bold mb-6">
                  <Building2 className="w-3.5 h-3.5 text-amber-700" />
                  <span>An Associated Educational Initiative</span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-2 tracking-tight">
                  Lakshya Classes
                </h2>
                <p className="text-indigo-600 font-bold text-base sm:text-lg mb-4">
                  Classes 9th – 12th
                </p>

                <p className="text-slate-700 text-sm sm:text-base leading-relaxed mb-8 max-w-2xl">
                  Lakshya Classes provides focused academic guidance and learning support for students from Class 9 to Class 12. Conveniently located right above Lakshya Smart Library, creating a unified academic ecosystem for both coaching and quiet self-study.
                </p>

                {/* Details highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div className="flex items-center gap-3 text-slate-800 text-sm p-4 rounded-2xl bg-[#faf7ef] border border-amber-200/60 font-medium">
                    <Users className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    <span>Directed by <strong className="text-slate-900 font-bold">Monu Kumar</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-800 text-sm p-4 rounded-2xl bg-[#faf7ef] border border-amber-200/60 font-medium">
                    <MapPin className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    <span>Located just above Lakshya Smart Library</span>
                  </div>
                </div>

                {/* Call CTA */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4 border-t border-amber-200/60">
                  <a
                    href="tel:9155435493"
                    className="flex items-center justify-center gap-2.5 px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm sm:text-base rounded-2xl transition-all shadow-md"
                    aria-label="Call Lakshya Classes at 9155435493"
                  >
                    <Phone className="w-4 h-4 text-amber-400" /> Call Now: 9155435493
                  </a>
                  <div className="flex items-center justify-center px-5 py-3 rounded-2xl bg-amber-50 text-amber-900 text-xs sm:text-sm font-semibold border border-amber-200/50">
                    For More Information — Talk to the Director
                  </div>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ==============================================================
          8. LIBRARY MANAGEMENT — COMPLETELY SEPARATE SECTION
      ============================================================== */}
      <section id="management" className="py-20 sm:py-24 bg-white border-b border-stone-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12 sm:mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
              Leadership
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
              Library Management
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-medium max-w-lg mx-auto">
              The team behind Lakshya Smart Library.
            </p>
          </SectionReveal>

          {/* Exactly 2 cards side-by-side on desktop, vertical stack on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 justify-items-center max-w-3xl mx-auto">
            <SectionReveal delay={0}>
              <PersonCard
                img={IMG_DIRECTOR}
                alt="Monu Kumar - Director of Lakshya Smart Library"
                name="Monu Kumar"
                title="Director"
                org="Lakshya Smart Library"
              />
            </SectionReveal>

            <SectionReveal delay={120}>
              <PersonCard
                img={IMG_MANAGER}
                alt="Sonu Singh - Manager of Lakshya Smart Library"
                name="Sonu Singh"
                title="Manager"
                org="Lakshya Smart Library"
              />
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ==============================================================
          9. DESIGNED & DEVELOPED BY — COMPLETELY SEPARATE SECTION
      ============================================================== */}
      <section id="developers" className="py-20 sm:py-24 bg-[#faf9f6] border-b border-stone-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
              <Code2 className="w-3.5 h-3.5" /> Engineering
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
              Designed &amp; Developed By
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-medium max-w-lg mx-auto">
              The development team behind this platform.
            </p>
          </SectionReveal>

          {/* Exactly 2 developer cards side-by-side on desktop, vertical stack on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 justify-items-center max-w-3xl mx-auto">
            <SectionReveal delay={0}>
              <PersonCard
                img={IMG_DEV_KUNAL}
                alt="Kunal Kumar - Full Stack Developer"
                name="Kunal Kumar"
                title="Full Stack Developer"
                org="Lakshya Smart Library"
              />
            </SectionReveal>

            <SectionReveal delay={120}>
              <PersonCard
                img={IMG_DEV_CHHOTU}
                alt="Chhotu Kumar - Full Stack Developer"
                name="Chhotu Kumar"
                title="Full Stack Developer"
                org="Lakshya Smart Library"
              />
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ==============================================================
          10. FOOTER WITH YOUTUBE & INSTAGRAM SOCIAL BUTTONS
      ============================================================== */}
      <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-12 mb-12">
            {/* Column 1: Brand & Purpose */}
            <div>
              <div className="flex items-center gap-2.5 mb-3.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span className="text-base font-black text-white tracking-tight">
                  LAKSHYA SMART LIBRARY
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm mb-4">
                Personal Library Management &amp; Attendance System. 50 numbered smart desks, encrypted dynamic QR attendance, and digital student support.
              </p>
              <div className="inline-block px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-indigo-300">
                Single Library • 50 Seats
              </div>
            </div>

            {/* Column 2: Navigation Links */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white mb-4">
                Quick Links
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                {[
                  { label: 'Home', id: 'home' },
                  { label: 'Benefits', id: 'benefits' },
                  { label: 'About', id: 'about' },
                  { label: 'Features', id: 'features' },
                  { label: 'How It Works', id: 'how-it-works' },
                  { label: 'Management', id: 'management' },
                  { label: 'Lakshya Classes', id: 'lakshya-classes' },
                  { label: 'Developers', id: 'developers' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className="text-slate-400 hover:text-white transition-colors text-left py-1 cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors py-1 font-semibold">
                  Sign In →
                </Link>
              </div>
            </div>

            {/* Column 3: CONNECT WITH US — Official YouTube & Instagram Buttons */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white mb-4">
                Connect With Us
              </p>
              <div className="space-y-3">
                {/* YouTube Button */}
                <a
                  href={URL_YOUTUBE}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit Lakshya Classes on YouTube"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-red-500/50 hover:bg-slate-900/80 transition-all duration-300 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-600/15 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <Youtube className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">
                      YouTube
                    </p>
                    <p className="text-[11px] text-slate-400">
                      @lakshyaclassesbymonusir
                    </p>
                  </div>
                </a>

                {/* Instagram Button */}
                <a
                  href={URL_INSTAGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit Lakshya Classes on Instagram"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-pink-500/50 hover:bg-slate-900/80 transition-all duration-300 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-pink-600/15 flex items-center justify-center text-pink-500 group-hover:bg-pink-600 group-hover:text-white transition-colors">
                    <Instagram className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-pink-400 transition-colors">
                      Instagram
                    </p>
                    <p className="text-[11px] text-slate-400">
                      @lakshayaclasses9431
                    </p>
                  </div>
                </a>

                {/* Phone Link */}
                <a
                  href="tel:9155435493"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-all duration-300 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/15 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Helpline
                    </p>
                    <p className="text-[11px] text-slate-400">
                      9155435493
                    </p>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p className="text-slate-500 text-center sm:text-left">
              &copy; {new Date().getFullYear()} Lakshya Smart Library. All rights reserved.
            </p>
            <p className="text-slate-500 text-center sm:text-right">
              Designed &amp; Developed by{' '}
              <button
                onClick={() => scrollTo('developers')}
                className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer"
              >
                Kunal Kumar &amp; Chhotu Kumar
              </button>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
