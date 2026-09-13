import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen, QrCode, Armchair, CalendarCheck, LifeBuoy, Bell,
  ShieldCheck, ChevronRight, Menu, X, Phone, MapPin, LogIn,
  ArrowRight, CheckCircle, Users, Building2, Code2, Sparkles,
} from 'lucide-react';

// -----------------------------------------------------------------------
// Asset paths (served from /public)
// -----------------------------------------------------------------------
const IMG_BANNER     = '/Banner.jpeg';
const IMG_DIRECTOR   = '/Monu_Singh_Director.png';
const IMG_MANAGER    = '/Sonu_Singh_Manager.png';
const IMG_DEV_KUNAL  = '/Kunal_Kumar_Developer.png';
const IMG_DEV_CHHOTU = '/Chhotu_Kumar_Developer.jpeg';

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
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
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
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
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
  badge?: string;
}

const PersonCard: React.FC<PersonCardProps> = ({ img, alt, name, title, org, badge }) => (
  <div className="w-full max-w-[360px] sm:max-w-[380px] bg-white rounded-3xl p-6 sm:p-7 shadow-md hover:shadow-xl border border-slate-200/80 transition-all duration-300 flex flex-col items-center text-center">
    {/* Large Square Photo Container */}
    <div className="w-full max-w-[260px] sm:max-w-[280px] aspect-square rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner mb-5 relative flex items-center justify-center">
      <img
        src={img}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-500"
      />
      {badge && (
        <span className="absolute top-3 right-3 bg-indigo-600/90 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-bold px-3 py-1 rounded-full shadow-md tracking-wider uppercase">
          {badge}
        </span>
      )}
    </div>

    {/* Clear hierarchy: Name -> Spacing -> Designation -> Spacing -> Organization */}
    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-1">
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
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
      className="group bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-indigo-200 transition-all duration-300"
    >
      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{desc}</p>
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
      className="flex gap-4 items-start bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-600/25">
        {step}
      </div>
      <div className="pt-0.5">
        <p className="text-sm font-bold text-slate-900 mb-1">{title}</p>
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
      const yOffset = -70;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-md border-b border-slate-200/80 py-2'
          : 'bg-slate-950/70 backdrop-blur-sm border-b border-white/10 py-3'
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
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm group-hover:bg-indigo-700 transition-colors">
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

          {/* Desktop links */}
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

          {/* CTA */}
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

          {/* Mobile toggle */}
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

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 shadow-xl">
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
    const t = setTimeout(() => setHeroVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -70;
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
    <div className="min-h-screen font-sans bg-slate-50 text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
      <Navbar isAuth={isAuthenticated} role={user?.role} />

      {/* ==============================================================
          1. HERO SECTION WITH BANNER BACKGROUND (ZERO OVERLAP)
      ============================================================== */}
      <section
        id="home"
        className="relative min-h-[90vh] sm:min-h-screen flex items-center justify-center overflow-hidden pt-28 sm:pt-36 pb-20 sm:pb-28 px-4 sm:px-6"
      >
        {/* Full-width Banner background with readable overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={IMG_BANNER}
            alt="Lakshya Smart Library Banner"
            className="w-full h-full object-cover object-center scale-[1.02] filter brightness-95"
          />
          {/* Subtle balanced overlay: preserves original banner graphics while keeping text highly readable */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/65 to-slate-950/85 backdrop-blur-[1px]" />
        </div>

        {/* Hero Content Container — properly separated, no colliding elements */}
        <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
          {/* Tagline Badge */}
          <div
            style={anim(heroVisible, 100, -14)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/25 border border-indigo-400/40 rounded-full text-indigo-200 text-xs sm:text-sm font-semibold mb-6 sm:mb-8 backdrop-blur-md shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-indigo-300" />
            <span>Personal Library Management &amp; Attendance System</span>
          </div>

          {/* Main Title */}
          <h1
            style={anim(heroVisible, 250)}
            className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight sm:leading-none tracking-tight mb-5 sm:mb-6 drop-shadow-sm"
          >
            LAKSHYA{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-300">
              SMART
            </span>{' '}
            LIBRARY
          </h1>

          {/* Value Proposition */}
          <p
            style={anim(heroVisible, 400)}
            className="text-lg sm:text-2xl text-slate-200 font-semibold mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed drop-shadow"
          >
            A Smarter Way to Manage Your Library Experience
          </p>

          {/* Feature Badges — clean wrapping, no cutoffs */}
          <div
            style={anim(heroVisible, 530)}
            className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mb-8 sm:mb-10 max-w-3xl"
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
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-full text-xs sm:text-sm font-medium text-slate-200 backdrop-blur-md transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                {tag}
              </span>
            ))}
          </div>

          {/* CTA Buttons */}
          <div
            style={anim(heroVisible, 650)}
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full sm:w-auto"
          >
            {isAuthenticated ? (
              <button
                onClick={() => navigate(user?.role === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base rounded-2xl transition-all shadow-xl shadow-indigo-600/30 group cursor-pointer"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base rounded-2xl transition-all shadow-xl shadow-indigo-600/30 group"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <button
                  onClick={() => scrollTo('features')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold text-sm sm:text-base rounded-2xl transition-all backdrop-blur-md cursor-pointer"
                >
                  Explore Features
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ==============================================================
          2. ABOUT LAKSHYA SMART LIBRARY
      ============================================================== */}
      <section id="about" className="py-20 sm:py-24 bg-white border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12 sm:mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
              Overview
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
              About Lakshya Smart Library
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              A modern, fully digital, 50-seat personal library management system engineered for focused self-study, automated attendance, and comfortable student management.
            </p>
          </SectionReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <ShieldCheck className="w-6 h-6" />,
                title: 'Secure Student Accounts',
                desc: 'Students receive credentials issued directly by the admin. JWT authentication with server-side authorization ensures complete security.',
              },
              {
                icon: <QrCode className="w-6 h-6" />,
                title: 'Dynamic QR Attendance',
                desc: 'Mark entry and exit in seconds by scanning a time-limited, digitally signed QR code generated on the library display.',
              },
              {
                icon: <Armchair className="w-6 h-6" />,
                title: '50 Dedicated Smart Seats',
                desc: 'A focused study space with exactly 50 seats. Real-time occupancy tracking allows students to sit at their assigned desks peacefully.',
              },
              {
                icon: <CalendarCheck className="w-6 h-6" />,
                title: 'Detailed Attendance History',
                desc: 'Log every visit with precise check-in and check-out timestamps, study duration, and date records accessible anytime.',
              },
              {
                icon: <Bell className="w-6 h-6" />,
                title: 'Real-Time Digital Notices',
                desc: 'Never miss an update. Schedule changes, holiday announcements, and facility notices appear instantly on student dashboards.',
              },
              {
                icon: <LifeBuoy className="w-6 h-6" />,
                title: 'Instant Support & Complaints',
                desc: 'Quickly report any issues with Wi-Fi, AC, lighting, chairs, or drinking water directly to the library administration.',
              },
            ].map((item, i) => (
              <SectionReveal key={item.title} delay={i * 60}>
                <div className="flex gap-4 items-start p-6 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all h-full">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">{item.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ==============================================================
          3. SMART LIBRARY FEATURES
      ============================================================== */}
      <section id="features" className="py-20 sm:py-24 bg-slate-50/70 border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12 sm:mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
              Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
              Smart Library Features
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
              Tailored specifically for Lakshya Smart Library — simple for students, powerful for administration.
            </p>
          </SectionReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              delay={0}
              icon={<QrCode className="w-6 h-6" />}
              title="Smart QR Attendance"
              desc="Fast, contactless check-in and check-out using encrypted dynamic QR codes refreshed every 45 seconds."
            />
            <FeatureCard
              delay={70}
              icon={<Armchair className="w-6 h-6" />}
              title="50 Smart Seats"
              desc="Live seat availability and assigned seating for every student. Zero confusion upon arrival."
            />
            <FeatureCard
              delay={140}
              icon={<CalendarCheck className="w-6 h-6" />}
              title="Attendance Logs"
              desc="View daily visit summaries, study hours, and monthly attendance percentage on your personal dashboard."
            />
            <FeatureCard
              delay={210}
              icon={<LifeBuoy className="w-6 h-6" />}
              title="Complaint Tickets"
              desc="Raise and track service requests for Wi-Fi, air conditioning, cleanliness, or power sockets with real-time status."
            />
            <FeatureCard
              delay={280}
              icon={<Bell className="w-6 h-6" />}
              title="Broadcast Notices"
              desc="Stay informed with immediate library updates, holiday notifications, and exam preparation hours."
            />
            <FeatureCard
              delay={350}
              icon={<ShieldCheck className="w-6 h-6" />}
              title="Secure Role Portals"
              desc="Separate interfaces for Administrator and Students with encrypted sessions and strict access controls."
            />
          </div>
        </div>
      </section>

      {/* ==============================================================
          4. HOW IT WORKS
      ============================================================== */}
      <section id="how-it-works" className="py-20 sm:py-24 bg-white border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionReveal className="text-center mb-12 sm:mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
              Workflow
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
              How It Works
            </h2>
            <p className="text-slate-600 max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
              Five simple steps designed for a smooth and uninterrupted daily library experience.
            </p>
          </SectionReveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Step list */}
            <div className="space-y-4">
              <StepCard
                delay={0}
                step={1}
                title="Login to Your Account"
                desc="Access your portal with your registered email address and credentials provided by the library administrator."
              />
              <StepCard
                delay={70}
                step={2}
                title="Check Your Dashboard"
                desc="View your assigned seat number, real-time library occupancy, and any recent admin notices."
              />
              <StepCard
                delay={140}
                step={3}
                title="Scan QR at Entry"
                desc="Tap 'Scan Entry' on your smartphone and aim your camera at the library desk QR code to mark check-in."
              />
              <StepCard
                delay={210}
                step={4}
                title="Study with Focus"
                desc="Your presence is safely marked. Head directly to your allotted seat and study in a quiet atmosphere."
              />
              <StepCard
                delay={280}
                step={5}
                title="Scan QR on Exit"
                desc="Scan the exit QR when leaving. Your session duration and attendance are recorded automatically."
              />
            </div>

            {/* Visual Preview Card */}
            <SectionReveal delay={150}>
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-2xl border border-indigo-900/50">
                <div className="flex items-center gap-3.5 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/25 flex items-center justify-center border border-indigo-400/30">
                    <QrCode className="w-6 h-6 text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg">Smart QR Attendance</h3>
                    <p className="text-indigo-300 text-xs">Automated • Accurate • Fast</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {['Login with Credentials', 'Verify Assigned Seat', 'Scan Entry QR Code', 'Deep Focus Study Session', 'Scan Exit QR on Departure'].map((step, i) => (
                    <div
                      key={step}
                      className="flex items-center gap-3.5 p-3 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </div>
                      <p className="flex-1 text-xs sm:text-sm font-semibold text-slate-200">{step}</p>
                      {i < 4 ? (
                        <ChevronRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-5 border-t border-white/10 text-center">
                  <p className="text-xs text-indigo-300 font-medium">
                    🛡️ Dynamic QR codes renew automatically for maximum security
                  </p>
                </div>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ==============================================================
          5. LAKSHYA CLASSES — SECONDARY ASSOCIATED INITIATIVE
      ============================================================== */}
      <section id="lakshya-classes" className="py-20 sm:py-24 bg-slate-50/70 border-b border-slate-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <SectionReveal>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-12 shadow-xl border border-indigo-900/40">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                {/* Secondary badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-500/20 border border-indigo-400/25 rounded-full text-indigo-300 text-xs font-bold mb-6">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>An Associated Educational Initiative</span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tight">
                  Lakshya Classes
                </h2>
                <p className="text-indigo-300 font-bold text-base sm:text-lg mb-5">
                  Classes 9th – 12th
                </p>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8 max-w-2xl">
                  Lakshya Classes provides focused academic mentoring and foundation courses for students from Class 9 to Class 12. Conveniently located right above Lakshya Smart Library, it creates a complete self-study and coaching ecosystem under one roof.
                </p>

                {/* Key Details List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div className="flex items-center gap-3 text-slate-300 text-sm p-3 rounded-xl bg-white/5 border border-white/10">
                    <Users className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                    <span>Directed by <strong className="text-white">Monu Kumar</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-300 text-sm p-3 rounded-xl bg-white/5 border border-white/10">
                    <MapPin className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                    <span>Located just above Lakshya Smart Library</span>
                  </div>
                </div>

                {/* Contact and Call CTA */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2 border-t border-white/10">
                  <a
                    href="tel:9155435493"
                    className="flex items-center justify-center gap-2.5 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base rounded-2xl transition-all shadow-lg shadow-indigo-600/30"
                    aria-label="Call Lakshya Classes at 9155435493"
                  >
                    <Phone className="w-4 h-4" /> Call Now: 9155435493
                  </a>
                  <div className="flex items-center justify-center px-5 py-3 rounded-2xl bg-white/5 text-slate-300 text-xs sm:text-sm">
                    For More Information — Talk to the Director
                  </div>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ==============================================================
          6. LIBRARY MANAGEMENT — SEPARATE SECTION
      ============================================================== */}
      <section id="management" className="py-20 sm:py-24 bg-white border-b border-slate-200/60">
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

          {/* Side-by-side on desktop/tablet, stacked vertically on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 justify-items-center max-w-3xl mx-auto">
            <SectionReveal delay={0}>
              <PersonCard
                img={IMG_DIRECTOR}
                alt="Monu Kumar - Director of Lakshya Smart Library"
                name="Monu Kumar"
                title="Director"
                org="Lakshya Smart Library"
                badge="Director"
              />
            </SectionReveal>

            <SectionReveal delay={120}>
              <PersonCard
                img={IMG_MANAGER}
                alt="Sonu Singh - Manager of Lakshya Smart Library"
                name="Sonu Singh"
                title="Manager"
                org="Lakshya Smart Library"
                badge="Manager"
              />
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ==============================================================
          7. DESIGNED & DEVELOPED BY — SEPARATE SECTION
      ============================================================== */}
      <section id="developers" className="py-20 sm:py-24 bg-slate-50/70 border-b border-slate-200/60">
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

          {/* Side-by-side on desktop/tablet, stacked vertically on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 justify-items-center max-w-3xl mx-auto">
            <SectionReveal delay={0}>
              <PersonCard
                img={IMG_DEV_KUNAL}
                alt="Kunal Kumar - Full Stack Developer"
                name="Kunal Kumar"
                title="Full Stack Developer"
                org="Lakshya Smart Library"
                badge="Developer"
              />
            </SectionReveal>

            <SectionReveal delay={120}>
              <PersonCard
                img={IMG_DEV_CHHOTU}
                alt="Chhotu Kumar - Full Stack Developer"
                name="Chhotu Kumar"
                title="Full Stack Developer"
                org="Lakshya Smart Library"
                badge="Developer"
              />
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ==============================================================
          8. FOOTER
      ============================================================== */}
      <footer className="bg-slate-900 text-slate-400 py-14 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            {/* Brand column */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <span className="text-base font-black text-white tracking-tight">
                  LAKSHYA SMART LIBRARY
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm mb-4">
                Personal Library Management &amp; Attendance System. One personal library, 50 numbered smart seats, encrypted dynamic QR attendance, and digital student support.
              </p>
              <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-[11px] font-semibold text-indigo-300">
                Single Library • 50 Seats
              </div>
            </div>

            {/* Navigation links */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white mb-4">
                Quick Navigation
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                {[
                  { label: 'Home', id: 'home' },
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

            {/* Associated institute */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white mb-4">
                Associated Institution
              </p>
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                <p className="text-sm font-bold text-white mb-1">Lakshya Classes</p>
                <p className="text-xs text-indigo-300 mb-2">Classes 9th – 12th</p>
                <p className="text-xs text-slate-400 mb-3">
                  Directed by Monu Kumar. Located just above the library.
                </p>
                <a
                  href="tel:9155435493"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" /> 9155435493
                </a>
              </div>
            </div>
          </div>

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
