import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook to intercept browser Back button at the authenticated portal boundary.
 * Prevents accidental exits to public/landing pages and displays a professional
 * Logout Confirmation Modal. Preserves intuitive internal subpage navigation.
 */
export function useAuthBoundaryBackGuard() {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Track internal navigation depth within the protected portal
  const depthRef = useRef<number>(0);
  const prevPathRef = useRef<string>(location.pathname);

  useEffect(() => {
    // When returning to the main dashboard, reset boundary depth to 0
    if (location.pathname === '/student/dashboard' || location.pathname === '/admin/dashboard') {
      depthRef.current = 0;
    } else if (prevPathRef.current !== location.pathname) {
      depthRef.current += 1;
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    // Push an initial sentinel state entry so that browser Back can be intercepted
    // without prematurely exiting the authenticated boundary
    window.history.pushState({ isAuthBoundary: true }, '', window.location.href);

    const handlePopState = () => {
      // If user is navigating between internal subpages (e.g. attendance -> dashboard), allow standard back navigation
      if (depthRef.current > 0) {
        depthRef.current -= 1;
        prevPathRef.current = window.location.pathname;
        return;
      }

      // If at boundary (e.g. root dashboard or attempt to exit authenticated portal),
      // re-push current URL to remain on page and open the Logout Confirmation Modal
      window.history.pushState({ isAuthBoundary: true }, '', window.location.href);
      setShowLogoutConfirm(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/', { replace: true });
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const triggerLogoutConfirm = () => {
    setShowLogoutConfirm(true);
  };

  return {
    showLogoutConfirm,
    isLoggingOut,
    handleCancelLogout,
    handleConfirmLogout,
    triggerLogoutConfirm,
  };
}
