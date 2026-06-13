import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, User as UserIcon, Sun, Moon, Brain, Code } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { DishaLogo } from "@/components/DishaLogo";
import { NotificationCenter } from "@/components/NotificationCenter";
import { FloatingAIAssistant } from "@/components/FloatingAIAssistant";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const name =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const initial = name.charAt(0).toUpperCase();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Quiz AI",    path: "/quiz",       icon: Brain },
    { name: "Lab",        path: "/lab",        icon: Code },
    { name: "Profile",    path: "/profile",    icon: UserIcon },
  ];

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground transition-colors duration-300">

      {/* ── Top Navigation Bar ─────────────────────────────── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-xl"
      >
        {/* Subtle top-edge glow line */}
        <div
          className="absolute top-0 inset-x-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent 0%, #7C3AED55 30%, #2563EB55 70%, transparent 100%)" }}
        />

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 gap-4">

          {/* ── Logo ── */}
          <Link to="/dashboard" className="flex items-center flex-shrink-0 group">
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <DishaLogo size={40} showText={true} animate3d={false} />
            </motion.div>
          </Link>

          {/* ── Nav Items ── */}
          <nav className="flex flex-1 items-center justify-center gap-1 px-4">
            {navItems.map((item, idx) => {
              const isActive = location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07 + 0.1, duration: 0.35 }}
                  onHoverStart={() => setHoveredItem(item.name)}
                  onHoverEnd={() => setHoveredItem(null)}
                >
                  <Link
                    to={item.path}
                    className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors duration-150 select-none ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {/* Hover / Active background pill */}
                    <AnimatePresence>
                      {(isActive || hoveredItem === item.name) && (
                        <motion.span
                          layoutId="nav-pill"
                          key="nav-pill"
                          className="absolute inset-0 rounded-xl"
                          style={{
                            background: isActive
                              ? "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(37,99,235,0.1) 100%)"
                              : "rgba(255,255,255,0.04)",
                            border: isActive ? "1px solid rgba(124,58,237,0.2)" : "1px solid rgba(255,255,255,0.06)",
                          }}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Icon with pop on active */}
                    <motion.span
                      animate={isActive ? { scale: 1.15 } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      className="relative z-10"
                    >
                      <Icon
                        className={`h-4 w-4 flex-shrink-0 transition-colors ${
                          isActive ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </motion.span>

                    <span className="relative z-10 hidden sm:block">{item.name}</span>

                    {/* Active bottom indicator dot */}
                    {isActive && (
                      <motion.span
                        layoutId="nav-dot"
                        className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 h-[3px] w-6 rounded-full"
                        style={{ background: "linear-gradient(90deg, #7C3AED, #2563EB)" }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      />
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* ── Right Actions ── */}
          <motion.div
            className="flex items-center gap-2 flex-shrink-0"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            {/* Theme toggle */}
            <motion.button
              onClick={toggleTheme}
              whileHover={{ scale: 1.08, rotate: 15 }}
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            {/* Notification Bell */}
            <NotificationCenter />

            {/* User avatar */}
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-border ml-1">
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="relative flex h-8 w-8 items-center justify-center rounded-full text-primary text-xs font-bold select-none cursor-default"
                style={{
                  background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(37,99,235,0.12))",
                  border: "1.5px solid rgba(124,58,237,0.35)",
                  boxShadow: "0 0 12px rgba(124,58,237,0.2)",
                }}
              >
                {initial}
                {/* Subtle pulse ring */}
                <motion.span
                  className="absolute inset-0 rounded-full border border-primary/30"
                  animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
              </motion.div>

              <div className="hidden md:block">
                <span className="text-sm font-semibold text-foreground truncate max-w-[110px] block leading-tight">
                  {name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {user?.email?.split("@")[0] ? user?.email : ""}
                </span>
              </div>
            </div>

            {/* Sign out */}
            <motion.button
              onClick={handleSignOut}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              disabled={signingOut}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/8 hover:text-destructive disabled:opacity-60"
            >
              <motion.span
                animate={signingOut ? { rotate: 360 } : {}}
                transition={signingOut ? { repeat: Infinity, duration: 0.8, ease: "linear" } : {}}
              >
                <LogOut className="h-4 w-4" />
              </motion.span>
              <span className="hidden sm:block">{signingOut ? "Signing out…" : "Sign out"}</span>
            </motion.button>
          </motion.div>

        </div>
      </motion.header>

      {/* ── Main Content ── */}
      <motion.main
        className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.45 }}
      >
        {children}
      </motion.main>

      {/* ── Floating AI Assistant ── */}
      <FloatingAIAssistant />

      <div aria-hidden className="sr-only">{user?.email}</div>
    </div>
  );
}
