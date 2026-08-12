import { useEffect, useState } from "react";
import { Share, PlusSquare, X } from "lucide-react";
import { toFa } from "@/lib/rtl";

export function IosInstallPrompt() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<"initial" | "guide">("initial");

  useEffect(() => {
    // Check if it's an iOS device
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // Check if it's already in standalone mode (installed)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    
    // Check if the user has dismissed it recently
    const lastDismissed = localStorage.getItem("ios-pwa-prompt-dismissed");
    const isRecentlyDismissed = lastDismissed && Date.now() - parseInt(lastDismissed) < 1000 * 60 * 60 * 24 * 7; // 7 days

    if (isIos && !isStandalone && !isRecentlyDismissed) {
      // Show prompt after a short delay
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("ios-pwa-prompt-dismissed", Date.now().toString());
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 pb-[env(safe-area-inset-bottom,1rem)] animate-rise-in pointer-events-none">
      <div className="mx-auto max-w-sm pointer-events-auto">
        <div className="nbh-card overflow-hidden bg-surface shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-ink p-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 nbh-border overflow-hidden bg-white">
                <img src="/favicon.png" alt="Abar3D" className="h-full w-full object-cover" />
              </div>
              <span className="font-display text-sm font-bold uppercase tracking-tight">نصب اپلیکیشن</span>
            </div>
            <button 
              onClick={handleDismiss}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {step === "initial" ? (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-ink-2 font-medium">
                  برای دسترسی سریع‌تر و تجربه بهتر، «ابر تری دی» را به صفحه اصلی آیفون خود اضافه کنید.
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setStep("guide")}
                    className="flex-1 nbh-border nbh-sh-sm nbh-lift bg-ink py-2.5 text-center text-xs font-bold text-primary-foreground uppercase tracking-wider"
                  >
                    چطور نصب کنم؟
                  </button>
                  <button 
                    onClick={handleDismiss}
                    className="flex-1 nbh-border nbh-sh-sm nbh-lift bg-white py-2.5 text-center text-xs font-bold text-ink uppercase tracking-wider"
                  >
                    بعداً
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-bold text-primary-foreground tabular">
                      {toFa(1)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold">دکمه اشتراک‌گذاری را لمس کنید</p>
                      <p className="text-[11px] text-ink-3">در نوار پایین مرورگر سافاری روی آیکون <Share size={14} className="inline mx-0.5 mb-1" /> بزنید.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-bold text-primary-foreground tabular">
                      {toFa(2)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold">گزینه Add to Home Screen را انتخاب کنید</p>
                      <p className="text-[11px] text-ink-3">لیست را به پایین بکشید و روی <PlusSquare size={14} className="inline mx-0.5 mb-1" /> Add to Home Screen بزنید.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-bold text-primary-foreground tabular">
                      {toFa(3)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold">روی Add بزنید</p>
                      <p className="text-[11px] text-ink-3">در گوشه بالای صفحه گزینه Add را انتخاب کنید تا برنامه نصب شود.</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleDismiss}
                  className="w-full nbh-border nbh-sh-sm nbh-lift bg-ink py-2.5 text-center text-xs font-bold text-primary-foreground uppercase tracking-wider"
                >
                  متوجه شدم
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
