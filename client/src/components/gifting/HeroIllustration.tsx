export function HeroIllustration() {
  return (
    <div className="relative w-full aspect-square max-w-md mx-auto select-none" aria-hidden="true">
      {/* Background blobs */}
      <div className="absolute inset-0">
        <div className="absolute top-4 left-8 h-48 w-48 rounded-full bg-primary/15 blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-8 right-4 h-40 w-40 rounded-full bg-pink-400/15 blur-3xl animate-[pulse_5s_ease-in-out_infinite_1s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl animate-[pulse_7s_ease-in-out_infinite_2s]" />
      </div>

      {/* Main gift box */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[float_4s_ease-in-out_infinite]">
        <svg width="200" height="220" viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Box shadow */}
          <ellipse cx="100" cy="210" rx="70" ry="10" className="fill-foreground/5" />

          {/* Box body */}
          <rect x="25" y="100" width="150" height="100" rx="12" className="fill-primary/90" />
          <rect x="25" y="100" width="150" height="100" rx="12" fill="url(#boxGradient)" />

          {/* Box lid */}
          <rect x="18" y="80" width="164" height="30" rx="8" className="fill-primary" />
          <rect x="18" y="80" width="164" height="30" rx="8" fill="url(#lidGradient)" />

          {/* Ribbon vertical */}
          <rect x="88" y="80" width="24" height="120" className="fill-amber-400" rx="2" />
          <rect x="88" y="80" width="24" height="120" fill="url(#ribbonGradient)" rx="2" />

          {/* Ribbon horizontal */}
          <rect x="18" y="88" width="164" height="16" className="fill-amber-400" rx="2" />
          <rect x="18" y="88" width="164" height="16" fill="url(#ribbonGradient)" rx="2" />

          {/* Bow left */}
          <path d="M100 80 C70 50 40 55 55 70 C60 75 80 78 100 80Z" className="fill-amber-400" />
          <path d="M100 80 C70 50 40 55 55 70 C60 75 80 78 100 80Z" fill="url(#bowGradient)" />

          {/* Bow right */}
          <path d="M100 80 C130 50 160 55 145 70 C140 75 120 78 100 80Z" className="fill-amber-400" />
          <path d="M100 80 C130 50 160 55 145 70 C140 75 120 78 100 80Z" fill="url(#bowGradient)" />

          {/* Bow center */}
          <circle cx="100" cy="78" r="8" className="fill-amber-500" />

          {/* Shine on box */}
          <rect x="35" y="110" width="4" height="30" rx="2" className="fill-white/20" />

          <defs>
            <linearGradient id="boxGradient" x1="25" y1="100" x2="175" y2="200" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="white" stopOpacity="0.15" />
              <stop offset="1" stopColor="black" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="lidGradient" x1="18" y1="80" x2="182" y2="110" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="white" stopOpacity="0.2" />
              <stop offset="1" stopColor="black" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="ribbonGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="white" stopOpacity="0.2" />
              <stop offset="1" stopColor="black" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bowGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="white" stopOpacity="0.25" />
              <stop offset="1" stopColor="black" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Floating elements */}
      <div className="absolute top-6 right-12 text-3xl animate-[float_3s_ease-in-out_infinite_0.5s]">
        <div className="rounded-2xl bg-pink-100 dark:bg-pink-900/30 p-3 shadow-lg shadow-pink-200/50 dark:shadow-pink-900/20">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 28s-11-7.2-11-14.5C5 8.4 8.4 5 12 5c2.2 0 3.7 1.2 4 1.5C16.3 6.2 17.8 5 20 5c3.6 0 7 3.4 7 8.5C27 20.8 16 28 16 28z" className="fill-pink-500" />
          </svg>
        </div>
      </div>

      <div className="absolute bottom-16 left-4 text-3xl animate-[float_4s_ease-in-out_infinite_1s]">
        <div className="rounded-2xl bg-amber-100 dark:bg-amber-900/30 p-3 shadow-lg shadow-amber-200/50 dark:shadow-amber-900/20">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4l3.7 7.6 8.3 1.2-6 5.8 1.4 8.4L16 23.2 8.6 27l1.4-8.4-6-5.8 8.3-1.2z" className="fill-amber-500" />
          </svg>
        </div>
      </div>

      <div className="absolute top-20 left-2 animate-[float_5s_ease-in-out_infinite_2s]">
        <div className="rounded-2xl bg-violet-100 dark:bg-violet-900/30 p-3 shadow-lg shadow-violet-200/50 dark:shadow-violet-900/20">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="4" y="10" width="20" height="14" rx="3" className="fill-violet-500" />
            <rect x="2" y="7" width="24" height="6" rx="2" className="fill-violet-400" />
            <rect x="12" y="7" width="4" height="17" className="fill-violet-300" />
          </svg>
        </div>
      </div>

      <div className="absolute bottom-20 right-6 animate-[float_3.5s_ease-in-out_infinite_0.8s]">
        <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/30 p-2.5 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/20">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" className="fill-emerald-500" />
            <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Sparkle particles */}
      <div className="absolute top-12 left-1/3 h-2 w-2 rounded-full bg-amber-400 animate-[ping_2s_ease-out_infinite]" />
      <div className="absolute bottom-28 right-1/3 h-1.5 w-1.5 rounded-full bg-pink-400 animate-[ping_3s_ease-out_infinite_1s]" />
      <div className="absolute top-1/3 right-8 h-1.5 w-1.5 rounded-full bg-primary animate-[ping_2.5s_ease-out_infinite_0.5s]" />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-12px); }
        }
        .animate-\\[float_3s_ease-in-out_infinite_0\\.5s\\] {
          animation: floatEl 3s ease-in-out infinite 0.5s;
        }
        .animate-\\[float_4s_ease-in-out_infinite_1s\\] {
          animation: floatEl 4s ease-in-out infinite 1s;
        }
        .animate-\\[float_5s_ease-in-out_infinite_2s\\] {
          animation: floatEl 5s ease-in-out infinite 2s;
        }
        .animate-\\[float_3\\.5s_ease-in-out_infinite_0\\.8s\\] {
          animation: floatEl 3.5s ease-in-out infinite 0.8s;
        }
        .animate-\\[float_4s_ease-in-out_infinite\\] {
          animation: floatEl 4s ease-in-out infinite;
        }
        @keyframes floatEl {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
