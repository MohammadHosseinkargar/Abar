import logoAsset from "@/assets/abar3d-mark-trimmed.png";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, ShoppingBag, User, Search } from "lucide-react";
import { CartDrawer } from "./cart-drawer";
import { useCart } from "@/lib/cart-store";
import { toFa } from "@/lib/rtl";
import { type ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBell } from "./notification-bell";
import { motion, AnimatePresence } from "framer-motion";


function TopBar() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-line glass">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="ابر تری دی">
          <img src={logoAsset} alt="لوگوی ابر تری دی" className="h-9 w-9 object-contain" />
        </Link>


        <nav className="ms-4 hidden md:flex items-center gap-5 text-sm text-ink-2">
          <Link to="/products" className="hover:text-ink transition-colors">محصولات</Link>
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <Link
            to="/search"
            aria-label="جستجو"
            className="grid h-10 w-10 place-items-center rounded-sm hover:bg-muted"
          >
            <Search size={18} />
          </Link>
          <NotificationBell />
          {user ? (
            <Link
              to="/profile"
              aria-label="حساب کاربری"
              className="hidden md:grid h-10 w-10 place-items-center rounded-sm hover:bg-muted"
            >
              <User size={18} />
            </Link>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: undefined }}
              className="hidden md:inline-flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm hover:border-ink transition-colors"
            >
              <User size={16} /> ورود
            </Link>
          )}
          <CartDrawer />
        </div>
      </div>
    </header>
  );
}

function DesktopFooter() {
  return (
    <footer className="hidden md:block mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ STORE ]</p>
          <div className="mt-3 flex items-start gap-4">
            <img src={logoAsset} alt="لوگوی ابر تری دی" className="h-10 w-10 object-contain" />
            <a
              referrerPolicy="origin"
              target="_blank"
              href="https://trustseal.enamad.ir/?id=770460&Code=MGiHtW8FIz5trFHGbk0aRZAl1H6lcGBv"
            >
              <img
                referrerPolicy="origin"
                src="https://trustseal.enamad.ir/logo.aspx?id=770460&Code=MGiHtW8FIz5trFHGbk0aRZAl1H6lcGBv"
                alt=""
                style={{ cursor: "pointer" }}
                // @ts-ignore
                code="MGiHtW8FIz5trFHGbk0aRZAl1H6lcGBv"
                className="h-12 w-auto bg-white p-1 rounded-sm"
              />
            </a>
          </div>
          <p className="mt-2 text-xs text-ink-3 leading-relaxed">
            فروشگاه تخصصی محصولات چاپ سه‌بعدی — از فیگور تا قطعات کاربردی.
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ فروشگاه ]</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            <li><Link to="/products" className="hover:text-ink">همه محصولات</Link></li>
            <li><Link to="/orders" className="hover:text-ink">سفارش‌های من</Link></li>
            <li><Link to="/profile" className="hover:text-ink">حساب کاربری</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ راهنما ]</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            <li>ارسال و مرجوعی</li>
            <li>سوالات متداول</li>
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">[ CONTACT ]</p>
          <a href="tel:+989152844711" dir="ltr" className="mt-3 block font-mono text-sm tabular text-ink-2 hover:text-ink">
            +98 915 284 4711
          </a>
          <p className="mt-1 font-mono text-sm tabular text-ink-3" dir="ltr">۰۹۱۵ ۲۸۴ ۴۷۱۱</p>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">
            © {toFa("۱۴۰۳")} — ABAR 3D
          </p>

          <p className="font-mono text-[10px] tracking-widest text-ink-3 uppercase">v0.1</p>
        </div>
      </div>
    </footer>
  );
}

function MobileTabBar() {
  const navRef = useRef<HTMLElement>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const totalItems = useCart((s) => s.totalItems());
  const tabs = [
    { to: "/", label: "خانه", icon: Home },
    { to: "/products", label: "محصولات", icon: LayoutGrid },
    { to: "/cart", label: "سبد", icon: ShoppingBag, badge: totalItems },
    { to: "/profile", label: "حساب", icon: User },
  ] as const;

  useEffect(() => {
    const nav = navRef.current;
    const shell = nav?.closest<HTMLElement>(".app-shell");
    if (!nav || !shell) return;

    const updateHeight = () => {
      shell.style.setProperty("--mobile-tab-bar-height", `${nav.getBoundingClientRect().height}px`);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(nav);
    window.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
      shell.style.removeProperty("--mobile-tab-bar-height");
    };
  }, []);

  return (
    <nav ref={navRef} className="mobile-tab-bar md:hidden fixed inset-x-4 z-50 pointer-events-none">
      <div className="mx-auto max-w-sm pointer-events-auto">
        <div className="relative flex items-center justify-between gap-1 p-2 rounded-full border border-white/20 glass shadow-2xl backdrop-blur-2xl">
          {tabs.map((t) => {
            const active = t.to === "/" ? path === "/" : path.startsWith(t.to);
            const Icon = t.icon;
            
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2 rounded-full transition-colors duration-300 ${
                  active ? "text-ink" : "text-ink-3 hover:text-ink-2"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-ink/5 rounded-full z-0"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                  />
                )}
                
                <div className="relative z-10 flex flex-col items-center gap-0.5">
                  <motion.div
                    animate={{ scale: active ? 1.1 : 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  </motion.div>
                  <span className="text-[10px] font-medium leading-none">{t.label}</span>
                </div>

                {"badge" in t && t.badge > 0 && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-1.5 right-[calc(50%-18px)] z-20 flex h-4 min-w-4 items-center justify-center rounded-full bg-hot px-1 font-mono text-[9px] text-white tabular shadow-sm"
                  >
                    {toFa(t.badge)}
                  </motion.span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}


export function AppShell({
  children,
  variant = "nbh",
}: {
  children: ReactNode;
  variant?: "default" | "nbh";
}) {
  return (
    <div className={`app-shell min-h-dvh flex flex-col${variant === "nbh" ? " nbh" : ""}`}>
      <TopBar />
      <main className="app-shell-main flex-1">{children}</main>
      <DesktopFooter />
      {/* Footer removed for mobile per requirements */}
      <div className="md:hidden">
        <MobileTabBar />
      </div>
    </div>
  );
}
