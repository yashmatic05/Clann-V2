import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, LogOut as LogOutIcon, User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid="nav-profile-btn" className="flex items-center rounded-full">
                    {user.picture ? (
                      <img src={user.picture} alt={user.name || "Profile"} className="w-9 h-9 rounded-full border-2 border-[#46176D]" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#46176D] flex items-center justify-center text-white font-bold">
                        {user.name?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#18002C] border-[#46176D] text-white min-w-[180px]">
                  <div className="px-2 py-2 text-xs text-[#BF72FF] font-bold uppercase tracking-wider">{user.role || 'Attendee'}</div>
                  <DropdownMenuItem className="focus:bg-[#280049] focus:text-white cursor-pointer" onClick={() => navigate('/profile')} data-testid="menu-profile">
                    <UserIcon size={14} className="mr-2" /> Profile
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
