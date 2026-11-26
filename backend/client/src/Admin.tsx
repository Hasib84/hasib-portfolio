import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Film,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Play,
  Plus,
  Route,
  Search,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./api";
import type { Site } from "./PublicSite";
import { VideoSlot } from "./components/VideoSlot";
import { parseVideo, youtubeThumb } from "./lib/video";

type Settings = Record<string, string>;
type WorkItem = Site["workItems"][number];
type Photo = Site["photos"][number];
type Chapter = Site["journey"][number];
type Partner = Site["partners"][number];
type Service = Site["services"][number];
type Faq = Site["faqs"][number];

const TOKEN_KEY = "hm_admin_token";

let memoryToken = "";
function readStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}
function storeToken(token: string): void {
  memoryToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable — in-memory token keeps this session active.
  }
}
function clearStoredToken(): void {
  memoryToken = "";
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

/* --------------------------------- Toast --------------------------------- */

const ToastCtx = createContext<{ toast: (msg: string, ok?: boolean) => void }>({
  toast: () => {},
});
const useToast = () => useContext(ToastCtx).toast;

/* -------------------------- Dark Studio Design Tokens -------------------- */

const inputCls =
  "w-full rounded-lg border border-[#2d2a24] bg-[#0b0b0e] px-3.5 py-2.5 text-sm text-[#f5f1ea] placeholder:text-[#6d675f] transition focus:border-[#ff6a00] focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/25";
const labelCls =
  "mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a8a29e]";
const btnPrimary =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#ff6a00] px-4 py-2 text-sm font-bold text-black shadow-[0_6px_20px_rgba(255,106,0,0.25)] transition hover:bg-[#ff8533] disabled:opacity-50";
const btnSecondary =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2d2a24] bg-[#18181d] px-3.5 py-2 text-sm font-semibold text-[#e7e5e4] transition hover:border-[#ff6a00]/50 hover:bg-[#1f1f26] disabled:opacity-50";
const btnDanger =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50";
const btnDangerSolid =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50";
const cardCls =
  "rounded-xl border border-[#26241f] bg-[#121216] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.35)]";
const iconBtnCls =
  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#2d2a24] bg-[#18181d] text-[#a8a29e] transition hover:border-[#ff6a00]/50 hover:text-white disabled:opacity-30";

/* --------------------------- Image Upload Helper ------------------------- */

async function uploadImageFile(token: string, file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`"${file.name}" 10MB er kom hote hobe.`);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("File read kora jayni."));
    reader.readAsDataURL(file);
  });
  const res = await fetch("/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
    },
    body: JSON.stringify({
      filename: file.name,
      dataUrl,
    }),
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error || "Upload failed.");
  }
  return data.url;
}

