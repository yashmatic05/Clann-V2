import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const LINE_1 = "Explore More!";
const LINE_2 = "Upskill More!";

const TYPE_SPEED = 70;
const DELETE_SPEED = 40;
const HOLD_MS = 2200;

const Footer = () => {
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [phase, setPhase] = useState("typing1");

  useEffect(() => {
    let t;
    switch (phase) {
      case "typing1":
        if (text1.length < LINE_1.length) {
          t = setTimeout(() => setText1(LINE_1.slice(0, text1.length + 1)), TYPE_SPEED);
        } else {
          t = setTimeout(() => setPhase("typing2"), 250);
        }
        break;
      case "typing2":
        if (text2.length < LINE_2.length) {
          t = setTimeout(() => setText2(LINE_2.slice(0, text2.length + 1)), TYPE_SPEED);
        } else {
          t = setTimeout(() => setPhase("hold"), HOLD_MS);
        }
        break;
      case "hold":
        t = setTimeout(() => setPhase("deleting2"), 400);
        break;
      case "deleting2":
        if (text2.length > 0) {
          t = setTimeout(() => setText2(text2.slice(0, -1)), DELETE_SPEED);
        } else {
          setPhase("deleting1");
        }
        break;
      case "deleting1":
        if (text1.length > 0) {
          t = setTimeout(() => setText1(text1.slice(0, -1)), DELETE_SPEED);
        } else {
          t = setTimeout(() => setPhase("typing1"), 350);
        }
        break;
      default:
        break;
    }
    return () => clearTimeout(t);
  }, [phase, text1, text2]);

  return (
    <footer data-testid="site-footer" className="relative mt-16 bg-canvas overflow-hidden">
      {/* Text block — fixed height so monument row never shifts as text types */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-16 pb-4">
        <div className="h-52 flex flex-col justify-start">
          <h2 className="t-h1 text-ink">
            <span data-testid="footer-line-1" className="block min-h-[1.2em]">
              {text1}
              {phase === "typing1" && <span className="footer-caret">|</span>}
            </span>
            <span data-testid="footer-line-2" className="block min-h-[1.2em]">
              {text2}
              {(phase === "typing2" || phase === "hold" || phase === "deleting2") && (
                <span className="footer-caret">|</span>
              )}
            </span>
          </h2>

          <img
            src="/brand/clann-logo-color.png"
            alt="Clann"
            data-testid="footer-logo"
            className="mt-4 self-start block h-auto w-auto max-h-12 sm:max-h-14 object-contain"
          />
        </div>
      </div>

      {/* Monument row — always anchored at bottom, never shifts */}
      <div className="relative w-full">
        <img
          src="/brand/categories/monuments.png"
          alt=""
          aria-hidden="true"
          data-testid="footer-monuments"
          className="block w-full h-auto select-none pointer-events-none"
          draggable={false}
        />
      </div>

      <div className="relative z-10 border-t border-line bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4 flex flex-row flex-wrap items-center justify-center sm:justify-between gap-x-4 gap-y-2 t-caption text-ink-muted">
          <div className="flex flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <p>© {new Date().getFullYear()} Clann. Made with love in Delhi.</p>
            <Link
              to="/organizer"
              data-testid="footer-organizer-link"
              className="t-label text-ink-2 hover:text-ink transition-colors duration-fast ease-standard"
            >
              List Your Event
            </Link>
          </div>
          <p className="t-label text-ink-2">Explore More · Upskill More</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
