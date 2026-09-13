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
const URL_YOUTUBE   = 'https://youtube.com/@lakshyaclassesbymonusir?si=lrf3-BwXjqxBCW1w';
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
  <div className="w-full max-w-[360px] sm:max-w-[380px] bg-white rounded-3xl p-6 sm:p-7 shadow-md hover:shadow-2xl border border-pink-100 transition-all duration-300 hover:-translate-y-2 flex flex-col items-center text-center group">
    {/* Large Square Photo Container with subtle Instagram gradient ring on hover */}
    <div className="w-full max-w-[260px] sm:max-w-[280px] aspect-square rounded-2xl sm:rounded-3xl overflow-hidden bg-stone-100 border border-stone-200 shadow-inner mb-5 flex items-center justify-center p-0.5 group-hover:bg-gradient-to-tr group-hover:from-[#feda75] group-hover:via-[#d62976] group-hover:to-[#4f5bd5] transition-all duration-500">
      <div className="w-full h-full rounded-[22px] overflow-hidden">
        <img
          src={img}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
        />
      </div>
    </div>

    {/* Exact Hierarchy: Name -> Spacing -> Designation -> Spacing -> Organization */}
    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">
      {name}
    </h3>
    <p className="text-sm font-bold text-[#d62976] mb-1">
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
      className="group bg-white rounded-2xl p-6 sm:p-7 border border-pink-100/80 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-pink-300 transition-all duration-300 flex flex-col h-full"
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#fbeaf0] to-[#fff1e6] text-[#d62976] flex items-center justify-center mb-4 group-hover:bg-gradient-to-tr group-hover:from-[#d62976] group-hover:to-[#fa7e1e] group-hover:text-white transition-all duration-300 shadow-sm">
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
      className="flex gap-4 items-start bg-white p-5 sm:p-6 rounded-2xl border border-pink-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-tr from-[#d62976] to-[#fa7e1e] text-white font-black text-sm flex items-center justify-center shadow-md shadow-pink-500/25">
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

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

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
          ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-pink-100 py-2.5'
          : 'bg-black/25 backdrop-blur-md border-b border-white/20 py-3.5'
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
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform shrink-0 border border-white/30">
              <img src="/Logo.png" alt="Lakshya Smart Library" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <span className={`text-sm sm:text-base font-black tracking-tight block transition-colors ${
                scrolled ? 'text-slate-900' : 'text-white'
              }`}>
                LAKSHYA SMART LIBRARY
              </span>
              <span className={`text-[10px] block font-bold tracking-wide ${
                scrolled ? 'text-[#d62976]' : 'text-yellow-200'
              }`}>
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  scrolled
                    ? 'text-slate-700 hover:text-[#d62976] hover:bg-pink-50'
                    : 'text-white/90 hover:text-white hover:bg-white/15'
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
                className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-[#d62976] via-[#962fbf] to-[#4f5bd5] hover:opacity-95 text-white text-xs font-extrabold rounded-xl transition-all shadow-md hover:scale-105 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" /> Go to Dashboard
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-[#d62976] via-[#962fbf] to-[#4f5bd5] hover:opacity-95 text-white text-xs font-extrabold rounded-xl transition-all shadow-md hover:scale-105"
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

      {/* Mobile Drawer Backdrop Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Half-Screen Opaque Mobile Slide Drawer (Zero overlap, solid background) */}
      <div
        ref={menuRef}
        className={`fixed top-0 right-0 bottom-0 w-[72vw] max-w-[280px] bg-[#180b22] text-white z-50 shadow-2xl flex flex-col p-5 lg:hidden border-l border-white/20 transition-transform duration-300 ease-in-out ${
          menuOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/15 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shadow shrink-0">
              <img src="/Logo.png" alt="Lakshya Smart Library" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <span className="text-xs font-black tracking-tight text-white block">
                LAKSHYA
              </span>
              <span className="text-[9px] font-bold text-yellow-300 tracking-wide block">
                SMART LIBRARY
              </span>
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto space-y-1.5 py-1 pr-1">
          {NAV_LINKS.map(link => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className="block w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold text-white/90 hover:text-white hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Drawer Bottom CTA */}
        <div className="pt-4 border-t border-white/15 mt-auto">
          <Link
            to={isAuth ? (role === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard') : '/login'}
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-[#d62976] via-[#962fbf] to-[#4f5bd5] hover:opacity-95 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg active:scale-98"
          >
            <LogIn className="w-3.5 h-3.5" /> {isAuth ? 'Go to Dashboard' : 'Sign In'}
          </Link>
        </div>
      </div>
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
    <div className="min-h-screen font-sans bg-[#faf7f5] text-slate-900 antialiased selection:bg-pink-500 selection:text-white">
      {/* 1. NAVBAR */}
      <Navbar isAuth={isAuthenticated} role={user?.role} />

      {/* ==============================================================
          2. HERO — VIBRANT ANIMATED INSTAGRAM LOGO GRADIENT
      ============================================================== */}
      <section
        id="home"
        className="relative min-h-[92vh] sm:min-h-screen flex items-center justify-center overflow-hidden bg-insta-gradient-animated pt-28 sm:pt-36 pb-20 sm:pb-28 px-4 sm:px-6"
      >
        {/* Animated ambient glowing orbs */}
        <div className="absolute top-1/4 left-10 w-72 h-72 bg-yellow-300/25 rounded-full blur-3xl animate-float-slow pointer-events-none" />
        <div className="absolute bottom-1/4 right-10 w-80 h-80 bg-purple-500/30 rounded-full blur-3xl animate-float-reverse pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-400/25 rounded-full blur-3xl animate-pulse-glow pointer-events-none" />

        {/* Subtle mesh dot overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Open, Spacious Hero Layout */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          {/* Tagline Pill */}
          <div
            style={anim(heroVisible, 100, -14)}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 hover:bg-white/25 border border-white/35 rounded-full text-white text-xs sm:text-sm font-bold mb-6 backdrop-blur-md shadow-lg transition-all"
          >
            <Sparkles className="w-4 h-4 text-yellow-200 animate-pulse" />
            <span>Personal Library Management &amp; Attendance System</span>
          </div>

          {/* Main Title */}
          <h1
            style={anim(heroVisible, 250)}
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-5 drop-shadow-lg"
          >
            LAKSHYA{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-pink-100 to-white drop-shadow">
              SMART
            </span>{' '}
            LIBRARY
          </h1>

          {/* Subtitle */}
          <p
            style={anim(heroVisible, 400)}
            className="text-lg sm:text-xl text-white/95 font-semibold mb-6 max-w-2xl mx-auto leading-relaxed drop-shadow"
          >
            A Smarter Way to Manage Your Library Experience
          </p>

          {/* Feature Badges */}
          <div
            style={anim(heroVisible, 530)}
            className="flex flex-wrap items-center justify-center gap-2.5 mb-10 max-w-2xl mx-auto"
          >
            {[
              'Smart QR Attendance',
              '50 Smart Seats',
              'Attendance History',
              'Notices & Complaints',
              'Secure Student Access',
            ].map(tag => (
              <span
                key={tag}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/20 hover:bg-white/30 border border-white/35 rounded-full text-xs font-semibold text-white backdrop-blur-md shadow-sm transition-all hover:scale-105"
              >
                <CheckCircle className="w-3.5 h-3.5 text-yellow-200" />
                {tag}
              </span>
            ))}
          </div>

          {/* Action Buttons */}
          <div
            style={anim(heroVisible, 650)}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {isAuthenticated ? (
              <button
                onClick={() => navigate(user?.role === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard')}
                className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-white/90 text-purple-900 font-extrabold text-sm sm:text-base rounded-2xl transition-all shadow-2xl hover:scale-105 group cursor-pointer"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-white/90 text-purple-900 font-extrabold text-sm sm:text-base rounded-2xl transition-all shadow-2xl hover:scale-105 group"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <button
                  onClick={() => scrollTo('features')}
                  className="flex items-center gap-2 px-8 py-4 bg-white/20 hover:bg-white/30 border border-white/40 text-white font-bold text-sm sm:text-base rounded-2xl transition-all backdrop-blur-md hover:scale-105 cursor-pointer shadow-lg"
                >
                  Explore Features
                </button>
              </>
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-70 pointer-events-none">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-white" />
          <span className="text-[10px] text-white tracking-widest uppercase font-bold">Scroll</span>
        </div>
      </section>

      {/* ==============================================================
          3. LIBRARY BENEFITS (CORE VALUE PILLARS)
      ============================================================== */}
      <section id="benefits" className="py-16 sm:py-20 bg-white border-b border-pink-100/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#d62976] mb-2 px-3 py-1 rounded-full bg-pink-50 border border-pink-200">
              Why Lakshya Smart Library
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
              Designed for Focused Academic Excellence
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto text-sm leading-relaxed">
              Every feature is built around student productivity, discipline, and comfort.
            </p>
          </SectionReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Armchair className="w-6 h-6 text-[#d62976]" />,
                title: '50 Reserved Desks',
                desc: 'A dedicated personal space. No seat hunting, no reservations confusion.',
              },
              {
                icon: <Clock className="w-6 h-6 text-[#d62976]" />,
                title: 'Contactless Check-In',
                desc: 'Scan the dynamic QR code on entry and exit in less than 5 seconds.',
              },
              {
                icon: <Award className="w-6 h-6 text-[#d62976]" />,
                title: 'Daily Study Tracking',
                desc: 'Monitor your study hours, consistency, and monthly visit percentages.',
              },
              {
                icon: <LifeBuoy className="w-6 h-6 text-[#d62976]" />,
                title: 'Fast Issue Resolution',
                desc: 'Report Wi-Fi, AC, or maintenance issues directly to library management.',
              },
            ].map((item, i) => (
              <SectionReveal key={item.title} delay={i * 60}>
                <div className="p-6 rounded-2xl bg-gradient-to-tr from-pink-50/50 via-white to-amber-50/40 border border-pink-100 hover:border-pink-300 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 h-full flex flex-col group">
                  <div className="w-12 h-12 rounded-xl bg-white border border-pink-100 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
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
          4. ABOUT LAKSHYA SMART LIBRARY (WITH BANNER SHOWCASE)
      ============================================================== */}
      <section id="about" className="py-20 sm:py-24 bg-[#fdfaf8] border-b border-pink-100/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column: About Narrative */}
            <SectionReveal delay={0}>
              <div>
                <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#d62976] mb-2 px-3 py-1 rounded-full bg-pink-50 border border-pink-200">
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
                      <CheckCircle2 className="w-4 h-4 text-[#d62976] flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionReveal>

            {/* Right Column: Library Banner Showcase + Specs */}
            <SectionReveal delay={120}>
              <div className="space-y-6">
                {/* Official Library Banner Image cleanly showcased */}
                <div className="rounded-3xl overflow-hidden border-2 border-pink-200 shadow-xl bg-white p-1">
                  <div className="rounded-[20px] overflow-hidden">
                    <img
                      src={IMG_BANNER}
                      alt="Lakshya Smart Library Official Banner"
                      className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </div>

                {/* Digital Specs Card */}
                <div className="bg-white rounded-2xl p-6 border border-pink-100 shadow-md">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3.5 rounded-xl bg-pink-50/60 border border-pink-100">
                      <p className="text-2xl font-black text-[#d62976]">50</p>
                      <p className="text-[11px] text-slate-600 font-semibold">Smart Seats</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100">
                      <p className="text-2xl font-black text-[#962fbf]">100%</p>
                      <p className="text-[11px] text-slate-600 font-semibold">Digital Attendance</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
                      <p className="text-2xl font-black text-[#fa7e1e]">45s</p>
                      <p className="text-[11px] text-slate-600 font-semibold">QR Cycle</p>
                    </div>
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
      <section id="features" className="py-20 sm:py-24 bg-white border-b border-pink-100/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12 sm:mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#d62976] mb-2 px-3 py-1 rounded-full bg-pink-50 border border-pink-200">
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
      <section id="how-it-works" className="py-20 sm:py-24 bg-[#fdfaf8] border-b border-pink-100/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12 sm:mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#d62976] mb-2 px-3 py-1 rounded-full bg-pink-50 border border-pink-200">
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

            {/* Visual Preview Graphic with Instagram Gradient */}
            <SectionReveal delay={150}>
              <div className="bg-gradient-to-br from-[#4f5bd5] via-[#962fbf] to-[#d62976] rounded-3xl p-8 sm:p-10 text-white shadow-2xl">
                <div className="flex items-center gap-3.5 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-sm">
                    <QrCode className="w-6 h-6 text-yellow-200" />
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg">Smart QR Attendance</h3>
                    <p className="text-yellow-200 text-xs font-semibold">Automated • Tamper-proof • Fast</p>
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
                      className="flex items-center gap-3.5 p-3 rounded-xl bg-white/15 border border-white/20 backdrop-blur-sm"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white text-[#d62976] text-xs font-black flex items-center justify-center flex-shrink-0 shadow-sm">
                        {i + 1}
                      </div>
                      <p className="flex-1 text-xs sm:text-sm font-semibold text-white">{step}</p>
                      {i < 4 ? (
                        <ChevronRight className="w-4 h-4 text-yellow-200 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-5 border-t border-white/20 text-center">
                  <p className="text-xs text-yellow-200 font-semibold">
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
            <div className="rounded-3xl bg-white p-8 sm:p-12 shadow-xl border border-amber-200/80 relative overflow-hidden">
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
                <p className="text-[#d62976] font-bold text-base sm:text-lg mb-4">
                  Classes 9th – 12th
                </p>

                <p className="text-slate-700 text-sm sm:text-base leading-relaxed mb-8 max-w-2xl">
                  Lakshya Classes provides focused academic guidance and learning support for students from Class 9 to Class 12. Conveniently located right above Lakshya Smart Library, creating a unified academic ecosystem for both coaching and quiet self-study.
                </p>

                {/* Details highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div className="flex items-center gap-3 text-slate-800 text-sm p-4 rounded-2xl bg-[#faf7ef] border border-amber-200/60 font-medium">
                    <Users className="w-5 h-5 text-[#d62976] flex-shrink-0" />
                    <span>Directed by <strong className="text-slate-900 font-bold">Monu Kumar</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-800 text-sm p-4 rounded-2xl bg-[#faf7ef] border border-amber-200/60 font-medium">
                    <MapPin className="w-5 h-5 text-[#d62976] flex-shrink-0" />
                    <span>Located just above Lakshya Smart Library</span>
                  </div>
                </div>

                {/* Call CTA */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4 border-t border-amber-200/60">
                  <a
                    href="tel:9155435493"
                    className="flex items-center justify-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-[#d62976] via-[#fa7e1e] to-[#feda75] hover:opacity-95 text-white font-extrabold text-sm sm:text-base rounded-2xl transition-all shadow-lg hover:scale-105"
                    aria-label="Call Lakshya Classes at 9155435493"
                  >
                    <Phone className="w-4 h-4 text-white" /> Call Now: 9155435493
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
      <section id="management" className="py-20 sm:py-24 bg-white border-b border-pink-100/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12 sm:mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#d62976] mb-2 px-3 py-1 rounded-full bg-pink-50 border border-pink-200">
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
      <section id="developers" className="py-20 sm:py-24 bg-[#fdfaf8] border-b border-pink-100/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#d62976] mb-2 px-3 py-1 rounded-full bg-pink-50 border border-pink-200">
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
                alt="Kunal Kumar - Software Engineer"
                name="Kunal Kumar"
                title="Software Engineer"
                org="Lakshya Smart Library"
              />
            </SectionReveal>

            <SectionReveal delay={120}>
              <PersonCard
                img={IMG_DEV_CHHOTU}
                alt="Chhotu Kumar - Software Engineer"
                name="Chhotu Kumar"
                title="Software Engineer"
                org="Lakshya Smart Library"
              />
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ==============================================================
          10. FOOTER WITH INSTAGRAM LOGO COLOR GRADIENT
      ============================================================== */}
      <footer className="bg-insta-gradient text-white py-16 relative overflow-hidden border-t border-white/25">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-12 mb-12">
            {/* Column 1: Brand & Purpose */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white p-1 text-[#d62976] flex items-center justify-center shadow-lg shrink-0">
                  <img src="/Logo.png" alt="Lakshya Smart Library" className="w-full h-full object-contain rounded-lg" />
                </div>
                <span className="text-lg font-black text-white tracking-tight drop-shadow-sm">
                  LAKSHYA SMART LIBRARY
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/90 leading-relaxed max-w-sm mb-5 font-medium">
                Personal Library Management &amp; Attendance System. 50 numbered smart desks, encrypted dynamic QR attendance, and digital student support.
              </p>
              <div className="inline-block px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-xs font-bold text-white shadow-sm">
                Single Library • 50 Seats
              </div>
            </div>

            {/* Column 2: Navigation Links */}
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-yellow-200 mb-4 drop-shadow-sm">
                Quick Links
              </p>
              <div className="grid grid-cols-2 gap-2.5 text-xs sm:text-sm">
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
                    className="text-white/85 hover:text-white hover:translate-x-1 font-semibold transition-all text-left py-1 cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
                <Link to="/login" className="text-yellow-200 hover:text-white transition-colors py-1 font-bold">
                  Sign In →
                </Link>
              </div>
            </div>

            {/* Column 3: CONNECT WITH US — Official YouTube & Instagram Buttons */}
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-yellow-200 mb-4 drop-shadow-sm">
                Connect With Us
              </p>
              <div className="space-y-3">
                {/* YouTube Button */}
                <a
                  href={URL_YOUTUBE}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit Lakshya Classes on YouTube"
                  className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] shadow-md group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white text-red-600 flex items-center justify-center shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Youtube className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-yellow-200 transition-colors">
                      YouTube
                    </p>
                  </div>
                </a>

                {/* Instagram Button */}
                <a
                  href={URL_INSTAGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Visit Lakshya Classes on Instagram"
                  className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] shadow-md group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white text-[#d62976] flex items-center justify-center shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Instagram className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-yellow-200 transition-colors">
                      Instagram
                    </p>
                  </div>
                </a>

                {/* Phone Link */}
                <a
                  href="tel:9155435493"
                  className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] shadow-md group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white text-purple-700 flex items-center justify-center shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-yellow-200 transition-colors">
                      Helpline
                    </p>
                    <p className="text-[11px] text-white/80 font-medium">
                      9155435493
                    </p>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-white/25 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium">
            <p className="text-white/85 text-center sm:text-left">
              &copy; {new Date().getFullYear()} Lakshya Smart Library. All rights reserved.
            </p>
            <p className="text-white/85 text-center sm:text-right">
              Designed &amp; Developed by{' '}
              <button
                onClick={() => scrollTo('developers')}
                className="text-yellow-200 hover:text-white font-bold transition-colors cursor-pointer underline underline-offset-4"
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