function ImageUploadButton({
  token,
  onUploaded,
  label = "Upload Image",
}: {
  token: string;
  onUploaded: (url: string, fileName?: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageFile(token, file);
      onUploaded(url, file.name);
      toast("Image uploaded ✓");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed.", false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onFile}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={btnSecondary}
      >
        <Upload size={14} />
        {uploading ? "Uploading…" : label}
      </button>
    </>
  );
}

/* ------------------------------- Form Field ------------------------------ */

function Field({
  label,
  name,
  defaultValue,
  textarea,
  rows = 3,
  placeholder,
  help,
  pfx,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  textarea?: boolean;
  rows?: number;
  placeholder?: string;
  help?: string;
  pfx?: string;
}) {
  const fid = pfx ? `${pfx}-${name}` : name;
  return (
    <div>
      <label className={labelCls} htmlFor={fid}>
        {label}
      </label>
      {textarea ? (
        <textarea
          id={fid}
          name={name}
          rows={rows}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={inputCls}
        />
      ) : (
        <input
          id={fid}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={inputCls}
        />
      )}
      {help ? <p className="mt-1.5 text-xs text-[#8a8478]">{help}</p> : null}
    </div>
  );
}

/* --------------------------- Settings save hook -------------------------- */

function useSaveSettings(token: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: async (entries: Array<{ key: string; value: string }>) =>
      await api.updateSettings({ token, entries }),
    onSuccess: () => {
      setError("");
      toast("Saved ✓ — site e update hoye geche.");
      queryClient.invalidateQueries({ queryKey: ["site"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed."),
  });
  return { mutation, error };
}

function SettingsForm({
  token,
  title,
  kicker,
  help,
  fields,
  settings,
  uploadFields,
}: {
  token: string;
  title: string;
  kicker?: string;
  help?: string;
  fields: Array<{
    key: string;
    label: string;
    textarea?: boolean;
    rows?: number;
    placeholder?: string;
    help?: string;
  }>;
  settings: Settings;
  uploadFields?: string[];
}) {
  const { mutation, error } = useSaveSettings(token);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const f of fields) map[f.key] = settings[f.key] ?? "";
    return map;
  });

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const f of fields) map[f.key] = settings[f.key] ?? "";
    setValues(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate(fields.map((f) => ({ key: f.key, value: values[f.key] ?? "" })));
  };

  return (
    <form onSubmit={onSubmit} className={cardCls}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {kicker ? (
            <p className="font-mono text-[10px] tracking-[0.2em] text-[#ff8c3a]">{kicker}</p>
          ) : null}
          <h3 className="text-base font-bold text-[#f5f1ea]">{title}</h3>
        </div>
      </div>
      {help ? <p className="mt-1.5 text-sm leading-relaxed text-[#a8a29e]">{help}</p> : null}
      <div className="mt-4 space-y-4">
        {fields.map((f) => {
          const canUpload = uploadFields?.includes(f.key);
          const val = values[f.key] ?? "";
          return (
            <div key={f.key}>
              <label className={labelCls} htmlFor={`sf-${f.key}`}>
                {f.label}
              </label>
              {f.textarea ? (
                <textarea
                  id={`sf-${f.key}`}
                  rows={f.rows ?? 3}
                  value={val}
                  placeholder={f.placeholder}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                  className={inputCls}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <input
                    id={`sf-${f.key}`}
                    value={val}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    className={`${inputCls} flex-1`}
                  />
                  {canUpload ? (
                    <ImageUploadButton
                      token={token}
                      onUploaded={(url) => setValues((p) => ({ ...p, [f.key]: url }))}
                    />
                  ) : null}
                </div>
              )}
              {canUpload && val.trim() ? (
                <img
                  src={val}
                  alt=""
                  className="mt-2.5 max-h-28 rounded-lg border border-[#2d2a24] bg-[#0b0b0e] object-contain p-1"
                />
              ) : null}
              {f.help ? <p className="mt-1.5 text-xs text-[#8a8478]">{f.help}</p> : null}
            </div>
          );
        })}
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-red-400">{error}</p> : null}
      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
        <span className="font-mono text-[10px] text-[#6d675f]">LIVE SYNC TO DB</span>
        <button type="submit" disabled={mutation.isPending} className={btnPrimary}>
          {mutation.isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------ JSON editors ----------------------------- */

type Stat = { value: string; suffix: string; label: string; detail?: string };

function StatsEditor({
  token,
  settingKey,
  title,
  settings,
}: {
  token: string;
  settingKey: string;
  title: string;
  settings: Settings;
}) {
  const parseStats = (raw: string | undefined): Stat[] => {
    try {
      const parsed: unknown = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? (parsed as Stat[]) : [];
    } catch {
      return [];
    }
  };
  const [rows, setRows] = useState<Stat[]>(() => parseStats(settings[settingKey]));
  useEffect(() => {
    setRows(parseStats(settings[settingKey]));
  }, [settings, settingKey]);

  const { mutation, error } = useSaveSettings(token);
  const set = (i: number, key: keyof Stat, value: string) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  return (
    <div className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-[#ff8c3a]">HERO DOCK STATS</p>
          <h3 className="text-base font-bold text-[#f5f1ea]">{title}</h3>
        </div>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => setRows((prev) => [...prev, { value: "", suffix: "", label: "" }])}
        >
          <Plus size={15} /> Add Stat
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-2 items-end gap-2.5 rounded-lg border border-[#26241f] bg-[#0d0d10] p-3 sm:grid-cols-4"
          >
            <div>
              <label className={labelCls} htmlFor={`${settingKey}-v-${i}`}>
                Number
              </label>
              <input
                id={`${settingKey}-v-${i}`}
                className={inputCls}
                value={r.value}
                onChange={(e) => set(i, "value", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor={`${settingKey}-s-${i}`}>
                Suffix (+, etc)
              </label>
              <input
                id={`${settingKey}-s-${i}`}
                className={inputCls}
                value={r.suffix}
                onChange={(e) => set(i, "suffix", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor={`${settingKey}-l-${i}`}>
                Label
              </label>
              <input
                id={`${settingKey}-l-${i}`}
                className={inputCls}
                value={r.label}
                onChange={(e) => set(i, "label", e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                aria-label={`Remove stat ${i + 1}`}
                className={btnDanger}
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-red-400">{error}</p> : null}
      <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={mutation.isPending}
          className={btnPrimary}
          onClick={() => mutation.mutate([{ key: settingKey, value: JSON.stringify(rows) }])}
        >
          {mutation.isPending ? "Saving…" : "Save Stats"}
        </button>
      </div>
    </div>
  );
}

function SocialsEditor({ token, settings }: { token: string; settings: Settings }) {
  type Social = { label: string; url: string };
  const parseSocials = (raw: string | undefined): Social[] => {
    try {
      const parsed: unknown = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? (parsed as Social[]) : [];
    } catch {
      return [];
    }
  };
  const [rows, setRows] = useState<Social[]>(() => parseSocials(settings["socials"]));
  useEffect(() => {
    setRows(parseSocials(settings["socials"]));
  }, [settings]);

  const { mutation, error } = useSaveSettings(token);
  const set = (i: number, key: keyof Social, value: string) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  return (
    <div className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-[#ff8c3a]">SOCIAL CHANNELS</p>
          <h3 className="text-base font-bold text-[#f5f1ea]">Social Links</h3>
          <p className="mt-0.5 text-sm text-[#a8a29e]">
            YouTube, Vimeo, Facebook, Blog — ekhan theke add, edit ba delete korun.
          </p>
        </div>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => setRows((prev) => [...prev, { label: "", url: "" }])}
        >
          <Plus size={15} /> Add Link
        </button>
      </div>
      <div className="mt-4 space-y-2.5">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex flex-wrap items-end gap-2.5 rounded-lg border border-[#26241f] bg-[#0d0d10] p-3"
          >
            <div className="min-w-[140px] flex-1">
              <label className={labelCls} htmlFor={`social-label-${i}`}>
                Platform / Name
              </label>
              <input
                id={`social-label-${i}`}
                className={inputCls}
                value={r.label}
                onChange={(e) => set(i, "label", e.target.value)}
              />
            </div>
            <div className="min-w-[220px] flex-[2]">
              <label className={labelCls} htmlFor={`social-url-${i}`}>
                Link (URL)
              </label>
              <input
                id={`social-url-${i}`}
                className={inputCls}
                value={r.url}
                onChange={(e) => set(i, "url", e.target.value)}
              />
            </div>
            <button
              type="button"
              aria-label={`Remove social link ${i + 1}`}
              className={btnDanger}
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-red-400">{error}</p> : null}
      <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={mutation.isPending}
          className={btnPrimary}
          onClick={() =>
            mutation.mutate([
              {
                key: "socials",
                value: JSON.stringify(rows.filter((x) => x.label.trim() || x.url.trim())),
              },
            ])
          }
        >
          {mutation.isPending ? "Saving…" : "Save Social Links"}
        </button>
      </div>
    </div>
  );
}

function ToolsEditor({ token, settings }: { token: string; settings: Settings }) {
  const parseTools = (raw: string | undefined): string[] => {
    try {
      const parsed: unknown = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  const [tools, setTools] = useState<string[]>(() => parseTools(settings["about_tools"]));
  const [newTool, setNewTool] = useState("");
  useEffect(() => {
    setTools(parseTools(settings["about_tools"]));
  }, [settings]);

  const { mutation, error } = useSaveSettings(token);
  const addTool = () => {
    const t = newTool.trim();
    if (!t) return;
    setTools((p) => [...p, t]);
    setNewTool("");
  };

  return (
    <div className={cardCls}>
      <p className="font-mono text-[10px] tracking-[0.2em] text-[#ff8c3a]">ABOUT SOFTWARE</p>
      <h3 className="text-base font-bold text-[#f5f1ea]">Tools I Work In</h3>
      <p className="mt-0.5 text-sm text-[#a8a29e]">
        Notun tool add korun, edit korun ba delete korun — tarpor Save korun.
      </p>
      <div className="mt-4 space-y-2">
        {tools.map((tool, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              aria-label={`Tool ${i + 1}`}
              className={inputCls}
              value={tool}
              onChange={(e) =>
                setTools((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
              }
            />
            <button
              type="button"
              onClick={() => setTools((prev) => prev.filter((_, j) => j !== i))}
              className={btnDanger}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <input
            className={inputCls}
            value={newTool}
            onChange={(e) => setNewTool(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTool();
              }
            }}
            placeholder="Notun tool er naam (e.g. DaVinci Resolve)"
          />
          <button type="button" onClick={addTool} className={btnSecondary}>
            <Plus size={15} /> Add
          </button>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-red-400">{error}</p> : null}
      <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={mutation.isPending}
          className={btnPrimary}
          onClick={() =>
            mutation.mutate([
              {
                key: "about_tools",
                value: JSON.stringify(tools.map((t) => t.trim()).filter(Boolean)),
              },
            ])
          }
        >
          {mutation.isPending ? "Saving…" : "Save Tools"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------- Row save/delete hooks ------------------------- */

function useSaveRow<TArgs>(
  fn: (args: TArgs) => Promise<unknown>,
  onSuccess?: () => void,
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: async (args: TArgs) => await fn(args),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["site"] });
      toast("Saved ✓");
      onSuccess?.();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Save failed."),
  });
  return { mutation, error };
}

function useDeleteRow(
  fn: (args: { token: string; id: number }) => Promise<unknown>,
  token: string,
  onSuccess?: () => void,
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (id: number) => await fn({ token, id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site"] });
      toast("Deleted ✓");
      onSuccess?.();
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Delete failed.", false),
  });
}

function useReorder<T extends { id: number; sortOrder: number }>(
  save: (item: T, sortOrder: number) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (items: T[]) => {
      for (const [i, item] of items.entries()) {
        if (item.sortOrder !== i) await save(item, i);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site"] });
      toast("Order updated ✓");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Reorder failed.", false),
  });
}

function moved<T>(items: T[], index: number, dir: -1 | 1): T[] | null {
  const target = index + dir;
  if (target < 0 || target >= items.length) return null;
  const next = [...items];
  const a = next[index];
  const b = next[target];
  if (a === undefined || b === undefined) return null;
  next[index] = b;
  next[target] = a;
  return next;
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");

/* --------------------------- Shared UI pieces ---------------------------- */

function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "ok" | "warn" | "orange" | "neutral";
  children: ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
        : tone === "orange"
          ? "border-[#ff6a00]/40 bg-[#ff6a00]/15 text-[#ffb067]"
          : "border-white/15 bg-white/5 text-[#a8a29e]";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}

function ConfirmDialog({
  title,
  body,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-sm rounded-xl border border-[#2d2a24] bg-[#141418] p-5 shadow-2xl">
        <h3 className="text-base font-bold text-[#f5f1ea]">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[#a8a29e]">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className={btnDangerSolid}>
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  movePending,
  extra,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  movePending?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      {extra}
      {onMoveUp ? (
        <button
          type="button"
          aria-label="Move up"
          onClick={onMoveUp}
          disabled={movePending}
          className={iconBtnCls}
        >
          <ChevronUp size={15} />
        </button>
      ) : null}
      {onMoveDown ? (
        <button
          type="button"
          aria-label="Move down"
          onClick={onMoveDown}
          disabled={movePending}
          className={iconBtnCls}
        >
          <ChevronDown size={15} />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#2d2a24] bg-[#18181d] px-2.5 py-1.5 text-xs font-semibold text-[#f5f1ea] transition hover:border-[#ff6a00]/60 hover:text-[#ffb067]"
      >
        <Pencil size={12} /> Edit
      </button>
      <button type="button" onClick={onDelete} className={btnDanger}>
        <Trash2 size={12} /> Delete
      </button>
    </div>
  );
}

function ListCard({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-[#22201b] overflow-hidden rounded-xl border border-[#26241f] bg-[#121216] shadow-sm">
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-[#8a8478]">{text}</p>;
}

function SectionHead({
  kicker,
  title,
  sub,
  action,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker ? (
          <p className="font-mono text-[10px] tracking-[0.22em] text-[#ff8c3a]">{kicker}</p>
        ) : null}
        <h2 className="text-lg font-extrabold tracking-tight text-[#f5f1ea]">{title}</h2>
        {sub ? <p className="mt-0.5 text-sm text-[#a8a29e]">{sub}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

function FormShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-[#a8a29e] transition hover:text-[#ff8c3a]"
      >
        <ArrowLeft size={15} /> Back to list
      </button>
      <div className={cardCls}>
        <h2 className="text-lg font-extrabold text-[#f5f1ea]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[#a8a29e]">{subtitle}</p> : null}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function FormFooter({
  pending,
  error,
  onCancel,
  submitLabel = "Save",
}: {
  pending: boolean;
  error: string;
  onCancel: () => void;
  submitLabel?: string;
}) {
  return (
    <>
      {error ? <p className="mt-4 text-sm font-medium text-red-400">{error}</p> : null}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </>
  );
}

/* ------------------------------ Video bits ------------------------------- */

const VIDEO_HELP =
  "YouTube (watch / Shorts / youtu.be), Facebook video/reel, ba direct .mp4 link paste korun.";

const TRACKS = [
  { key: "reels", label: "R1 · Reels (9:16)", short: "Reels", accent: "#ff6a00" },
  { key: "wide", label: "V1 · Wide (16:9)", short: "Wide", accent: "#a493e6" },
  { key: "square", label: "S1 · Square (1:1)", short: "Square", accent: "#2dd4bf" },
] as const;

type TrackKey = (typeof TRACKS)[number]["key"];

function VideoLinkStatus({
  url,
  title,
  tag,
  thumbnailUrl,
  track = "wide",
}: {
  url: string;
  title: string;
  tag?: string;
  thumbnailUrl?: string;
  track?: TrackKey;
}) {
  const parsed = parseVideo(url);
  if (!url.trim()) {
    return (
      <p className="mt-1.5 text-xs text-[#8a8478]">
        Ekono link nei — link paste korlei Title, Track, Tag o Thumbnail auto-fill hobe.
      </p>
    );
  }
  if (!parsed) {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-400">
        <AlertTriangle size={13} /> Link ta chena jacche na — YouTube, Facebook ba .mp4 link check korun.
      </p>
    );
  }
  const kindLabel =
    parsed.kind === "youtube" ? "YouTube" : parsed.kind === "facebook" ? "Facebook" : "MP4";
  const frameBoxCls =
    track === "reels"
      ? "aspect-[9/16] w-full max-w-[230px]"
      : track === "square"
        ? "aspect-square w-full max-w-[300px]"
        : "aspect-video w-full max-w-md";
  return (
    <div className="mt-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
        <CheckCircle2 size={13} /> {kindLabel} link valid ✓ — niche click kore play test korun:
      </p>
      <div className={`mt-2 ${frameBoxCls} overflow-hidden rounded-lg border border-[#2d2a24]`}>
        <VideoSlot
          url={url}
          title={title || "Video"}
          tag={tag}
          thumbnailUrl={thumbnailUrl}
          frameLabel="ADMIN PREVIEW"
        />
      </div>
    </div>
  );
}

function ShowreelForm({ token, settings }: { token: string; settings: Settings }) {
  const [url, setUrl] = useState(settings["showreel_video_url"] ?? "");
  useEffect(() => {
    setUrl(settings["showreel_video_url"] ?? "");
  }, [settings]);

  const { mutation, error } = useSaveSettings(token);
  const has = url.trim().length > 0;
  return (
    <form
      className={cardCls}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate([{ key: "showreel_video_url", value: url }]);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-bold text-[#f5f1ea]">Showreel Video</h3>
          <Badge tone={has ? "ok" : "warn"}>{has ? "LINK ACTIVE ✓" : "NO LINK"}</Badge>
        </div>
        <button type="submit" disabled={mutation.isPending} className={btnPrimary}>
          {mutation.isPending ? "Saving…" : "Save Showreel"}
        </button>
      </div>
      <p className="mt-1 text-sm text-[#a8a29e]">Site er main 16:9 showreel. {VIDEO_HELP}</p>
      <div className="mt-4">
        <label className={labelCls} htmlFor="showreel-video-url">
          Showreel Video Link
        </label>
        <input
          id="showreel-video-url"
          className={inputCls}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
        />
        <VideoLinkStatus url={url} title="Hasib Mahamud — Showreel" tag="Showreel" />
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-red-400">{error}</p> : null}
    </form>
  );
}

/* ------------------------------ Navigation ------------------------------- */

const SECTIONS = [
  { key: "dashboard", label: "Dashboard", code: "00:00", icon: LayoutDashboard },
  { key: "videos", label: "Videos", code: "00:01", icon: Clapperboard },
  { key: "photos", label: "Photos", code: "00:02", icon: ImageIcon },
  { key: "journey", label: "Journey & Brands", code: "00:03", icon: Route },
  { key: "services", label: "Services", code: "00:04", icon: Briefcase },
  { key: "faq", label: "FAQ", code: "00:05", icon: HelpCircle },
  { key: "texts", label: "Pages & Texts", code: "00:06", icon: FileText },
  { key: "seo", label: "SEO & AI", code: "00:07", icon: Search },
  { key: "account", label: "Account", code: "00:08", icon: User },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];
type NavIntent = { action: string; itemId?: number; track?: TrackKey };

/* ------------------------------- Dashboard ------------------------------- */

function Dashboard({
  site,
  go,
}: {
  site: Site;
  go: (section: SectionKey, action?: string, extra?: { itemId?: number; track?: TrackKey }) => void;
}) {
  const toast = useToast();
  const s = site.settings;
  const showreelUrl = s["showreel_video_url"] ?? "";
  const showreelSet = showreelUrl.trim().length > 0;
  const showreelParsed = parseVideo(showreelUrl);
  const showreelThumb =
    showreelParsed?.kind === "youtube" ? youtubeThumb(showreelParsed.id) : null;

  const reels = site.workItems.filter((i) => i.track === "reels");
  const wide = site.workItems.filter((i) => i.track === "wide");
  const square = site.workItems.filter((i) => i.track === "square");
  const videosWith = site.workItems.filter((i) => i.videoUrl.trim()).length;
  const photosWith = site.photos.filter((p) => p.imageUrl.trim()).length;
  const runningPartners = site.partners.filter((p) => p.status === "running").length;
  const partnersNoLogo = site.partners.filter((p) => !p.logoUrl.trim()).length;
  const hasDomain = (s["site_url"] ?? "").trim().length > 0;

  // Completion score calculation
  const checks = [
    {
      label: "Showreel Video",
      detail: showreelSet ? "Main 16:9 showreel ready" : "Add your main showreel YouTube/MP4 link",
      done: showreelSet,
      cta: "Edit Showreel",
      go: () => go("videos", "edit-showreel"),
    },
    {
      label: "Reels (9:16)",
      detail: `${reels.filter((x) => x.videoUrl.trim()).length}/${reels.length} reels linked`,
      done: reels.length > 0 && reels.every((x) => x.videoUrl.trim()),
      cta: "+ Add Reel",
      go: () => go("videos", "add-video", { track: "reels" }),
    },
    {
      label: "Wide Films (16:9)",
      detail: `${wide.filter((x) => x.videoUrl.trim()).length}/${wide.length} wide films linked`,
      done: wide.length > 0 && wide.every((x) => x.videoUrl.trim()),
      cta: "+ Add Wide",
      go: () => go("videos", "add-video", { track: "wide" }),
    },
    {
      label: "Square Videos (1:1)",
      detail: `${square.filter((x) => x.videoUrl.trim()).length}/${square.length} square videos linked`,
      done: square.length > 0 && square.every((x) => x.videoUrl.trim()),
      cta: "+ Add Square",
      go: () => go("videos", "add-video", { track: "square" }),
    },
    {
      label: "Photography Stills",
      detail: `${photosWith}/${site.photos.length} photos uploaded — baki placeholder dekhabe`,
      done: site.photos.length > 0 && photosWith === site.photos.length,
      cta: "Upload Photos",
      go: () => go("photos"),
    },
    {
      label: "Brand Logos (Also Worked With)",
      detail:
        partnersNoLogo > 0
          ? `${partnersNoLogo} ta brand e logo upload baki`
          : "Shob brand e logo ache ✓",
      done: site.partners.length > 0 && partnersNoLogo === 0,
      cta: "Edit Brands",
      go: () => go("journey"),
    },
    {
      label: "Custom Domain / SEO URL",
      detail: hasDomain ? s["site_url"] : "Domain set korle sitemap.xml & canonical ready hobe",
      done: hasDomain,
      cta: "Set Domain",
      go: () => go("seo"),
    },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const pct = Math.round((doneCount / checks.length) * 100);

  const chartData = [
    {
      name: "Reels",
      Ready: reels.filter((x) => x.videoUrl.trim()).length,
      Empty: reels.filter((x) => !x.videoUrl.trim()).length,
    },
    {
      name: "Wide",
      Ready: wide.filter((x) => x.videoUrl.trim()).length,
      Empty: wide.filter((x) => !x.videoUrl.trim()).length,
    },
    {
      name: "Square",
      Ready: square.filter((x) => x.videoUrl.trim()).length,
      Empty: square.filter((x) => !x.videoUrl.trim()).length,
    },
    {
      name: "Photos",
      Ready: photosWith,
      Empty: site.photos.length - photosWith,
    },
  ];

  const kpis = [
    {
      label: "Work Videos",
      value: `${videosWith}/${site.workItems.length}`,
      sub: `Reels ${reels.length} · Wide ${wide.length} · Square ${square.length}`,
      accent: "#ff6a00",
      icon: Clapperboard,
      go: () => go("videos"),
    },
    {
      label: "Photography",
      value: `${photosWith}/${site.photos.length}`,
      sub: "Film-strip frames uploaded",
      accent: "#ffb067",
      icon: Camera,
      go: () => go("photos"),
    },
    {
      label: "Journey & Brands",
      value: `${site.journey.length} · ${site.partners.length}`,
      sub: `${runningPartners} running · ${site.partners.length - runningPartners} past`,
      accent: "#2dd4bf",
      icon: Route,
      go: () => go("journey"),
    },
    {
      label: "Services & FAQ",
      value: `${site.services.length} · ${site.faqs.length}`,
      sub: "Stacking cards & FAQ items",
      accent: "#a493e6",
      icon: Briefcase,
      go: () => go("services"),
    },
  ];

  const copySiteUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast("Site link copied ✓");
    } catch {
      toast("Copy kora jayni.", false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border border-[#ff6a00]/30 bg-gradient-to-br from-[#1b1107] via-[#121216] to-[#0d0d11] p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ff6a00]/30 bg-[#ff6a00]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffb067]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff6a00]" />
              STUDIO CONTROL ROOM · LIVE DB
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-[#f5f1ea]">
              Shagotom, Hasib Mahamud
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#a8a29e]">
              Ekhan theke puro portfolio — video link, chhobi upload, services, journey, contact o SEO
              shob kichu ek click-ei edit ar manage korun.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copySiteUrl} className={btnSecondary}>
              <Copy size={14} /> Copy URL
            </button>
            <a href="/" target="_blank" rel="noopener noreferrer" className={btnPrimary}>
              <ExternalLink size={14} /> Live Site Dekhun
            </a>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => go("videos", "add-video", { track: "reels" })}
            className={btnSecondary}
          >
            <Plus size={14} className="text-[#ff6a00]" /> Add Reel
          </button>
          <button
            type="button"
            onClick={() => go("videos", "add-video", { track: "wide" })}
            className={btnSecondary}
          >
            <Plus size={14} className="text-[#a493e6]" /> Add Wide Video
          </button>
          <button
            type="button"
            onClick={() => go("videos", "add-video", { track: "square" })}
            className={btnSecondary}
          >
            <Plus size={14} className="text-[#2dd4bf]" /> Add Square Video
          </button>
          <button type="button" onClick={() => go("photos", "add-photo")} className={btnSecondary}>
            <Upload size={14} className="text-[#ffb067]" /> Add Photo
          </button>
          <button type="button" onClick={() => go("services", "add-service")} className={btnSecondary}>
            <Plus size={14} /> Add Service
          </button>
          <button type="button" onClick={() => go("faq", "add-faq")} className={btnSecondary}>
            <Plus size={14} /> Add FAQ
          </button>
          <button type="button" onClick={() => go("texts", "edit-contact")} className={btnSecondary}>
            <Pencil size={14} /> Edit Contact
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.label}
              type="button"
              onClick={k.go}
              className="group cursor-pointer rounded-xl border border-[#26241f] bg-[#121216] p-4 text-left transition hover:border-[#ff6a00]/50 hover:bg-[#16161b]"
              style={{ borderTopWidth: 3, borderTopColor: k.accent }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8a29e]">
                  {k.label}
                </span>
                <Icon size={16} style={{ color: k.accent }} />
              </div>
              <p className="mt-2 text-2xl font-black text-[#f5f1ea]">{k.value}</p>
              <p className="mt-1 text-xs text-[#8a8478]">{k.sub}</p>
            </button>
          );
        })}
      </div>

      {/* Chart + Showreel Card + Completion Checklist */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Media Track Chart + Showreel Quick Card */}
        <div className="space-y-5 lg:col-span-5">
          <div className={cardCls}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-[#ff8c3a]">MEDIA TRACKS</p>
                <h3 className="text-base font-bold text-[#f5f1ea]">Ready vs Empty Slots</h3>
              </div>
              <Badge tone="orange">{videosWith + photosWith} READY</Badge>
            </div>
            <div className="mt-4 h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={22}>
                  <XAxis
                    dataKey="name"
                    stroke="#6d675f"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#6d675f"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#141418",
                      borderColor: "#2d2a24",
                      borderRadius: 8,
                      color: "#f5f1ea",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="Ready" stackId="a" fill="#ff6a00" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="Empty" stackId="a" fill="#2a2824" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Active Showreel Card */}
          <div className={cardCls}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-[#ff8c3a]">MAIN SHOWREEL</p>
                <h3 className="text-base font-bold text-[#f5f1ea]">Program Monitor</h3>
              </div>
              <button
                type="button"
                onClick={() => go("videos", "edit-showreel")}
                className={btnSecondary}
              >
                <Pencil size={13} /> Edit
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-[#2d2a24] bg-[#0b0b0e]">
              {showreelThumb ? (
                <div className="relative aspect-video">
                  <img src={showreelThumb} alt="" className="h-full w-full object-cover opacity-85" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff6a00] text-black shadow-lg">
                      <Play size={18} fill="currentColor" />
                    </span>
                  </span>
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center text-xs text-[#8a8478]">
                  Showreel link nei
                </div>
              )}
            </div>
            <p className="mt-2 truncate font-mono text-[11px] text-[#8a8478]">
              {showreelUrl || "No URL set"}
            </p>
          </div>
        </div>

        {/* Right: Site Completion Meter + Checklist */}
        <div className="lg:col-span-7">
          <div className={cardCls}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-[#ff8c3a]">READINESS</p>
                <h3 className="text-base font-bold text-[#f5f1ea]">
                  Site Completion — {pct}% Ready
                </h3>
              </div>
              <Badge tone={pct === 100 ? "ok" : "warn"}>
                {doneCount}/{checks.length} COMPLETE
              </Badge>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#1e1d19]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ff6a00] to-[#ffb067] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-4 divide-y divide-[#22201b]">
              {checks.map((c) => (
                <div key={c.label} className="flex flex-wrap items-center gap-3 py-3">
                  {c.done ? (
                    <CheckCircle2 size={17} className="shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle size={17} className="shrink-0 text-amber-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#f5f1ea]">{c.label}</p>
                    <p className="truncate text-xs text-[#8a8478]">{c.detail}</p>
                  </div>
                  {c.done ? (
                    <Badge tone="ok">Done ✓</Badge>
                  ) : (
                    <button type="button" onClick={c.go} className={btnSecondary}>
                      {c.cta}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Video Shortcuts */}
      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[#ff8c3a]">QUICK EDIT</p>
            <h3 className="text-base font-bold text-[#f5f1ea]">Featured Work Videos</h3>
          </div>
          <button type="button" onClick={() => go("videos")} className={btnSecondary}>
            All Videos ({site.workItems.length}) →
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {site.workItems.slice(0, 6).map((w) => {
            const p = parseVideo(w.videoUrl);
            const thumb = p?.kind === "youtube" ? youtubeThumb(p.id) : null;
            return (
              <div
                key={w.id}
                className="flex items-center gap-3 rounded-lg border border-[#26241f] bg-[#0d0d10] p-2.5"
              >
                {thumb ? (
                  <img src={thumb} alt="" className="h-12 w-16 shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded bg-[#18181d] text-[#6d675f]">
                    <Film size={16} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#f5f1ea]">
                    {w.title || "(no title)"}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase text-[#8a8478]">{w.track}</p>
                </div>
                <button
                  type="button"
                  onClick={() => go("videos", "edit-video", { itemId: w.id })}
                  className={iconBtnCls}
                  aria-label={`Edit ${w.title}`}
                >
                  <Pencil size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Videos -------------------------------- */

function WorkItemFormPage({
  token,
  item,
  defaultTrack,
  newSortOrder,
  onDone,
}: {
  token: string;
  item?: WorkItem;
  defaultTrack: TrackKey;
  newSortOrder: number;
  onDone: () => void;
}) {
  const save = useSaveRow(
    (args: Parameters<typeof api.saveWorkItem>[0]) => api.saveWorkItem(args),
    onDone,
  );
  const [url, setUrl] = useState(item?.videoUrl ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [tag, setTag] = useState(item?.tag ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(item?.thumbnailUrl ?? "");
  const [track, setTrack] = useState<TrackKey>((item?.track as TrackKey) ?? defaultTrack);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [autoNote, setAutoNote] = useState<string>("");

  const lastInspectedRef = useRef<string>(item?.videoUrl?.trim() ?? "");
  const titleAutoRef = useRef<boolean>(false);
  const tagAutoRef = useRef<boolean>(false);
  const thumbAutoRef = useRef<boolean>(false);

  const runInspect = useCallback(
    async (rawUrl: string, forceOverwrite = false) => {
      const cleaned = rawUrl.trim();
      if (!cleaned || !parseVideo(cleaned)) return;
      setFetchingMeta(true);
      try {
        const res = await api.inspectVideoLink({ token, url: cleaned });
        lastInspectedRef.current = cleaned;
        if (res.ok) {
          if (res.track) setTrack(res.track);
          if (res.title && (forceOverwrite || !title.trim() || titleAutoRef.current)) {
            setTitle(res.title);
            titleAutoRef.current = true;
          }
          if (res.tag && (forceOverwrite || !tag.trim() || tagAutoRef.current)) {
            setTag(res.tag);
            tagAutoRef.current = true;
          }
          if (res.thumbnailUrl && (forceOverwrite || !thumbnailUrl.trim() || thumbAutoRef.current)) {
            setThumbnailUrl(res.thumbnailUrl);
            thumbAutoRef.current = true;
          }
        }
        setAutoNote(res.note);
      } catch (e) {
        setAutoNote(e instanceof Error ? e.message : "Auto-fetch failed");
      } finally {
        setFetchingMeta(false);
      }
    },
    [token, title, tag, thumbnailUrl],
  );

  // Auto-inspect whenever a new valid link is pasted/entered.
  useEffect(() => {
    const cleaned = url.trim();
    if (!cleaned || !parseVideo(cleaned) || cleaned === lastInspectedRef.current) return;
    const t = window.setTimeout(() => {
      void runInspect(cleaned, false);
    }, 350);
    return () => window.clearTimeout(t);
  }, [url, runInspect]);

  return (
    <FormShell
      title={item ? "Edit Video" : `Add New Video (${track.toUpperCase()})`}
      subtitle="YouTube / Facebook link paste korlei Title, Track, Tag o Thumbnail auto-fetch hobe; Facebook lock thakle Upload Thumbnail diye cover chhobi dite parben."
      onBack={onDone}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutation.mutate({
            token,
            id: item?.id,
            track,
            title,
            tag,
            videoUrl: url,
            thumbnailUrl,
            sortOrder: item?.sortOrder ?? newSortOrder,
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="work-url">
              1. Video Link — YouTube / Facebook / .mp4 (Paste Link First)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="work-url"
                className={`${inputCls} min-w-[240px] flex-1`}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (!e.target.value.trim()) setAutoNote("");
                }}
                placeholder="https://www.youtube.com/watch?v=… ba https://www.facebook.com/reel/…"
              />
              <button
                type="button"
                disabled={fetchingMeta || !parseVideo(url)}
                onClick={() => void runInspect(url, true)}
                className={btnSecondary}
              >
                <Sparkles size={14} className="text-[#ff8c3a]" />
                {fetchingMeta ? "Fetching…" : "Auto-Fill"}
              </button>
            </div>
            {fetchingMeta ? (
              <p className="mt-1.5 font-mono text-xs text-[#ffb067]">
                Link check kore Title, Track o Tag auto-fetch hocche…
              </p>
            ) : autoNote ? (
              <p className="mt-1.5 font-mono text-xs text-[#ff8c3a]">
                {autoNote}
              </p>
            ) : null}
          </div>

          <div>
            <label className={labelCls} htmlFor="work-title">
              2. Title (Auto-filled for YouTube)
            </label>
            <input
              id="work-title"
              className={inputCls}
              value={title}
              onChange={(e) => {
                titleAutoRef.current = false;
                setTitle(e.target.value);
              }}
              placeholder="Auto-fills on YouTube · Type if Facebook hides title"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="work-track">
              3. Track / Format (Auto-detected)
            </label>
            <select
              id="work-track"
              className={inputCls}
              value={track}
              onChange={(e) => setTrack(e.target.value as TrackKey)}
            >
              {TRACKS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="work-tag">
              4. Tag (Optional — Auto-generated if empty)
            </label>
            <input
              id="work-tag"
              className={inputCls}
              value={tag}
              onChange={(e) => {
                tagAutoRef.current = false;
                setTag(e.target.value);
              }}
              placeholder="Auto-generated (e.g. Vertical · Reels) — na likhleo cholbe"
            />
            <p className="mt-1 text-[11px] text-[#8a8478]">
              Public site card e Track badge দেখায়; tai Tag খালি রাখলেও save করলে auto set hoye jabe.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="work-thumb">
              5. Thumbnail (Auto-fetched · Optional Upload Cover for Facebook / MP4)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="work-thumb"
                className={`${inputCls} min-w-[220px] flex-1`}
                value={thumbnailUrl}
                onChange={(e) => {
                  thumbAutoRef.current = false;
                  setThumbnailUrl(e.target.value);
                }}
                placeholder="Auto-fills or paste / upload cover image…"
              />
              <ImageUploadButton
                token={token}
                label="Upload Thumbnail"
                onUploaded={(nextUrl) => {
                  thumbAutoRef.current = false;
                  setThumbnailUrl(nextUrl);
                }}
              />
              {thumbnailUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    thumbAutoRef.current = false;
                    setThumbnailUrl("");
                  }}
                  className={btnSecondary}
                >
                  Clear
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-[#8a8478]">
              Facebook public link theke auto thumbnail na pele ekhan theke 1 click e cover image upload korte parben.
            </p>
          </div>

          <div className="sm:col-span-2">
            <VideoLinkStatus
              url={url}
              title={title}
              tag={tag}
              thumbnailUrl={thumbnailUrl}
              track={track}
            />
          </div>
        </div>
        <FormFooter pending={save.mutation.isPending} error={save.error} onCancel={onDone} />
      </form>
    </FormShell>
  );
}

function VideosSection({
  token,
  site,
  intent,
  clearIntent,
}: {
  token: string;
  site: Site;
  intent: NavIntent | null;
  clearIntent: () => void;
}) {
  type View =
    | { mode: "list" }
    | { mode: "add"; track: TrackKey }
    | { mode: "edit"; item: WorkItem };
  const [view, setView] = useState<View>({ mode: "list" });
  const [filterTrack, setFilterTrack] = useState<"all" | TrackKey>("all");
  const [search, setSearch] = useState("");
  const [previewItem, setPreviewItem] = useState<WorkItem | null>(null);
  const [confirmItem, setConfirmItem] = useState<WorkItem | null>(null);
  const showreelRef = useRef<HTMLDivElement>(null);

  const del = useDeleteRow(api.deleteWorkItem, token, () => setConfirmItem(null));
  const reorder = useReorder<WorkItem>((item, sortOrder) =>
    api.saveWorkItem({
      token,
      id: item.id,
      track: item.track as TrackKey,
      title: item.title,
      tag: item.tag,
      videoUrl: item.videoUrl,
      thumbnailUrl: item.thumbnailUrl,
      sortOrder,
    }),
  );

  useEffect(() => {
    if (!intent) return;
    if (intent.action === "add-video") {
      setView({ mode: "add", track: intent.track ?? "reels" });
      clearIntent();
    } else if (intent.action === "edit-video" && intent.itemId) {
      const found = site.workItems.find((w) => w.id === intent.itemId);
      if (found) setView({ mode: "edit", item: found });
      clearIntent();
    } else if (intent.action === "edit-showreel") {
      setView({ mode: "list" });
      clearIntent();
      requestAnimationFrame(() =>
        showreelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [intent, clearIntent, site.workItems]);

  if (view.mode !== "list") {
    const item = view.mode === "edit" ? view.item : undefined;
    const track = view.mode === "add" ? view.track : ((item?.track as TrackKey) ?? "reels");
    return (
      <WorkItemFormPage
        token={token}
        item={item}
        defaultTrack={track}
        newSortOrder={site.workItems.filter((i) => i.track === track).length}
        onDone={() => setView({ mode: "list" })}
      />
    );
  }

  const withLinks = site.workItems.filter((i) => i.videoUrl.trim()).length;
  const visibleTracks = TRACKS.filter((t) => filterTrack === "all" || filterTrack === t.key);
  const q = search.trim().toLowerCase();

  return (
    <div className="space-y-8">
      <div ref={showreelRef} className="scroll-mt-24">
        <SectionHead
          kicker="00:02 · PROGRAM MONITOR"
          title="Main Showreel"
          sub="Site er prothom boro video — ekta link bosalei home page e play hobe."
        />
        <ShowreelForm token={token} settings={site.settings} />
      </div>

      <div>
        <SectionHead
          kicker="00:04 · WORK TRACKS"
          title="Work Videos"
          sub={`Mot ${site.workItems.length} ta slot (${withLinks} tay link ache). Prottek track thekei direct Add / Edit / Play Preview kora jabe.`}
          action={
            <button
              type="button"
              onClick={() => setView({ mode: "add", track: filterTrack === "all" ? "reels" : filterTrack })}
              className={btnPrimary}
            >
              <Plus size={15} /> Add Video
            </button>
          }
        />

        {/* Track Filter + Search */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterTrack("all")}
              className={`cursor-pointer rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
                filterTrack === "all"
                  ? "bg-[#ff6a00] text-black"
                  : "border border-[#2d2a24] bg-[#141418] text-[#a8a29e] hover:text-white"
              }`}
            >
              All ({site.workItems.length})
            </button>
            {TRACKS.map((t) => {
              const count = site.workItems.filter((i) => i.track === t.key).length;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilterTrack(t.key)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
                    filterTrack === t.key
                      ? "bg-[#ff6a00] text-black"
                      : "border border-[#2d2a24] bg-[#141418] text-[#a8a29e] hover:text-white"
                  }`}
                >
                  {t.short} ({count})
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-64">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6d675f]"
            />
            <input
              className={`${inputCls} pl-8`}
              placeholder="Search video title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-6">
          {visibleTracks.map((t) => {
            const allTrackItems = site.workItems.filter((i) => i.track === t.key);
            const items = q
              ? allTrackItems.filter(
                  (i) =>
                    i.title.toLowerCase().includes(q) ||
                    i.tag.toLowerCase().includes(q),
                )
              : allTrackItems;
            const filled = allTrackItems.filter((i) => i.videoUrl.trim()).length;
            return (
              <div key={t.key}>
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex flex-wrap items-center gap-2.5 text-sm font-bold text-[#f5f1ea]">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: t.accent }}
                    />
                    {t.label}
                    <span className="font-mono text-xs font-normal text-[#8a8478]">
                      {filled}/{allTrackItems.length} linked
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setView({ mode: "add", track: t.key })}
                    className={btnSecondary}
                  >
                    <Plus size={14} /> Add {t.short}
                  </button>
                </div>
                <ListCard>
                  {items.length === 0 ? (
                    <EmptyRow text="Ei track e kono video match kore ni — uporer Add button chap din." />
                  ) : (
                    items.map((item) => {
                      const fullIdx = allTrackItems.findIndex((x) => x.id === item.id);
                      const parsed = parseVideo(item.videoUrl);
                      const thumb =
                        item.thumbnailUrl.trim() ||
                        (parsed?.kind === "youtube" ? youtubeThumb(parsed.id) : null);
                      const has = item.videoUrl.trim().length > 0;
                      const kindTag =
                        parsed?.kind === "youtube"
                          ? "YOUTUBE ✓"
                          : parsed?.kind === "facebook"
                            ? "FACEBOOK ✓"
                            : parsed?.kind === "mp4"
                              ? "MP4 ✓"
                              : "NO LINK";
                      return (
                        <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="h-12 w-[4.8rem] shrink-0 rounded-md border border-[#2d2a24] object-cover"
                            />
                          ) : (
                            <span className="flex h-12 w-[4.8rem] shrink-0 items-center justify-center rounded-md border border-[#26241f] bg-[#0b0b0e] text-[#6d675f]">
                              <Film size={18} />
                            </span>
                          )}
                          <div className="min-w-0 flex-1 basis-40">
                            <p className="truncate text-sm font-semibold text-[#f5f1ea]">
                              {item.title || "(no title)"}
                            </p>
                            <p className="truncate text-xs text-[#8a8478]">{item.tag || "—"}</p>
                          </div>
                          <Badge tone={has ? "ok" : "warn"}>{kindTag}</Badge>
                          <RowActions
                            extra={
                              has ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewItem(item)}
                                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#2d2a24] bg-[#18181d] px-2.5 py-1.5 text-xs font-semibold text-[#ffb067] transition hover:border-[#ff6a00]/60"
                                >
                                  <Eye size={12} /> Preview
                                </button>
                              ) : undefined
                            }
                            onEdit={() => setView({ mode: "edit", item })}
                            onDelete={() => setConfirmItem(item)}
                            onMoveUp={
                              !q && fullIdx > 0
                                ? () => {
                                    const next = moved(allTrackItems, fullIdx, -1);
                                    if (next) reorder.mutate(next);
                                  }
                                : undefined
                            }
                            onMoveDown={
                              !q && fullIdx < allTrackItems.length - 1
                                ? () => {
                                    const next = moved(allTrackItems, fullIdx, 1);
                                    if (next) reorder.mutate(next);
                                  }
                                : undefined
                            }
                            movePending={reorder.isPending}
                          />
                        </div>
                      );
                    })
                  )}
                </ListCard>
              </div>
            );
          })}
        </div>
      </div>

      {previewItem ? (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview: ${previewItem.title}`}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#2d2a24] bg-[#121216] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="truncate text-sm font-bold text-[#f5f1ea]">{previewItem.title}</p>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className={iconBtnCls}
                aria-label="Close preview"
              >
                <X size={16} />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <VideoSlot
                url={previewItem.videoUrl}
                title={previewItem.title}
                tag={previewItem.tag}
                thumbnailUrl={previewItem.thumbnailUrl}
                frameLabel="PREVIEW"
              />
            </div>
          </div>
        </div>
      ) : null}

      {confirmItem ? (
        <ConfirmDialog
          title="Video delete korben?"
          body={`“${confirmItem.title || "(no title)"}” — ei video slot ta site theke chole jabe.`}
          pending={del.isPending}
          onCancel={() => setConfirmItem(null)}
          onConfirm={() => del.mutate(confirmItem.id)}
        />
      ) : null}
    </div>
  );
}

/* --------------------------------- Photos -------------------------------- */

const PHOTO_CATEGORIES = [
  "Wedding",
  "Product",
  "Clothing",
  "Portrait",
  "Fashion",
  "Event",
  "Food",
  "Street",
] as const;

function inferPhotoMeta(
  source: string,
  fallbackIndex = 1,
): { title: string; category: string } {
  let raw = source.trim();
  try {
    if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) {
      const cleanPath = decodeURIComponent(raw.split("?")[0] ?? "");
      raw = cleanPath.split("/").pop() ?? raw;
    }
  } catch {
    // keep raw
  }

  // Strip extension and generated upload timestamp/hash suffix (e.g. -17956...-abc12)
  let stem = raw
    .replace(/\.[^.]+$/, "")
    .replace(/-\d{10,}-[a-z0-9]{4,}$/i, "");

  const lower = stem.toLowerCase();
  const category = /wedding|bride|bridal|holud|halud|biye|ashirbad|couple|nikah/.test(lower)
    ? "Wedding"
    : /shirt|panjabi|saree|clothing|apparel|garment|dress|outfit|hoodie|tshirt/.test(lower)
      ? "Clothing"
      : /product|bottle|watch|shoe|bag|box|perfume|ecommerce|cosmetic/.test(lower)
        ? "Product"
        : /fashion|editorial|lookbook|model|style/.test(lower)
          ? "Fashion"
          : /portrait|headshot|studio|face|profile/.test(lower)
            ? "Portrait"
            : /event|stage|party|concert|festival|program/.test(lower)
              ? "Event"
              : /food|cafe|coffee|burger|cake|dish|restaurant|biryani/.test(lower)
                ? "Food"
                : /street|dhaka|city|night|traffic|rickshaw/.test(lower)
                  ? "Street"
                  : "Photography";

  const isCameraGeneric =
    /^(img|dsc|pxl|mvimg|vid|fb_img|whatsapp image|screenshot|photo|image)[_\-\s\d]*$/i.test(
      stem,
    ) ||
    /^\d{6,}(?:[_\-\s]\d+)*(?:_[no])?$/i.test(stem);

  let title = "";
  if (!stem || isCameraGeneric) {
    const num = String(Math.max(1, fallbackIndex)).padStart(2, "0");
    title = category === "Photography" ? `Studio Frame #${num}` : `${category} Frame #${num}`;
  } else {
    title = stem
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .slice(0, 80);
  }

  return { title, category };
}

function PhotoFormPage({
  token,
  item,
  newSortOrder,
  onDone,
}: {
  token: string;
  item?: Photo;
  newSortOrder: number;
  onDone: () => void;
}) {
  const save = useSaveRow(
    (args: Parameters<typeof api.savePhoto>[0]) => api.savePhoto(args),
    onDone,
  );
  const toast = useToast();
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [autoNote, setAutoNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const [dropping, setDropping] = useState(false);

  const titleAutoRef = useRef(false);
  const catAutoRef = useRef(false);

  const applyAutoMeta = (source: string, force = false) => {
    if (!source.trim()) return;
    const meta = inferPhotoMeta(source, newSortOrder + 1);
    let updated = false;
    if (force || !title.trim() || titleAutoRef.current) {
      setTitle(meta.title);
      titleAutoRef.current = true;
      updated = true;
    }
    if (force || !category.trim() || catAutoRef.current) {
      setCategory(meta.category);
      catAutoRef.current = true;
      updated = true;
    }
    if (updated) {
      setAutoNote(`Auto-filled: "${meta.title}" · ${meta.category}`);
    }
  };

  const handleUploaded = (url: string, fileName?: string) => {
    setImageUrl(url);
    applyAutoMeta(fileName || url, false);
  };

  const handleDropFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Sudhu image file (PNG, JPG, WEBP, GIF) drop korun.", false);
      return;
    }
    setDropping(true);
    try {
      const url = await uploadImageFile(token, file);
      handleUploaded(url, file.name);
      toast("Photo uploaded & auto-filled ✓");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed.", false);
    } finally {
      setDropping(false);
    }
  };

  return (
    <FormShell
      title={item ? "Edit Photo" : "Add New Photo"}
      subtitle="Chhobi upload ba drag-and-drop korlei Title o Category nijei auto bose jabe!"
      onBack={onDone}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fallback = inferPhotoMeta(imageUrl, newSortOrder + 1);
          save.mutation.mutate({
            token,
            id: item?.id,
            title: title.trim() || fallback.title,
            category: category.trim() || fallback.category,
            imageUrl,
            sortOrder: item?.sortOrder ?? newSortOrder,
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="photo-imageUrl">
              1. Photo Image (Upload / Drag &amp; Drop / URL)
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void handleDropFile(e.dataTransfer.files?.[0]);
              }}
              className={`rounded-xl border border-dashed p-3 transition ${
                dragging
                  ? "border-[#ff6a00] bg-[#ff6a00]/10"
                  : "border-[#2d2a24] bg-[#0e0e12]"
              }`}
            >
              <div className="flex flex-wrap gap-2">
                <input
                  id="photo-imageUrl"
                  className={`${inputCls} flex-1`}
                  value={imageUrl}
                  onChange={(e) => {
                    const next = e.target.value;
                    setImageUrl(next);
                    if (/^https?:\/\/|^\//i.test(next.trim())) {
                      applyAutoMeta(next, false);
                    }
                  }}
                  placeholder="Chhobi drag & drop korun, Upload chap din, ba image URL paste korun…"
                />
                <ImageUploadButton
                  token={token}
                  onUploaded={handleUploaded}
                  label={dropping ? "Uploading…" : "Upload Photo"}
                />
                {imageUrl.trim() ? (
                  <button
                    type="button"
                    onClick={() => applyAutoMeta(imageUrl, true)}
                    className={btnSecondary}
                  >
                    <Sparkles size={14} className="text-[#ff8c3a]" />
                    Auto-Fill
                  </button>
                ) : null}
              </div>
              {autoNote ? (
                <p className="mt-2 font-mono text-xs text-[#ff8c3a]">{autoNote}</p>
              ) : (
                <p className="mt-2 text-xs text-[#8a8478]">
                  Tip: PC theke jekono photo drag kore ekhane chharle ba Upload Photo dile Title o Category auto-fill hobe.
                </p>
              )}
              {imageUrl.trim() ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="mt-3 max-h-56 rounded-lg border border-[#2d2a24] object-cover"
                />
              ) : null}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="photo-title">
              2. Title (Auto-filled — Edit anytime)
            </label>
            <input
              id="photo-title"
              className={inputCls}
              value={title}
              onChange={(e) => {
                titleAutoRef.current = false;
                setTitle(e.target.value);
              }}
              placeholder="Auto-fills on upload (e.g. Wedding Day)"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="photo-category">
              3. Category (Auto-detected)
            </label>
            <input
              id="photo-category"
              className={inputCls}
              value={category}
              onChange={(e) => {
                catAutoRef.current = false;
                setCategory(e.target.value);
              }}
              placeholder="Auto-fills (e.g. Wedding)"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PHOTO_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    catAutoRef.current = false;
                    setCategory(cat);
                  }}
                  className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold transition ${
                    category.trim().toLowerCase() === cat.toLowerCase()
                      ? "border-[#ff6a00] bg-[#ff6a00]/20 text-[#ffb067]"
                      : "border-[#2d2a24] bg-[#141418] text-[#8a8478] hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
        <FormFooter pending={save.mutation.isPending} error={save.error} onCancel={onDone} />
      </form>
    </FormShell>
  );
}

function PhotosSection({
  token,
  site,
  intent,
  clearIntent,
}: {
  token: string;
  site: Site;
  intent: NavIntent | null;
  clearIntent: () => void;
}) {
  type View = { mode: "list" } | { mode: "add" } | { mode: "edit"; item: Photo };
  const [view, setView] = useState<View>({ mode: "list" });
  const [confirmItem, setConfirmItem] = useState<Photo | null>(null);
  const [batchStatus, setBatchStatus] = useState<string>("");
  const batchInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const del = useDeleteRow(api.deletePhoto, token, () => setConfirmItem(null));
  const reorder = useReorder<Photo>((item, sortOrder) =>
    api.savePhoto({
      token,
      id: item.id,
      title: item.title,
      category: item.category,
      imageUrl: item.imageUrl,
      sortOrder,
    }),
  );

  const handleBatchUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    let savedCount = 0;
    const baseOrder = site.photos.length;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f) continue;
        setBatchStatus(`Uploading ${i + 1}/${files.length}: ${f.name}…`);
        const url = await uploadImageFile(token, f);
        const meta = inferPhotoMeta(f.name, baseOrder + i + 1);
        await api.savePhoto({
          token,
          title: meta.title,
          category: meta.category,
          imageUrl: url,
          sortOrder: baseOrder + i,
        });
        savedCount++;
      }
      await qc.invalidateQueries();
      toast(`${savedCount} ta photo auto-upload o save hoyeche ✓`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Batch upload failed.", false);
    } finally {
      setBatchStatus("");
    }
  };

  useEffect(() => {
    if (intent?.action === "add-photo") {
      setView({ mode: "add" });
      clearIntent();
    }
  }, [intent, clearIntent]);

  if (view.mode !== "list") {
    return (
      <PhotoFormPage
        token={token}
        item={view.mode === "edit" ? view.item : undefined}
        newSortOrder={site.photos.length}
        onDone={() => setView({ mode: "list" })}
      />
    );
  }

  const withImg = site.photos.filter((p) => p.imageUrl.trim()).length;
  return (
    <div>
      <input
        ref={batchInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleBatchUpload}
      />
      <SectionHead
        kicker="00:04 · P1 FILM STRIP"
        title="Photography Photos"
        sub={`${site.photos.length} ta frame — ${withImg} tay chhobi ache. Quick Upload dile ekshathe ekadhik chhobi Title o Category-shoho auto save hobe!`}
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(batchStatus)}
              onClick={() => batchInputRef.current?.click()}
              className={btnSecondary}
            >
              <Sparkles size={14} className="text-[#ff8c3a]" />
              {batchStatus || "Quick Upload (Auto)"}
            </button>
            <button type="button" onClick={() => setView({ mode: "add" })} className={btnPrimary}>
              <Plus size={15} /> Add Photo
            </button>
          </div>
        }
      />

      {site.photos.length === 0 ? (
        <div className={cardCls}>
          <EmptyRow text="Ekhono kono photo nei — Add Photo chap diye prothom photo jog korun." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {site.photos.map((p, idx) => {
            const has = p.imageUrl.trim().length > 0;
            return (
              <div
                key={p.id}
                className="overflow-hidden rounded-xl border border-[#26241f] bg-[#121216] shadow-sm"
              >
                <div className="relative aspect-[3/2] bg-[#0b0b0e]">
                  {has ? (
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[#6d675f]">
                      <Camera size={24} />
                      <span className="font-mono text-[10px] tracking-widest">NO IMAGE</span>
                    </div>
                  )}
                  <span className="absolute right-2.5 top-2.5">
                    <Badge tone={has ? "ok" : "warn"}>{has ? "READY ✓" : "EMPTY"}</Badge>
                  </span>
                </div>
                <div className="p-3.5">
                  <p className="truncate text-sm font-bold text-[#f5f1ea]">
                    {p.title || "(no title)"}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] uppercase text-[#ffb067]">
                    {p.category || "—"}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={idx === 0 || reorder.isPending}
                        onClick={() => {
                          const next = moved(site.photos, idx, -1);
                          if (next) reorder.mutate(next);
                        }}
                        className={iconBtnCls}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={idx === site.photos.length - 1 || reorder.isPending}
                        onClick={() => {
                          const next = moved(site.photos, idx, 1);
                          if (next) reorder.mutate(next);
                        }}
                        className={iconBtnCls}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setView({ mode: "edit", item: p })}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#2d2a24] bg-[#18181d] px-2.5 py-1.5 text-xs font-semibold text-[#f5f1ea] hover:border-[#ff6a00]/60"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button type="button" onClick={() => setConfirmItem(p)} className={btnDanger}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmItem ? (
        <ConfirmDialog
          title="Photo delete korben?"
          body={`“${confirmItem.title || "(no title)"}” — ei photo ta film-strip theke chole jabe.`}
          pending={del.isPending}
          onCancel={() => setConfirmItem(null)}
          onConfirm={() => del.mutate(confirmItem.id)}
        />
      ) : null}
    </div>
  );
}

/* --------------------------------- Journey ------------------------------- */

function ChapterFormPage({
  token,
  item,
  newSortOrder,
  onDone,
}: {
  token: string;
  item?: Chapter;
  newSortOrder: number;
  onDone: () => void;
}) {
  const save = useSaveRow(
    (args: Parameters<typeof api.saveJourneyChapter>[0]) => api.saveJourneyChapter(args),
    onDone,
  );
  return (
    <FormShell
      title={item ? "Edit Journey Chapter" : "Add Journey Chapter"}
      subtitle="My Journey section e ei chapter ta timeline clip hishebe dekhabe."
      onBack={onDone}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          save.mutation.mutate({
            token,
            id: item?.id,
            period: str(fd, "period"),
            role: str(fd, "role"),
            org: str(fd, "org"),
            description: str(fd, "description"),
            clipLabel: str(fd, "clipLabel"),
            sortOrder: item?.sortOrder ?? newSortOrder,
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Period (e.g. 2024 — Present)" name="period" defaultValue={item?.period} />
          <Field label="Clip label (e.g. journey_03.mp4 · A1)" name="clipLabel" defaultValue={item?.clipLabel} />
          <Field label="Role" name="role" defaultValue={item?.role} />
          <Field label="Company / Studio" name="org" defaultValue={item?.org} />
          <div className="sm:col-span-2">
            <Field label="Description" name="description" textarea rows={3} defaultValue={item?.description} />
          </div>
        </div>
        <FormFooter pending={save.mutation.isPending} error={save.error} onCancel={onDone} />
      </form>
    </FormShell>
  );
}

function PartnerFormPage({
  token,
  item,
  newSortOrder,
  onDone,
}: {
  token: string;
  item?: Partner;
  newSortOrder: number;
  onDone: () => void;
}) {
  const save = useSaveRow(
    (args: Parameters<typeof api.savePartner>[0]) => api.savePartner(args),
    onDone,
  );
  const [logoUrl, setLogoUrl] = useState(item?.logoUrl ?? "");
  return (
    <FormShell
      title={item ? "Edit Part-Time Brand" : "Add Part-Time Brand"}
      subtitle="Journey section er “Also Worked With” marquee wall e ei brand ta dekhabe."
      onBack={onDone}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          save.mutation.mutate({
            token,
            id: item?.id,
            name: str(fd, "name"),
            logoUrl,
            pageUrl: str(fd, "pageUrl").trim(),
            status: str(fd, "status") === "past" ? "past" : "running",
            sortOrder: item?.sortOrder ?? newSortOrder,
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Page / Brand Name" name="name" defaultValue={item?.name} />
          <div>
            <label className={labelCls} htmlFor="partner-status">
              Status
            </label>
            <select
              id="partner-status"
              name="status"
              defaultValue={item?.status ?? "running"}
              className={inputCls}
            >
              <option value="running">Running (orange dot)</option>
              <option value="past">Past (grey dot)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Page / Website Link (URL, optional)"
              name="pageUrl"
              defaultValue={item?.pageUrl}
              placeholder="https://www.facebook.com/yourpage"
              help="Ei link dile site e page er card e click korlei sorasori page e chole jabe."
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="partner-logoUrl">
              Logo Image (Upload or URL, optional)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="partner-logoUrl"
                className={`${inputCls} flex-1`}
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…/logo.png or upload from computer"
              />
              <ImageUploadButton token={token} onUploaded={setLogoUrl} label="Upload Logo" />
            </div>
            {logoUrl.trim() ? (
              <img
                src={logoUrl}
                alt=""
                className="mt-3 max-h-16 rounded-lg border border-[#2d2a24] bg-[#0b0b0e] object-contain p-1.5"
              />
            ) : (
              <p className="mt-1.5 text-xs text-[#8a8478]">
                Logo na dile site e sudhu page er naam dekhabe.
              </p>
            )}
          </div>
        </div>
        <FormFooter pending={save.mutation.isPending} error={save.error} onCancel={onDone} />
      </form>
    </FormShell>
  );
}

function JourneySection({ token, site }: { token: string; site: Site }) {
  type View =
    | { mode: "list" }
    | { mode: "chapter-add" }
    | { mode: "chapter-edit"; item: Chapter }
    | { mode: "partner-add" }
    | { mode: "partner-edit"; item: Partner };
  const [view, setView] = useState<View>({ mode: "list" });
  const [confirm, setConfirm] = useState<
    { kind: "chapter"; item: Chapter } | { kind: "partner"; item: Partner } | null
  >(null);
  const delChapter = useDeleteRow(api.deleteJourneyChapter, token, () => setConfirm(null));
  const delPartner = useDeleteRow(api.deletePartner, token, () => setConfirm(null));
  const reorderChapters = useReorder<Chapter>((item, sortOrder) =>
    api.saveJourneyChapter({
      token,
      id: item.id,
      period: item.period,
      role: item.role,
      org: item.org,
      description: item.description,
      clipLabel: item.clipLabel,
      sortOrder,
    }),
  );
  const reorderPartners = useReorder<Partner>((item, sortOrder) =>
    api.savePartner({
      token,
      id: item.id,
      name: item.name,
      logoUrl: item.logoUrl,
      pageUrl: item.pageUrl,
      status: item.status === "past" ? "past" : "running",
      sortOrder,
    }),
  );

  if (view.mode === "chapter-add" || view.mode === "chapter-edit") {
    return (
      <ChapterFormPage
        token={token}
        item={view.mode === "chapter-edit" ? view.item : undefined}
        newSortOrder={site.journey.length}
        onDone={() => setView({ mode: "list" })}
      />
    );
  }
  if (view.mode === "partner-add" || view.mode === "partner-edit") {
    return (
      <PartnerFormPage
        token={token}
        item={view.mode === "partner-edit" ? view.item : undefined}
        newSortOrder={site.partners.length}
        onDone={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionHead
          kicker="00:03 · TIMELINE"
          title="Journey Chapters"
          sub="Apnar career er prottek chapter — edit ba reorder korun."
          action={
            <button type="button" onClick={() => setView({ mode: "chapter-add" })} className={btnPrimary}>
              <Plus size={15} /> Add Chapter
            </button>
          }
        />
        <ListCard>
          {site.journey.length === 0 ? (
            <EmptyRow text="Ekhono kono chapter nei — Add Chapter chap diye jog korun." />
          ) : (
            site.journey.map((c, idx) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#2d2a24] bg-[#18181d] text-[#ff8c3a]">
                  <Route size={18} />
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-bold text-[#f5f1ea]">
                    {c.period} — {c.org || c.role}
                  </p>
                  <p className="truncate text-xs text-[#8a8478]">
                    {c.role} · {c.clipLabel}
                  </p>
                </div>
                <RowActions
                  onEdit={() => setView({ mode: "chapter-edit", item: c })}
                  onDelete={() => setConfirm({ kind: "chapter", item: c })}
                  onMoveUp={
                    idx > 0
                      ? () => {
                          const next = moved(site.journey, idx, -1);
                          if (next) reorderChapters.mutate(next);
                        }
                      : undefined
                  }
                  onMoveDown={
                    idx < site.journey.length - 1
                      ? () => {
                          const next = moved(site.journey, idx, 1);
                          if (next) reorderChapters.mutate(next);
                        }
                      : undefined
                  }
                  movePending={reorderChapters.isPending}
                />
              </div>
            ))
          )}
        </ListCard>
      </div>

      <div>
        <SectionHead
          kicker="00:03 · LOGO WALL"
          title="Part-Time Pages — Also Worked With"
          sub="Je page/brand gular jonno part-time kaj korechen. PC theke logo upload kora jabe."
          action={
            <button type="button" onClick={() => setView({ mode: "partner-add" })} className={btnPrimary}>
              <Plus size={15} /> Add Brand
            </button>
          }
        />
        <ListCard>
          {site.partners.length === 0 ? (
            <EmptyRow text="Ekhono kono page nei — Add Brand chap diye jog korun." />
          ) : (
            site.partners.map((p, idx) => {
              const hasLogo = p.logoUrl.trim().length > 0;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  {hasLogo ? (
                    <img
                      src={p.logoUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-lg border border-[#2d2a24] bg-[#0b0b0e] object-contain p-1"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#2d2a24] bg-[#18181d] text-[#6d675f]">
                      <ImageIcon size={18} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-sm font-bold text-[#f5f1ea]">
                      {p.name || "(no name)"}
                    </p>
                    <p className="truncate text-xs text-[#8a8478]">
                      {hasLogo ? "Logo uploaded ✓" : "Logo nei"}
                      {p.pageUrl ? ` · ${p.pageUrl}` : " · Link nei"}
                    </p>
                  </div>
                  <Badge tone={p.status === "running" ? "orange" : "neutral"}>
                    {p.status === "running" ? "RUNNING" : "PAST"}
                  </Badge>
                  <RowActions
                    onEdit={() => setView({ mode: "partner-edit", item: p })}
                    onDelete={() => setConfirm({ kind: "partner", item: p })}
                    onMoveUp={
                      idx > 0
                        ? () => {
                            const next = moved(site.partners, idx, -1);
                            if (next) reorderPartners.mutate(next);
                          }
                        : undefined
                    }
                    onMoveDown={
                      idx < site.partners.length - 1
                        ? () => {
                            const next = moved(site.partners, idx, 1);
                            if (next) reorderPartners.mutate(next);
                          }
                        : undefined
                    }
                    movePending={reorderPartners.isPending}
                  />
                </div>
              );
            })
          )}
        </ListCard>
      </div>

      {confirm ? (
        <ConfirmDialog
          title={confirm.kind === "chapter" ? "Chapter delete korben?" : "Brand delete korben?"}
          body={
            confirm.kind === "chapter"
              ? `“${confirm.item.period} — ${confirm.item.org || confirm.item.role}” chapter ta Journey theke chole jabe.`
              : `“${confirm.item.name || "(no name)"}” brand ta Also Worked With theke chole jabe.`
          }
          pending={confirm.kind === "chapter" ? delChapter.isPending : delPartner.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            confirm.kind === "chapter"
              ? delChapter.mutate(confirm.item.id)
              : delPartner.mutate(confirm.item.id)
          }
        />
      ) : null}
    </div>
  );
}

/* -------------------------------- Services ------------------------------- */

function ServiceFormPage({
  token,
  item,
  newSortOrder,
  onDone,
}: {
  token: string;
  item?: Service;
  newSortOrder: number;
  onDone: () => void;
}) {
  const save = useSaveRow(
    (args: Parameters<typeof api.saveService>[0]) => api.saveService(args),
    onDone,
  );
  const [chips, setChips] = useState<string[]>(item?.chips ?? []);
  const [chipDraft, setChipDraft] = useState("");
  const [toolBadges, setToolBadges] = useState(item?.toolBadges ?? "");
  const [isNew, setIsNew] = useState(item?.isNew ?? false);

  const addChip = () => {
    const parts = chipDraft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setChips((prev) => [...prev, ...parts]);
    setChipDraft("");
  };

  return (
    <FormShell
      title={item ? "Edit Service" : "Add New Service"}
      subtitle="Services section e ei card ta stacking layer hishebe dekhabe."
      onBack={onDone}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          save.mutation.mutate({
            token,
            id: item?.id,
            kicker: str(fd, "kicker"),
            title: str(fd, "title"),
            description: str(fd, "description"),
            chips,
            toolBadges,
            isNew,
            sortOrder: item?.sortOrder ?? newSortOrder,
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" name="title" defaultValue={item?.title} />
          <Field label="Category (kicker)" name="kicker" defaultValue={item?.kicker} />
          <div className="sm:col-span-2">
            <Field label="Description" name="description" textarea rows={3} defaultValue={item?.description} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="service-chip-draft">
              Service Highlights / Work Chips
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {chips.map((c, idx) => (
                <span
                  key={`${c}-${idx}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ff6a00]/40 bg-[#ff6a00]/10 px-3 py-1 text-xs font-semibold text-[#f5f1ea]"
                >
                  {c}
                  <button
                    type="button"
                    aria-label={`Remove ${c}`}
                    onClick={() => setChips((p) => p.filter((_, j) => j !== idx))}
                    className="cursor-pointer text-[#ffb067] hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="service-chip-draft"
                className={inputCls}
                value={chipDraft}
                onChange={(e) => setChipDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChip();
                  }
                }}
                placeholder="Notun highlight likhe Enter ba Add chap din"
              />
              <button type="button" onClick={addChip} className={btnSecondary}>
                <Plus size={14} /> Add Chip
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="service-toolBadges">
              Tool Badges
            </label>
            <input
              id="service-toolBadges"
              className={inputCls}
              value={toolBadges}
              onChange={(e) => setToolBadges(e.target.value)}
              placeholder="Pr · Ae — Premiere Pro · After Effects"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                "Pr — Premiere Pro",
                "Ae — After Effects",
                "Ps · Lr — Photoshop · Lightroom",
                "Pr · Ae — Premiere Pro · After Effects",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setToolBadges(preset)}
                  className="cursor-pointer rounded border border-[#2d2a24] bg-[#18181d] px-2 py-1 font-mono text-[10px] text-[#a8a29e] hover:border-[#ff6a00]/50 hover:text-white"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 self-start pt-7 text-sm font-medium text-[#f5f1ea]">
            <input
              type="checkbox"
              checked={isNew}
              onChange={(e) => setIsNew(e.target.checked)}
              className="h-4 w-4 accent-[#ff6a00]"
            />
            Show “NEW” badge on this card
          </label>
        </div>
        <FormFooter pending={save.mutation.isPending} error={save.error} onCancel={onDone} />
      </form>
    </FormShell>
  );
}

function ServicesSection({
  token,
  site,
  intent,
  clearIntent,
}: {
  token: string;
  site: Site;
  intent: NavIntent | null;
  clearIntent: () => void;
}) {
  type View = { mode: "list" } | { mode: "add" } | { mode: "edit"; item: Service };
  const [view, setView] = useState<View>({ mode: "list" });
  const [confirmItem, setConfirmItem] = useState<Service | null>(null);
  const del = useDeleteRow(api.deleteService, token, () => setConfirmItem(null));
  const reorder = useReorder<Service>((item, sortOrder) =>
    api.saveService({
      token,
      id: item.id,
      kicker: item.kicker,
      title: item.title,
      description: item.description,
      chips: item.chips,
      toolBadges: item.toolBadges,
      isNew: item.isNew,
      sortOrder,
    }),
  );

  useEffect(() => {
    if (intent?.action === "add-service") {
      setView({ mode: "add" });
      clearIntent();
    }
  }, [intent, clearIntent]);

  if (view.mode !== "list") {
    return (
      <ServiceFormPage
        token={token}
        item={view.mode === "edit" ? view.item : undefined}
        newSortOrder={site.services.length}
        onDone={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div>
      <SectionHead
        kicker="00:05 · SERVICES"
        title="Services"
        sub={`${site.services.length} ta stacking service card — Edit ba Add korun.`}
        action={
          <button type="button" onClick={() => setView({ mode: "add" })} className={btnPrimary}>
            <Plus size={15} /> Add Service
          </button>
        }
      />
      <ListCard>
        {site.services.length === 0 ? (
          <EmptyRow text="Ekhono kono service nei — Add Service chap diye jog korun." />
        ) : (
          site.services.map((sv, idx) => (
            <div key={sv.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#2d2a24] bg-[#18181d] font-mono text-sm font-bold text-[#ffb067]">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="flex flex-wrap items-center gap-2 truncate text-sm font-bold text-[#f5f1ea]">
                  {sv.title || "(no title)"}
                  {sv.isNew ? <Badge tone="orange">NEW</Badge> : null}
                </p>
                <p className="truncate text-xs text-[#8a8478]">
                  {sv.kicker || "—"} · {sv.chips.length} chips · {sv.toolBadges || "no tool badge"}
                </p>
              </div>
              <RowActions
                onEdit={() => setView({ mode: "edit", item: sv })}
                onDelete={() => setConfirmItem(sv)}
                onMoveUp={
                  idx > 0
                    ? () => {
                        const next = moved(site.services, idx, -1);
                        if (next) reorder.mutate(next);
                      }
                    : undefined
                }
                onMoveDown={
                  idx < site.services.length - 1
                    ? () => {
                        const next = moved(site.services, idx, 1);
                        if (next) reorder.mutate(next);
                      }
                    : undefined
                }
                movePending={reorder.isPending}
              />
            </div>
          ))
        )}
      </ListCard>
      {confirmItem ? (
        <ConfirmDialog
          title="Service delete korben?"
          body={`“${confirmItem.title || "(no title)"}” service card ta site theke chole jabe.`}
          pending={del.isPending}
          onCancel={() => setConfirmItem(null)}
          onConfirm={() => del.mutate(confirmItem.id)}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------- FAQ ---------------------------------- */

function FaqFormPage({
  token,
  item,
  newSortOrder,
  onDone,
}: {
  token: string;
  item?: Faq;
  newSortOrder: number;
  onDone: () => void;
}) {
  const save = useSaveRow(
    (args: Parameters<typeof api.saveFaq>[0]) => api.saveFaq(args),
    onDone,
  );
  return (
    <FormShell
      title={item ? "Edit FAQ" : "Add New FAQ"}
      subtitle="Ei proshno-uttor gula Google ar AI search (JSON-LD) eo kaj kore."
      onBack={onDone}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          save.mutation.mutate({
            token,
            id: item?.id,
            question: str(fd, "question"),
            answer: str(fd, "answer"),
            sortOrder: item?.sortOrder ?? newSortOrder,
          });
        }}
      >
        <div className="grid gap-4">
          <Field label="Question" name="question" defaultValue={item?.question} />
          <Field label="Answer" name="answer" textarea rows={4} defaultValue={item?.answer} />
        </div>
        <FormFooter pending={save.mutation.isPending} error={save.error} onCancel={onDone} />
      </form>
    </FormShell>
  );
}

function FaqSection({
  token,
  site,
  intent,
  clearIntent,
}: {
  token: string;
  site: Site;
  intent: NavIntent | null;
  clearIntent: () => void;
}) {
  type View = { mode: "list" } | { mode: "add" } | { mode: "edit"; item: Faq };
  const [view, setView] = useState<View>({ mode: "list" });
  const [confirmItem, setConfirmItem] = useState<Faq | null>(null);
  const del = useDeleteRow(api.deleteFaq, token, () => setConfirmItem(null));
  const reorder = useReorder<Faq>((item, sortOrder) =>
    api.saveFaq({
      token,
      id: item.id,
      question: item.question,
      answer: item.answer,
      sortOrder,
    }),
  );

  useEffect(() => {
    if (intent?.action === "add-faq") {
      setView({ mode: "add" });
      clearIntent();
    }
  }, [intent, clearIntent]);

  if (view.mode !== "list") {
    return (
      <FaqFormPage
        token={token}
        item={view.mode === "edit" ? view.item : undefined}
        newSortOrder={site.faqs.length}
        onDone={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div>
      <SectionHead
        kicker="00:06 · FAQ"
        title="Frequently Asked Questions"
        sub={`${site.faqs.length} ta proshno — Add, Edit ba order poriborton korun.`}
        action={
          <button type="button" onClick={() => setView({ mode: "add" })} className={btnPrimary}>
            <Plus size={15} /> Add FAQ
          </button>
        }
      />
      <ListCard>
        {site.faqs.length === 0 ? (
          <EmptyRow text="Ekhono kono FAQ nei — Add FAQ chap diye jog korun." />
        ) : (
          site.faqs.map((f, idx) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#2d2a24] bg-[#18181d] font-mono text-xs font-bold text-[#ffb067]">
                0{idx + 1}
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate text-sm font-bold text-[#f5f1ea]">
                  {f.question || "(no question)"}
                </p>
                <p className="truncate text-xs text-[#8a8478]">{f.answer || "—"}</p>
              </div>
              <RowActions
                onEdit={() => setView({ mode: "edit", item: f })}
                onDelete={() => setConfirmItem(f)}
                onMoveUp={
                  idx > 0
                    ? () => {
                        const next = moved(site.faqs, idx, -1);
                        if (next) reorder.mutate(next);
                      }
                    : undefined
                }
                onMoveDown={
                  idx < site.faqs.length - 1
                    ? () => {
                        const next = moved(site.faqs, idx, 1);
                        if (next) reorder.mutate(next);
                      }
                    : undefined
                }
                movePending={reorder.isPending}
              />
            </div>
          ))
        )}
      </ListCard>
      {confirmItem ? (
        <ConfirmDialog
          title="FAQ delete korben?"
          body={`“${confirmItem.question || "(no question)"}” proshno ta site theke chole jabe.`}
          pending={del.isPending}
          onCancel={() => setConfirmItem(null)}
          onConfirm={() => del.mutate(confirmItem.id)}
        />
      ) : null}
    </div>
  );
}

/* ----------------------------- Pages & Texts ----------------------------- */

type TextTab = "all" | "hero" | "about" | "headings" | "contact";

function PagesTextsSection({
  token,
  site,
  intent,
  clearIntent,
}: {
  token: string;
  site: Site;
  intent: NavIntent | null;
  clearIntent: () => void;
}) {
  const s = site.settings;
  const [tab, setTab] = useState<TextTab>("all");

  useEffect(() => {
    if (intent?.action === "edit-contact") {
      setTab("contact");
      clearIntent();
    }
  }, [intent, clearIntent]);

  const tabs: Array<{ key: TextTab; label: string }> = [
    { key: "all", label: "All Sections" },
    { key: "hero", label: "Hero & Portrait" },
    { key: "about", label: "About & Tools" },
    { key: "headings", label: "Section Headings" },
    { key: "contact", label: "Contact & Socials" },
  ];

  const show = (k: Exclude<TextTab, "all">) => tab === "all" || tab === k;

  return (
    <div className="space-y-6">
      <SectionHead
        kicker="00:06 · COPY & SETTINGS"
        title="Pages & Texts"
        sub="Section choose kore shob lekha, chhobi, stats ar social link edit korun."
      />

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`cursor-pointer rounded-lg px-3.5 py-2 font-mono text-xs font-bold transition ${
              tab === t.key
                ? "bg-[#ff6a00] text-black"
                : "border border-[#2d2a24] bg-[#141418] text-[#a8a29e] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {show("hero") ? (
        <div className="space-y-5">
          <SettingsForm
            token={token}
            kicker="HERO BANNER"
            title="Hero Texts & Portrait"
            settings={s}
            uploadFields={["portrait_url"]}
            fields={[
              { key: "hero_greeting", label: "Greeting (e.g. hi, i'm)" },
              { key: "hero_role", label: "Role Line" },
              { key: "hero_location", label: "Location Line" },
              { key: "hero_tagline", label: "Tagline", textarea: true, rows: 2 },
              { key: "hero_est", label: "Vertical Marker (EST…)" },
              {
                key: "portrait_url",
                label: "Portrait Photo (Upload or URL — faka rakhle default chhobi)",
                placeholder: "https://…/portrait.png",
              },
            ]}
          />
          <StatsEditor
            token={token}
            settingKey="hero_stats"
            title="Hero Bottom Stats (4 ta box)"
            settings={s}
          />
        </div>
      ) : null}

      {show("about") ? (
        <div className="space-y-5">
          <SettingsForm
            token={token}
            kicker="00:01 · ABOUT ME"
            title="About Bio"
            settings={s}
            fields={[
              { key: "about_heading", label: "Heading" },
              {
                key: "about_bio",
                label: "Bio (faka line diye paragraph alada korun)",
                textarea: true,
                rows: 6,
              },
              {
                key: "about_facebook_url",
                label: "Facebook Link (About Me button — optional, faka rakhle Social Links theke nibe)",
                placeholder: "https://www.facebook.com/hasibmahamud1997/",
              },
            ]}
          />
          <ToolsEditor token={token} settings={s} />
        </div>
      ) : null}

      {show("headings") ? (
        <div className="space-y-5">
          <SettingsForm
            token={token}
            kicker="00:02 · SHOWREEL COPY"
            title="Showreel Section Text"
            settings={s}
            fields={[
              { key: "showreel_heading", label: "Heading" },
              { key: "showreel_text", label: "Subtitle", textarea: true, rows: 2 },
            ]}
          />
          <SettingsForm
            token={token}
            kicker="00:03–00:06 · TITLES"
            title="Journey, Work, Services & FAQ Headings"
            settings={s}
            fields={[
              { key: "journey_heading", label: "Journey heading" },
              { key: "journey_intro", label: "Journey intro", textarea: true, rows: 2 },
              { key: "freelance_heading", label: "Freelance heading" },
              { key: "freelance_text", label: "Freelance text", textarea: true, rows: 3 },
              { key: "work_heading", label: "Work heading" },
              { key: "work_sub", label: "Work sub-line" },
              { key: "services_heading", label: "Services heading" },
              { key: "services_intro", label: "Services intro", textarea: true, rows: 2 },
              { key: "faq_heading", label: "FAQ heading" },
            ]}
          />
        </div>
      ) : null}

      {show("contact") ? (
        <div className="space-y-5">
          <SettingsForm
            token={token}
            kicker="00:07 · LET'S TALK"
            title="Contact Details"
            settings={s}
            fields={[
              { key: "contact_heading", label: "Heading" },
              { key: "contact_text", label: "Subtitle", textarea: true, rows: 2 },
              { key: "phone_display", label: "Phone (display)" },
              {
                key: "whatsapp_number",
                label: "WhatsApp number (country code shoho, space chara)",
                help: "e.g. 8801976616684 — Hire Me / WhatsApp button ei number ei jabe.",
              },
              { key: "email", label: "Email" },
              { key: "location", label: "Studio / Location" },
            ]}
          />
          <SocialsEditor token={token} settings={s} />
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------- SEO ---------------------------------- */

function SeoSection({ token, site }: { token: string; site: Site }) {
  const [copied, setCopied] = useState("");
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied("");
    }
  };
  const docs = [
    { label: "sitemap.xml", href: "/sitemap.xml", text: site.seoDocs.sitemap },
    { label: "robots.txt", href: "/robots.txt", text: site.seoDocs.robots },
    {
      label: "llms.txt (AI Search — ChatGPT / Gemini)",
      href: "/llms.txt",
      text: site.seoDocs.llms,
    },
  ];
  const seoTitle = site.settings["seo_title"]?.trim() ?? "";
  const seoDesc = site.settings["seo_description"]?.trim() ?? "";
  const seoSiteUrl = site.settings["site_url"]?.trim() ?? "";
  const seoOg = site.settings["og_image_url"]?.trim() ?? "";
  const seoKeywords = site.settings["seo_keywords"]?.trim() ?? "";

  let badSocialUrls = 0;
  try {
    const parsedSocials = JSON.parse(site.settings["socials"] || "[]") as Array<{ url?: string }>;
    if (Array.isArray(parsedSocials)) {
      badSocialUrls = parsedSocials.filter((x) => {
        const u = (x?.url ?? "").trim();
        if (!u) return false;
        try {
          const parsed = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`);
          return !parsed.hostname.includes(".");
        } catch {
          return true;
        }
      }).length;
    }
  } catch {
    // ignore
  }

  const checks = [
    {
      label: `Page Title (${seoTitle.length} chars · target 40–65)`,
      ok: seoTitle.length >= 35 && seoTitle.length <= 70,
      hint: seoTitle ? "Google header ready" : "Pages & SEO Title din",
    },
    {
      label: `Meta Description (${seoDesc.length} chars · target 120–160)`,
      ok: seoDesc.length >= 90 && seoDesc.length <= 165,
      hint:
        seoDesc.length > 165
          ? "Ektu chhoto korle Google search e purota katbe na"
          : seoDesc
            ? "Description length valo"
            : "Meta description din",
    },
    {
      label: "Site Domain URL (Sitemap & Canonical)",
      ok: /^https?:\/\/[^/]+\.[^/]+/i.test(seoSiteUrl),
      hint: seoSiteUrl || "Domain kinle ekhane bosiye din (Sitemap ekhon faka)",
    },
    {
      label: "Social Share Cover Image (og:image)",
      ok: Boolean(seoOg),
      hint: seoOg ? "Facebook/WhatsApp preview ready" : "Upload button diye cover chhobi din",
    },
    {
      label: "Keywords & Valid Social Links",
      ok: Boolean(seoKeywords) && badSocialUrls === 0,
      hint: badSocialUrls > 0 ? `${badSocialUrls} ti social link e .com/.bd domain nei` : "Shob link valid",
    },
  ];
  const score = checks.filter((c) => c.ok).length;

  return (
    <div className="space-y-6">
      <SectionHead
        kicker="00:07 · SEARCH & DISCOVERY"
        title="SEO & AI Search"
        sub="Google ar AI search engine er jonno meta title, description, structured data ar sitemap."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-[#f5f1ea]">SEO Health Checklist</h3>
            <Badge tone={score >= 4 ? "ok" : "warn"}>
              {score}/{checks.length} READY
            </Badge>
          </div>
          <div className="mt-3 space-y-2.5">
            {checks.map((c) => (
              <div
                key={c.label}
                className="flex items-start justify-between gap-2 rounded-lg border border-[#26241f] bg-[#0b0b0e] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#f5f1ea]">{c.label}</p>
                  <p className="text-[11px] text-[#8a8478]">{c.hint}</p>
                </div>
                <Badge tone={c.ok ? "ok" : "warn"}>{c.ok ? "OK ✓" : "CHECK"}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className={cardCls}>
          <h3 className="text-base font-bold text-[#f5f1ea]">Google Search Preview</h3>
          <p className="mt-0.5 text-xs text-[#8a8478]">
            Google e search korle apnar site jemon dekhabe:
          </p>
          <div className="mt-3 rounded-xl border border-[#26241f] bg-[#0b0b0e] p-4">
            <p className="truncate font-mono text-[11px] text-emerald-400">
              {seoSiteUrl || "https://yourdomain.com"}
            </p>
            <p className="mt-1 line-clamp-1 text-base font-semibold text-[#8ab4f8]">
              {seoTitle || "Hasib Mahamud — Photographer & Video Editor"}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#bdc1c6]">
              {seoDesc || "Add a clear meta description under 160 characters."}
            </p>
          </div>
          {seoOg ? (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#26241f] bg-[#0b0b0e] p-2.5">
              <img src={seoOg} alt="" className="h-12 w-20 rounded object-cover" />
              <span className="text-xs text-[#a8a29e]">Active Social Share Preview (og:image)</span>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#ffb067]">
              Note: OG Image khali thakle automatic portfolior prothom chhobi fallback hishebe bebohar hobe.
            </p>
          )}
        </div>
      </div>

      <SettingsForm
        token={token}
        title="SEO Meta Settings"
        help="Nijer domain kinle Site URL bosiye din, tahole sitemap ar canonical link automatically ready hobe."
        settings={site.settings}
        uploadFields={["og_image_url"]}
        fields={[
          { key: "seo_title", label: "Page Title (Google e dekhabe)" },
          { key: "seo_description", label: "Meta Description", textarea: true, rows: 3 },
          { key: "seo_keywords", label: "Keywords (comma diye)" },
          {
            key: "site_url",
            label: "Site URL (e.g. https://hasibmahamud.com)",
            placeholder: "https://…",
          },
          {
            key: "og_image_url",
            label: "Social Share Image (Facebook/WhatsApp preview)",
          },
        ]}
      />
      <div className={cardCls}>
        <h3 className="flex items-center gap-2 text-base font-bold text-[#f5f1ea]">
          <Sparkles size={16} className="text-[#ff6a00]" />
          Structured Data (JSON-LD) <Badge tone="ok">Live ✓</Badge>
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[#a8a29e]">
          Person, ProfessionalService, FAQPage ar shob video-r VideoObject schema site er head e
          automatically bosano ache — content bodlale nijei update hoy.
        </p>
      </div>
      {docs.map((doc) => (
        <div key={doc.label} className={cardCls}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-mono text-sm font-bold text-[#f5f1ea]">{doc.label}</h3>
            <div className="flex gap-2">
              <a
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className={btnSecondary}
              >
                <ExternalLink size={13} /> Open
              </a>
              <button
                type="button"
                onClick={() => copy(doc.label, doc.text)}
                className={btnSecondary}
              >
                <Copy size={13} /> {copied === doc.label ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
          <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-[#26241f] bg-[#0b0b0e] p-3.5 font-mono text-[11px] leading-relaxed text-[#a8a29e]">
            {doc.text}
          </pre>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- Account ------------------------------- */

function AccountSection({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const change = useMutation({
    mutationFn: async (args: { currentPassword: string; newPassword: string }) =>
      await api.changePassword({ token, ...args }),
    onSuccess: () => {
      setIsError(false);
      setMsg("Password change hoyeche ✓");
    },
    onError: (e) => {
      setIsError(true);
      setMsg(e instanceof Error ? e.message : "Failed.");
    },
  });
  return (
    <div className="space-y-6">
      <SectionHead kicker="00:08 · SECURITY" title="Account & Password" />
      <form
        className={cardCls}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          change.mutate({
            currentPassword: str(fd, "currentPassword"),
            newPassword: str(fd, "newPassword"),
          });
        }}
      >
        <h3 className="text-base font-bold text-[#f5f1ea]">Change Password</h3>
        <div className="mt-4 max-w-md space-y-4">
          <div>
            <label className={labelCls} htmlFor="currentPassword">
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              className={inputCls}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="newPassword">
              New password (kompokhe 6 character)
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={6}
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
        </div>
        {msg ? (
          <p className={`mt-3 text-sm font-medium ${isError ? "text-red-400" : "text-emerald-400"}`}>
            {msg}
          </p>
        ) : null}
        <div className="mt-5 border-t border-white/10 pt-4">
          <button type="submit" disabled={change.isPending} className={btnPrimary}>
            {change.isPending ? "Saving…" : "Change Password"}
          </button>
        </div>
      </form>
      <div className={cardCls}>
        <h3 className="text-base font-bold text-[#f5f1ea]">Log Out</h3>
        <p className="mt-1 text-sm text-[#a8a29e]">
          Kaj shesh hole log out kore din. Login 30 din porjonto active thake.
        </p>
        <button type="button" onClick={onLogout} className={`${btnDanger} mt-4 px-4 py-2 text-sm`}>
          <LogOut size={15} /> Log Out
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- Admin root ----------------------------- */

export function Admin() {
  const [toastState, setToastState] = useState<{ msg: string; ok: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const showToast = useCallback((msg: string, ok = true) => {
    setToastState({ msg, ok });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastState(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast: showToast }}>
      <AdminShell />
      {toastState ? (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-[80] flex max-w-xs items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl ${
            toastState.ok
              ? "border-[#ff6a00]/40 bg-[#141418] text-[#f5f1ea]"
              : "border-red-500/40 bg-red-950/90 text-red-200"
          }`}
        >
          {toastState.ok ? (
            <Check size={16} className="shrink-0 text-[#ff6a00]" />
          ) : (
            <AlertTriangle size={16} className="shrink-0 text-red-400" />
          )}
          {toastState.msg}
        </div>
      ) : null}
    </ToastCtx.Provider>
  );
}

function AdminShell() {
  const [token, setToken] = useState<string>(readStoredToken);
  const [section, setSection] = useState<SectionKey>("dashboard");
  const [intent, setIntent] = useState<(NavIntent & { section: SectionKey }) | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: ["auth-status", token],
    queryFn: () => api.authStatus({ token: token || undefined }),
  });
  const authed = !!status.data?.authed;
  const site = useQuery({
    queryKey: ["site"],
    queryFn: () => api.getSite({}),
    enabled: authed,
  });

  const setup = useMutation({
    mutationFn: async (password: string) => await api.setupPassword({ password }),
    onSuccess: (res) => {
      storeToken(res.token);
      setToken(res.token);
      setAuthError("");
    },
    onError: (e) => setAuthError(e instanceof Error ? e.message : "Failed."),
  });
  const login = useMutation({
    mutationFn: async (password: string) => await api.login({ password }),
    onSuccess: (res) => {
      storeToken(res.token);
      setToken(res.token);
      setAuthError("");
    },
    onError: (e) => setAuthError(e instanceof Error ? e.message : "Failed."),
  });
  const logout = useMutation({
    mutationFn: async () => await api.logout({ token }),
    onSettled: () => {
      clearStoredToken();
      setToken("");
      queryClient.removeQueries({ queryKey: ["site"] });
    },
  });

  const go = (
    next: SectionKey,
    action?: string,
    extra?: { itemId?: number; track?: TrackKey },
  ) => {
    setSection(next);
    setIntent(action ? { section: next, action, ...extra } : null);
    setNavOpen(false);
  };
  const clearIntent = useCallback(() => setIntent(null), []);
  const intentFor = (key: SectionKey): NavIntent | null =>
    intent && intent.section === key
      ? { action: intent.action, itemId: intent.itemId, track: intent.track }
      : null;

  const authShell = (children: ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-10 text-[#f5f1ea]">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-black tracking-[0.14em] text-[#f5f1ea]">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            HASIB <span className="text-[#ff6a00]">MAHAMUD</span>
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-[#8a8478]">
            Studio Admin Control
          </p>
        </div>
        <div className="rounded-xl border border-[#26241f] bg-[#121216] p-6 shadow-2xl">
          {children}
        </div>
        <a
          href="/"
          className="mt-5 inline-flex items-center gap-1.5 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-[#8a8478] transition hover:text-[#ff8c3a]"
        >
          <ArrowLeft size={14} /> Site e fire jan
        </a>
      </div>
    </div>
  );

  if (status.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#8a8478]">
          Loading studio admin…
        </p>
      </div>
    );
  }

  if (status.isError || !status.data) {
    return authShell(
      <div className="text-center">
        <h1 className="text-xl font-bold text-[#f5f1ea]">Server er sathe jogajog holo na</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#a8a29e]">
          Admin er tothyo load kora jayni. Server chalu ache kina check kore abar try korun.
        </p>
        <button type="button" onClick={() => status.refetch()} className={`${btnPrimary} mt-5 w-full`}>
          Abar Try Korun
        </button>
      </div>,
    );
  }

  if (!status.data.hasPassword) {
    return authShell(
      <>
        <h1 className="text-xl font-bold text-[#f5f1ea]">Prothome ekta password din</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#a8a29e]">
          Ei password diyei pore admin e login korben. Server e sudhu encrypted hash rakha hoy.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setup.mutate(str(fd, "password"));
          }}
        >
          <div>
            <label className={labelCls} htmlFor="setup-password">
              New admin password (min 6 characters)
            </label>
            <input
              id="setup-password"
              name="password"
              type="password"
              required
              minLength={6}
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          {authError ? <p className="text-sm font-medium text-red-400">{authError}</p> : null}
          <button type="submit" disabled={setup.isPending} className={`${btnPrimary} w-full`}>
            {setup.isPending ? "Setting…" : "Set Password & Enter Studio"}
          </button>
        </form>
      </>,
    );
  }

  if (!authed) {
    return authShell(
      <>
        <h1 className="text-xl font-bold text-[#f5f1ea]">Admin Login</h1>
        <p className="mt-1.5 text-sm text-[#a8a29e]">
          Password diye login korun — tarpor site er shob kichu ekhan thekei control korte parben.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            login.mutate(str(fd, "password"));
          }}
        >
          <div>
            <label className={labelCls} htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              required
              className={inputCls}
              autoComplete="current-password"
            />
          </div>
          {authError ? <p className="text-sm font-medium text-red-400">{authError}</p> : null}
          <button type="submit" disabled={login.isPending} className={`${btnPrimary} w-full`}>
            {login.isPending ? "Checking…" : "Log In"}
          </button>
        </form>
      </>,
    );
  }

  const currentSec = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];
  const sideLinkCls =
    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-[#a8a29e] transition hover:bg-white/5 hover:text-[#f5f1ea]";

  const countFor = (key: SectionKey): string | null => {
    if (!site.data) return null;
    if (key === "videos") return String(site.data.workItems.length);
    if (key === "photos") return String(site.data.photos.length);
    if (key === "journey") return String(site.data.journey.length + site.data.partners.length);
    if (key === "services") return String(site.data.services.length);
    if (key === "faq") return String(site.data.faqs.length);
    return null;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f5f1ea]">
      {navOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-xs lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#22201b] bg-[#0d0d11] transition-transform duration-200 lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Admin menu"
      >
        <div className="flex items-start justify-between border-b border-[#22201b] px-5 py-5">
          <div>
            <p className="flex items-center gap-2 font-[family-name:var(--font-display)] text-base font-black tracking-[0.12em] text-[#f5f1ea]">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              HASIB <span className="text-[#ff6a00]">MAHAMUD</span>
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[#8a8478]">
              Studio Control Panel
            </p>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
            className="rounded-md p-1.5 text-[#8a8478] transition hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin sections">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.key;
            const badge = countFor(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => go(s.key)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[#ff6a00] text-black shadow-[0_6px_18px_rgba(255,106,0,0.28)]"
                    : "text-[#b6b0a2] hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={17} />
                  {s.label}
                </span>
                {badge ? (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                      active ? "bg-black/20 text-black" : "bg-white/5 text-[#8a8478]"
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-[#22201b] p-3">
          <a href="/" className={sideLinkCls}>
            <ExternalLink size={17} /> View Site
          </a>
          <button type="button" onClick={() => logout.mutate()} className={sideLinkCls}>
            <LogOut size={17} /> Logout
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-[#22201b] bg-[#0d0d11]/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 pt-safe sm:px-6">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setNavOpen(true)}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#2d2a24] text-[#a8a29e] transition hover:text-white lg:hidden"
            >
              <Menu size={18} />
            </button>
            <div className="flex-1 truncate">
              <span className="mr-2 font-mono text-[11px] font-bold text-[#ff8c3a]">
                {currentSec.code}
              </span>
              <h1 className="inline text-lg font-extrabold text-[#f5f1ea]">{currentSec.label}</h1>
            </div>
            <span className="hidden items-center gap-2 text-xs font-medium text-[#a8a29e] md:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff6a00] font-mono text-[11px] font-black text-black">
                HM
              </span>
              Hasib Mahamud
            </span>
            <a href="/" className={btnSecondary}>
              <ExternalLink size={14} /> View Site
            </a>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-safe sm:px-6">
          {site.isPending ? (
            <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.25em] text-[#8a8478]">
              Loading studio content…
            </p>
          ) : site.error || !site.data ? (
            <div className={`${cardCls} text-center`}>
              <p className="text-[#f5f1ea]">Content load holo na.</p>
              <button type="button" onClick={() => site.refetch()} className={`${btnPrimary} mt-4`}>
                Try Again
              </button>
            </div>
          ) : (
            <>
              {section === "dashboard" ? <Dashboard site={site.data} go={go} /> : null}
              {section === "videos" ? (
                <VideosSection
                  token={token}
                  site={site.data}
                  intent={intentFor("videos")}
                  clearIntent={clearIntent}
                />
              ) : null}
              {section === "photos" ? (
                <PhotosSection
                  token={token}
                  site={site.data}
                  intent={intentFor("photos")}
                  clearIntent={clearIntent}
                />
              ) : null}
              {section === "journey" ? <JourneySection token={token} site={site.data} /> : null}
              {section === "services" ? (
                <ServicesSection
                  token={token}
                  site={site.data}
                  intent={intentFor("services")}
                  clearIntent={clearIntent}
                />
              ) : null}
              {section === "faq" ? (
                <FaqSection
                  token={token}
                  site={site.data}
                  intent={intentFor("faq")}
                  clearIntent={clearIntent}
                />
              ) : null}
              {section === "texts" ? (
                <PagesTextsSection
                  token={token}
                  site={site.data}
                  intent={intentFor("texts")}
                  clearIntent={clearIntent}
                />
              ) : null}
              {section === "seo" ? <SeoSection token={token} site={site.data} /> : null}
              {section === "account" ? (
                <AccountSection token={token} onLogout={() => logout.mutate()} />
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
