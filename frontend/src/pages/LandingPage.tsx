import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen, QrCode, Armchair, CalendarCheck, LifeBuoy, Bell,
  ShieldCheck, ChevronRight, Menu, X, Phone, MapPin, LogIn,
  ArrowRight, CheckCircle, Users, Building2, Code2,
} from 'lucide-react';

// -----------------------------------------------------------------------
// Image paths (served from /public)
// -----------------------------------------------------------------------
const IMG_DIRECTOR   = '/Monu_Singh_Director.png';
const IMG_MANAGER    = '/Sonu_Singh_Manager.png';
const IMG_DEV_KUNAL  = '/Kunal_Kumar_Developer.png';
const IMG_DEV_CHHOTU = '/Chhotu_Kumar_Developer.jpeg';

// -----------------------------------------------------------------------
// useScrollReveal hook
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

// -----------------------------------------------------------------------
// SectionReveal wrapper
// -----------------------------------------------------------------------
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
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

// -----------------------------------------------------------------------
// PersonCard
// -----------------------------------------------------------------------
interface PersonCardProps {
  img: string; alt: string; name: string;
  title: string; subtitle?: string; badge?: string;
}
const PersonCard: React.FC<PersonCardProps> = ({ img, alt, name, title, subtitle, badge }) => (
  <div className="group flex flex-col items-center text-center bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
    <div className="relative mb-4">
      <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-indigo-100 group-hover:ring-indigo-300 transition-all duration-300">
        <img
          src={img} alt={alt} loading="lazy"
          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      {badge && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow">
          {badge}
        </span>
      )}
    </div>
    <h3 className="text-base font-bold text-slate-900 mt-2">{name}</h3>
    <p className="text-sm font-semibold text-indigo-600 mt-0.5">{title}</p>
    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
  </div>
);

// -----------------------------------------------------------------------
// FeatureCard
// -----------------------------------------------------------------------
interface FeatureCardProps { icon: React.ReactNode; title: string; desc: string; delay?: number; }
const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, desc, delay = 0 }) => {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
      className="group bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1.5 hover:border-indigo-100 transition-all duration-300"
    >
      <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
};

// -----------------------------------------------------------------------
// StepCard
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
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
      className="flex gap-4 items-start"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-600/25">
        {step}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------
// Navbar
// -----------------------------------------------------------------------
const NAV_LINKS = [
  { label: 'Home',            href: 'home' },
  { label: 'About',           href: 'about' },
  { label: 'Features',        href: 'features' },
  { label: 'How It Works',    href: 'how-it-works' },
  { label: 'Management',      href: 'management' },
  { label: 'Lakshya Classes', href: 'lakshya-classes' },
];

const Navbar: React.FC<{ isAuth: boolean; role?: string }> = ({ isAuth, role }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100' : 'bg-transparent'
      }`}
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <button
            onClick={() => scrollTo('home')}
            className="flex items-center gap-2.5 group cursor-pointer"
            aria-label="Go to top"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm group-hover:bg-indigo-700 transition-colors">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className={`text-sm font-black tracking-tight transition-colors ${scrolled ? 'text-slate-900' : 'text-white'}`}>
              LAKSHYA SMART LIBRARY
            </span>
          </button>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-0.5">
            {NAV_LINKS.map(link => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  scrolled
                    ? 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
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
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" /> Dashboard
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" /> Login
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className={`lg:hidden p-2 rounded-lg transition-colors ${scrolled ? 'text-slate-700' : 'text-white'}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 shadow-lg">
          <div className="px-4 pt-3 pb-4 space-y-0.5">
            {NAV_LINKS.map(link => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
              >
                {link.label}
              </button>
            ))}
            <div className="pt-2 border-t border-slate-100 mt-2">
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors"
              >
                <LogIn className="w-4 h-4" /> Login
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

