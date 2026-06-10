import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { Sparkles, LogOut, LayoutDashboard, User as UserIcon, Sun, Moon, Brain, Code } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const name = (user?.user_metadata as { full_name?: string } | undefined)?.full_name || user?.email?.split("@")[0] || "User";
  const initial = name.charAt(0).toUpperCase();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Quiz AI", path: "/quiz", icon: Brain },
    { name: "Lab Evaluator", path: "/lab", icon: Code },
    { name: "Profile", path: "/profile", icon: UserIcon },
  ];

  return (
    <div className="relative min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-30 dark:grid-bg-dark" />
      <div className="pointer-events-none fixed -left-40 top-20 h-96 w-96 rounded-full bg-secondary/20 blur-[100px] dark:bg-secondary/10" />
      <div className="pointer-events-none fixed -right-40 top-60 h-96 w-96 rounded-full bg-accent/15 blur-[100px] dark:bg-accent/10" />

      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md transition-colors duration-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-primary-bg shadow-[0_0_20px_rgba(139,92,246,0.3)]">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="block text-lg font-bold leading-tight tracking-tight text-foreground">Disha</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">AI</span>
            </div>
          </Link>

          {/* Navigation Items */}
          <nav className="flex flex-1 items-center justify-center gap-2 px-4 sm:gap-4">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`group relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTopNavIndicator"
                      className="absolute inset-0 rounded-xl gradient-primary-bg shadow-[0_0_15px_rgba(139,92,246,0.25)]"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className={`relative z-10 h-4 w-4 transition-colors ${isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <span className="relative z-10 hidden sm:block">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all hover:bg-accent hover:text-accent-foreground"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="hidden sm:flex items-center gap-2 pr-2 border-r border-border">
              <div className="grid h-8 w-8 place-items-center rounded-full gradient-primary-bg text-xs font-bold text-white shadow-sm">
                {initial}
              </div>
            </div>

            <button
              onClick={async () => { await signOut(); navigate({ to: "/" }); }}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:block">Sign out</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-6 py-10 sm:px-10">
        {children}
      </main>

      <div aria-hidden className="sr-only">{user?.email}</div>
    </div>
  );
}
