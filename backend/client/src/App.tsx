import { Component, useEffect, useState, type ReactNode } from "react";
import { PublicSite } from "./PublicSite";
import { Admin } from "./Admin";

// If anything throws while the admin panel renders, show a recoverable
// message with a way back instead of a silent blank page.
class AdminBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] px-4 text-[#f5f1ea]">
          <div className="max-w-md text-center">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[#ff8c3a]">
              PORTFOLIO ADMIN
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-black">
              Admin khulte somossa hoyeche
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#b6b0a2]">
              Page ta abar load kore try korun. Tao na hole site e fire giye
              niche theke ADMIN LOGIN e abar chap din.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-[#ff6a00] px-4 py-2.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-black"
              >
                PAGE RELOAD KARUN
              </button>
              <a
                href="/"
                onClick={() => this.setState({ failed: false })}
                className="border border-[#3a372f] px-4 py-2.5 font-mono text-[11px] tracking-[0.12em]"
              >
                ← SITE E FIRE JAN
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function checkIsAdmin(): boolean {
  return (
    window.location.pathname === "/admin" ||
    window.location.pathname.startsWith("/admin/") ||
    window.location.hash.startsWith("#/admin")
  );
}

// Public portfolio lives at "/" and admin panel at "/admin" (also accepts "#/admin").
export function App() {
  const [isAdmin, setIsAdmin] = useState<boolean>(checkIsAdmin);
  useEffect(() => {
    const onChange = () => {
      const next = checkIsAdmin();
      setIsAdmin((prev) => {
        if (prev !== next) window.scrollTo({ top: 0 });
        return next;
      });
    };
    window.addEventListener("popstate", onChange);
    window.addEventListener("hashchange", onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("hashchange", onChange);
    };
  }, []);

  if (isAdmin) {
    return (
      <AdminBoundary>
        <Admin />
      </AdminBoundary>
    );
  }
  return <PublicSite />;
}
