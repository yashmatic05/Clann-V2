import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Calendar, Search as SearchIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAVBAR_SEARCH_PLACEHOLDERS = [
  "Search workshops in Delhi",
  "Search hackathons near you",
  "Search design meetups",
  "Search CLN-HACK-8YZK",
  "Search weekend events",
];

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const animationRef = useRef(null);
  const stateRef = useRef({
    currentPlaceholder: NAVBAR_SEARCH_PLACEHOLDERS[0],
    charIndex: 0,
    isDeleting: false,
    placeholderIndex: 0,
  });

  const prefersReducedMotion = useRef(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const handler = (e) => { prefersReducedMotion.current = e.matches; };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  // Typewriter animation for placeholder
  useEffect(() => {
    if (isFocused || searchQuery) {
      setDisplayText("");
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    if (prefersReducedMotion.current) {
      setDisplayText(NAVBAR_SEARCH_PLACEHOLDERS[0] || "");
      return;
    }

    const animate = () => {
      if (isFocused || searchQuery) return;

      const { currentPlaceholder, charIndex, isDeleting, placeholderIndex } = stateRef.current;

      if (!isDeleting) {
        // Typing
        const nextIndex = charIndex + 1;
        if (nextIndex <= currentPlaceholder.length) {
          setDisplayText(currentPlaceholder.substring(0, nextIndex));
          stateRef.current.charIndex = nextIndex;
          if (nextIndex === currentPlaceholder.length) {
            // Pause at end, then start deleting
            animationRef.current = setTimeout(() => {
              stateRef.current.isDeleting = true;
              animate();
            }, 2000);
          } else {
            animationRef.current = setTimeout(animate, 100);
          }
        }
      } else {
        // Deleting
        const nextIndex = charIndex - 1;
        if (nextIndex >= 0) {
          setDisplayText(currentPlaceholder.substring(0, nextIndex));
          stateRef.current.charIndex = nextIndex;
          animationRef.current = setTimeout(animate, 50);
        } else {
          // Move to next placeholder
          const nextPlaceholderIndex = (placeholderIndex + 1) % NAVBAR_SEARCH_PLACEHOLDERS.length;
          stateRef.current.placeholderIndex = nextPlaceholderIndex;
          stateRef.current.currentPlaceholder = NAVBAR_SEARCH_PLACEHOLDERS[nextPlaceholderIndex];
          stateRef.current.isDeleting = false;
          stateRef.current.charIndex = 0;
          setDisplayText("");
          animationRef.current = setTimeout(() => {
            // Small pause before starting next
            animationRef.current = setTimeout(animate, 500);
          }, 100);
        }
      }
    };

    // Small initial delay
    animationRef.current = setTimeout(animate, 500);

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isFocused, searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0D0D0D]/85 backdrop-blur-xl border-b border-[#280049]" data-testid="top-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
        {/* LEFT — brand logo */}
        <Link to="/" data-testid="brand-logo" className="flex items-center shrink-0">
          <img src="/brand/clann-logo.png" alt="Clann" className="h-9 w-auto" />
        </Link>

        {/* CENTER — desktop search bar (hidden on mobile) */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex items-center flex-1 max-w-[400px] mx-auto"
        >
          <div className="relative w-full">
            <SearchIcon
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#727272]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder=""
              aria-label="Search events"
              className="w-full bg-[#18002C] border border-[#46176D] rounded-full pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#727272] outline-none focus:border-[#F84E00] transition-colors"
            />
            {/* Animated placeholder text */}
            {!isFocused && !searchQuery && (
              <span
                className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-[#727272] pointer-events-none"
                style={{ opacity: 0.4 }}
              >
                {displayText}
              </span>
            )}
          </div>
        </form>

        {/* RIGHT — auth-aware actions */}
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {user ? (
            <>
              {/* Calendar button — desktop only */}
              <Link
                to="/calendar"
                data-testid="nav-calendar-btn"
                aria-label="Open calendar"
                className="hidden md:flex p-2 rounded-full hover:bg-[#18002C] text-white transition-colors"
              >
                <Calendar size={18} />
              </Link>
              <button
                data-testid="nav-bell-btn"
                aria-label="Notifications"
                className="p-2 rounded-full hover:bg-[#18002C] text-white transition-colors"
              >
                <Bell size={18} />
              </button>
              {/* Single tap → /profile (no dropdown) */}
              <Link
                to="/profile"
                data-testid="nav-profile-btn"
                aria-label="Go to your profile"
                className="flex items-center rounded-full"
              >
                {user.picture ? (
                  <img src={user.picture} alt={user.name || "Profile"} className="w-9 h-9 rounded-full border-2 border-[#46176D]" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#46176D] flex items-center justify-center text-white font-bold">
                    {user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
              </Link>
            </>
          ) : (
            <>
              {/* Calendar button — desktop only, for non-authenticated users */}
              <Link
                to="/calendar"
                data-testid="nav-calendar-btn"
                aria-label="Open calendar"
                className="hidden md:flex p-2 rounded-full hover:bg-[#18002C] text-white transition-colors"
              >
                <Calendar size={18} />
              </Link>
              <Link
                to="/auth"
                data-testid="nav-signup-btn"
                className="bg-[#F84E00] hover:bg-[#D14200] active:bg-[#C63E00] text-white rounded-full px-4 md:px-5 py-2 text-sm font-bold transition-colors"
              >
                Sign In / Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
