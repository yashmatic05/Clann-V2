import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Calendar, Search as SearchIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ThemedLogo from "@/components/ThemedLogo";
import ThemeToggle from "@/components/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    <header className="sticky top-0 z-40 border-b border-line bg-canvas" data-testid="top-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
        {/* LEFT — brand logo */}
        <Link to="/" data-testid="brand-logo" className="flex items-center shrink-0">
          <ThemedLogo className="h-9 w-auto shrink-0" />
        </Link>

        {/* CENTER — desktop search bar (hidden on mobile) */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex items-center flex-1 max-w-[400px] mx-auto"
        >
          <div className="relative w-full">
            <SearchIcon
              size={16}
              strokeWidth={1.75}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder=""
              aria-label="Search events"
              className="h-11 rounded-full pl-12 pr-4"
            />
            {/* Animated placeholder text */}
            {!isFocused && !searchQuery && (
              <span
                className="absolute left-12 top-1/2 -translate-y-1/2 t-body text-ink-muted pointer-events-none"
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
                className="hidden md:flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors duration-fast ease-standard hover:bg-raised"
              >
                <Calendar size={20} strokeWidth={1.75} />
              </Link>
              <button
                data-testid="nav-bell-btn"
                aria-label="Notifications"
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors duration-fast ease-standard hover:bg-raised"
              >
                <Bell size={20} strokeWidth={1.75} />
              </button>
              {/* Theme switch — immediately left of the avatar so the profile
                  stays the far-right element. Renders nothing while
                  ENABLE_LIGHT_MODE is false (see src/lib/theme.js). */}
              <ThemeToggle />
              {/* Single tap → /profile (no dropdown) */}
              <Link
                to="/profile"
                data-testid="nav-profile-btn"
                aria-label="Go to your profile"
                className="flex h-11 w-11 items-center justify-center rounded-full"
              >
                {user.picture ? (
                  <img src={user.picture} alt={user.name || "Profile"} className="h-9 w-9 rounded-full border-2 border-line" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-raised flex items-center justify-center text-ink font-bold">
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
                className="hidden md:flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors duration-fast ease-standard hover:bg-raised"
              >
                <Calendar size={20} strokeWidth={1.75} />
              </Link>
              {/* Theme switch — immediately left of the CTA so Sign in stays
                  the far-right element. Renders nothing while
                  ENABLE_LIGHT_MODE is false (see src/lib/theme.js). */}
              <ThemeToggle />
              <Link
                to="/auth"
                data-testid="nav-signup-btn"
                className={cn(buttonVariants({ variant: "primary", size: "md" }))}
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
