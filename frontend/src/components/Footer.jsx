import React, { useEffect, useState } from "react";

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
    <footer data-testid="site-footer" className="relative mt-16 md:mt-24 bg-[#0D0D0D] overflow-hidden">
      {/* Text block — fixed height so monument row never shifts as text types */}
      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-14 pt-12 md:pt-16 pb-4">
        <div className="h-[210px] sm:h-[230px] md:h-[250px] flex flex-col justify-start">
          <h2 className="font-semibold tracking-tight text-white/95 text-3xl sm:text-4xl md:text-5xl leading-[1.1]">
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
            className="mt-5 self-start block h-auto w-auto max-h-12 sm:max-h-14 object-contain drop-shadow-[0_0_25px_rgba(248,78,0,0.35)]"
          />
        </div>
      </div>

      {/* Monument row — always anchored at bottom, never shifts */}
      <div className="relative w-full">
        <img
          src="/brand/monuments.png"
          alt=""
          aria-hidden="true"
          data-testid="footer-monuments"
          className="block w-full h-auto select-none pointer-events-none"
          draggable={false}
        />
        <div className="absolute -top-8 sm:-top-12 inset-x-0 h-12 sm:h-16 bg-gradient-to-b from-[#0D0D0D] to-transparent pointer-events-none"/>
      </div>

      <div className="relative z-10 border-t border-[#280049] bg-[#0D0D0D]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-14 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] sm:text-xs text-[#727272]">
          <p>© {new Date().getFullYear()} Clann. Made with love in Delhi.</p>
          <p className="tracking-widest uppercase font-semibold text-[#BF72FF]">Explore More · Upskill More</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
