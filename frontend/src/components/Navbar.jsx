import React from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const Navbar = () => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-[#0D0D0D]/85 backdrop-blur-xl border-b border-[#280049]" data-testid="top-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
        {/* LEFT — brand logo */}
        <Link to="/" data-testid="brand-logo" className="flex items-center shrink-0">
          <img src="/brand/clann-logo.png" alt="Clann" className="h-9 w-auto" />
        </Link>

        {/* RIGHT — auth-aware actions */}
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {user ? (
            <>
              <button data-testid="nav-bell-btn" aria-label="Notifications" className="p-2 rounded-full hover:bg-[#18002C] text-white transition-colors">
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
            <Link
              to="/auth"
              data-testid="nav-signup-btn"
              className="bg-[#F84E00] hover:bg-[#D14200] active:bg-[#C63E00] text-white rounded-full px-4 md:px-5 py-2 text-sm font-bold transition-colors"
            >
              Sign In / Sign Up
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