// -----------------------------------------------------------------------
// LandingPage
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
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const anim = (show: boolean, delayMs = 0, yFrom = 20) => ({
    opacity: show ? 1 : 0,
    transform: show ? 'translateY(0)' : `translateY(${yFrom}px)`,
    transition: `opacity 0.7s ease ${delayMs}ms, transform 0.7s ease ${delayMs}ms`,
  });

  return (
    <div className="min-h-screen font-sans">
      <Navbar isAuth={isAuthenticated} role={user?.role} />

      {/* ==============================================================
          1. HERO
      ============================================================== */}
      <section
        id="home"
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900"
      >
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div style={anim(heroVisible, 100, -16)}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-semibold mb-6 backdrop-blur-sm"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Personal Library Management &amp; Attendance System
          </div>

          <h1 style={anim(heroVisible, 250)} className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-5">
            LAKSHYA{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">SMART</span>{' '}
            LIBRARY
          </h1>

          <p style={anim(heroVisible, 400)} className="text-lg sm:text-xl text-slate-300 font-medium mb-4 max-w-2xl mx-auto leading-relaxed">
            A Smarter Way to Manage Your Library Experience
          </p>

          <div style={anim(heroVisible, 530)} className="flex flex-wrap items-center justify-center gap-2 mb-9">
            {['Smart QR Attendance', '50 Smart Seats', 'Attendance History', 'Notices & Complaints', 'Secure Login'].map(tag => (
              <span key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-white/8 border border-white/10 rounded-full text-xs text-slate-300">
                <CheckCircle className="w-3 h-3 text-indigo-400" /> {tag}
              </span>
            ))}
          </div>

          <div style={anim(heroVisible, 650)} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={() => navigate(user?.role === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard')}
                className="flex items-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-xl shadow-indigo-600/30 group"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-xl shadow-indigo-600/30 group"
                >
                  Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <button
                  onClick={() => scrollTo('features')}
                  className="flex items-center gap-2 px-7 py-3.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm rounded-xl transition-all"
                >
                  Explore Features
                </button>
              </>
            )}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40 pointer-events-none">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-white/70" />
          <span className="text-[10px] text-white/70 tracking-widest uppercase">Scroll</span>
        </div>
      </section>

      {/* ==============================================================
          2. ABOUT
      ============================================================== */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <SectionReveal className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">About</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
              About Lakshya Smart Library
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm leading-relaxed">
              A modern, organized, and fully digital library management system providing students with a seamless and secure library experience — from entry to exit.
            </p>
          </SectionReveal>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: <ShieldCheck className="w-5 h-5" />, title: 'Secure Student Access', desc: 'Every student account is created by the administrator. JWT-based authentication with strict role-based access control.' },
              { icon: <QrCode className="w-5 h-5" />, title: 'QR-Based Attendance', desc: 'Students scan a dynamic QR code at entry and exit. Each QR is time-limited and cryptographically signed — no duplication.' },
              { icon: <Armchair className="w-5 h-5" />, title: '50 Smart Seats', desc: 'The library has exactly 50 numbered seats. Admins track real-time occupancy and can assign fixed seats to students.' },
              { icon: <CalendarCheck className="w-5 h-5" />, title: 'Attendance History', desc: 'Students can view their complete visit history — dates, entry/exit times, duration, and seat number.' },
              { icon: <Bell className="w-5 h-5" />, title: 'Digital Notices', desc: 'Library administrators post important announcements that students see instantly on their dashboard.' },
              { icon: <LifeBuoy className="w-5 h-5" />, title: 'Complaint Management', desc: 'Students raise support tickets for issues like Wi-Fi, AC, fans, lights, chairs, or cleanliness.' },
            ].map((item, i) => (
              <SectionReveal key={item.title} delay={i * 70}>
                <div className="flex gap-4 items-start p-5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors h-full">
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 mb-1">{item.title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ==============================================================
          3. FEATURES
      ============================================================== */}
      <section id="features" className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <SectionReveal className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">Features</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">Smart Library Features</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              Everything a modern library needs — built specifically for Lakshya Smart Library.
            </p>
          </SectionReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard delay={0}   icon={<QrCode className="w-5 h-5" />}        title="Smart QR Attendance"  desc="Dynamic QR code-based entry and exit. Each code is time-limited and digitally signed — secure and accurate." />
            <FeatureCard delay={80}  icon={<Armchair className="w-5 h-5" />}      title="50 Smart Seats"       desc="Real-time seat occupancy tracking. Admins assign fixed seats and students are guided to their spot instantly." />
            <FeatureCard delay={160} icon={<CalendarCheck className="w-5 h-5" />} title="Attendance History"   desc="Complete visit logs — dates, times, duration, and seat number. Always accessible from the student dashboard." />
            <FeatureCard delay={240} icon={<LifeBuoy className="w-5 h-5" />}      title="Complaint Tickets"    desc="Raise tickets for Wi-Fi, AC, fan, lighting, charging points, chairs, cleanliness, or drinking water." />
            <FeatureCard delay={320} icon={<Bell className="w-5 h-5" />}          title="Admin Notices"        desc="Important library announcements posted by the admin appear instantly on every student dashboard." />
            <FeatureCard delay={400} icon={<ShieldCheck className="w-5 h-5" />}   title="Secure Role Access"   desc="Admin and student portals are strictly separated. bcrypt passwords, JWT tokens, server-side authorization." />
          </div>
        </div>
      </section>

      {/* ==============================================================
          4. HOW IT WORKS
      ============================================================== */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <SectionReveal className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">Process</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">How It Works</h2>
            <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
              Simple and fast for students. Everything runs from your phone.
            </p>
          </SectionReveal>
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <StepCard delay={0}   step={1} title="Login to Your Account"     desc="Use your registered email and the initial password provided by the library administrator." />
              <StepCard delay={80}  step={2} title="Check Your Status"          desc="See your current library status, assigned seat, and recent attendance on your dashboard." />
              <StepCard delay={160} step={3} title="Scan the Entry QR Code"     desc="Tap 'Scan Entry' and point your camera at the library QR to mark your attendance." />
              <StepCard delay={240} step={4} title="Study at Your Seat"         desc="Your entry time and seat are recorded automatically. Focus on your work." />
              <StepCard delay={320} step={5} title="Scan QR to Exit"            desc="Tap 'Scan Exit' and scan when leaving. Your visit duration is saved." />
            </div>
            <SectionReveal delay={200}>
              <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <p className="font-black text-sm">Smart QR Attendance</p>
                    <p className="text-indigo-300 text-xs">Secure. Fast. Accurate.</p>
                  </div>
                </div>
                {['Login', 'Check Status', 'Scan Entry QR', 'Study', 'Scan Exit QR'].map((step, i) => (
                  <div key={step} className="flex items-center gap-3 mb-3 last:mb-0">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="flex-1 text-sm font-medium text-slate-200">{step}</p>
                    {i < 4 ? <ChevronRight className="w-4 h-4 text-indigo-400 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  </div>
                ))}
                <div className="mt-6 pt-4 border-t border-white/10 text-center">
                  <p className="text-xs text-indigo-300">Dynamic QR codes expire in 45 seconds</p>
                </div>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ==============================================================
          5. LIBRARY MANAGEMENT
      ============================================================== */}
      <section id="management" className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <SectionReveal className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">Team</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">Library Management</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              Lakshya Smart Library is professionally managed by a dedicated team committed to providing the best study environment.
            </p>
          </SectionReveal>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <SectionReveal delay={0}>
              <PersonCard
                img={IMG_DIRECTOR}
                alt="Monu Kumar - Director of Lakshya Smart Library"
                name="Monu Kumar"
                title="Director"
                subtitle="Lakshya Smart Library"
                badge="Director"
              />
            </SectionReveal>
            <SectionReveal delay={130}>
              <PersonCard
                img={IMG_MANAGER}
                alt="Sonu Singh - Manager of Lakshya Smart Library"
                name="Sonu Singh"
                title="Manager"
                subtitle="Lakshya Smart Library"
                badge="Manager"
              />
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ==============================================================
          6. LAKSHYA CLASSES — SECONDARY / ASSOCIATED
      ============================================================== */}
      <section id="lakshya-classes" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <SectionReveal>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-10 shadow-xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 border border-indigo-400/20 rounded-full text-indigo-300 text-xs font-semibold mb-5">
                  <Building2 className="w-3 h-3" /> An Associated Educational Initiative
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-1 tracking-tight">Lakshya Classes</h2>
                <p className="text-indigo-300 font-semibold text-sm mb-4">Classes 9th – 12th</p>
                <p className="text-slate-300 text-sm leading-relaxed mb-6 max-w-lg">
                  Lakshya Classes provides focused academic guidance and learning support for students from Class 9 to Class 12.
                  Located just above Lakshya Smart Library, it offers a complete learning ecosystem under one roof.
                </p>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2.5 text-sm text-slate-300">
                    <Users className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Directed by <strong className="text-white">Monu Kumar</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-slate-300">
                    <MapPin className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Located just above Lakshya Smart Library</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-slate-300">
                    <Phone className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>9155435493</span>
                  </div>
                </div>
                <div className="inline-block bg-white/8 border border-white/10 rounded-xl px-4 py-3 mb-6">
                  <p className="text-xs text-slate-400 mb-0.5">About the Director</p>
                  <p className="text-sm font-bold text-white">Monu Kumar</p>
                  <p className="text-xs text-indigo-300">Director — Lakshya Smart Library</p>
                  <p className="text-xs text-indigo-300">Director — Lakshya Classes</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="tel:9155435493"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/30"
                    aria-label="Call Lakshya Classes at 9155435493"
                  >
                    <Phone className="w-4 h-4" /> Call Now
                  </a>
                  <span className="flex items-center justify-center px-5 py-3 bg-white/10 border border-white/15 text-slate-300 text-xs rounded-xl">
                    For More Information — Talk to the Director
                  </span>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ==============================================================
          7. DESIGNED & DEVELOPED BY
      ============================================================== */}
      <section id="developers" className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <SectionReveal className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">
              <Code2 className="w-3.5 h-3.5" /> Development
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
              Designed &amp; Developed By
            </h2>
            <p className="text-slate-500 text-sm">The team behind Lakshya Smart Library.</p>
          </SectionReveal>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <SectionReveal delay={0}>
              <PersonCard
                img={IMG_DEV_KUNAL}
                alt="Designed and Developed by Kunal Kumar - Full Stack Developer"
                name="Kunal Kumar"
                title="Full Stack Developer"
                subtitle="Lakshya Smart Library"
                badge="Developer"
              />
            </SectionReveal>
            <SectionReveal delay={140}>
              <PersonCard
                img={IMG_DEV_CHHOTU}
                alt="Designed and Developed by Chhotu Kumar - Full Stack Developer"
                name="Chhotu Kumar"
                title="Full Stack Developer"
                subtitle="Lakshya Smart Library"
                badge="Developer"
              />
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ==============================================================
          8. FOOTER
      ============================================================== */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-black text-white tracking-tight">LAKSHYA SMART LIBRARY</span>
              </div>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Personal Library Management &amp; Attendance System. One library, 50 seats, smart digital management.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">Navigation</p>
              {['home', 'about', 'features', 'management', 'lakshya-classes'].map(id => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="text-xs text-slate-400 hover:text-white transition-colors text-left capitalize cursor-pointer"
                >
                  {id === 'how-it-works' ? 'How It Works' : id.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </button>
              ))}
              <Link to="/login" className="text-xs text-slate-400 hover:text-white transition-colors mt-1">
                Login
              </Link>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">Associated</p>
              <button
                onClick={() => scrollTo('lakshya-classes')}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors text-left cursor-pointer"
              >
                Lakshya Classes
              </button>
              <p className="text-xs text-slate-500">Classes 9th – 12th</p>
              <a href="tel:9155435493" className="text-xs text-slate-400 hover:text-white transition-colors mt-1 flex items-center gap-1">
                <Phone className="w-3 h-3" /> 9155435493
              </a>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <p>&copy; {new Date().getFullYear()} Lakshya Smart Library. All rights reserved.</p>
            <p className="text-slate-600">
              Designed &amp; Developed by{' '}
              <button onClick={() => scrollTo('developers')} className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer">
                Kunal Kumar &amp; Chhotu Kumar
              </button>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
