import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send, Smartphone, Tablet, Monitor, Sparkles, MoreHorizontal,
  RefreshCw, Code2, Zap, ImageIcon, X, ChevronDown,
  Plus, Upload, FileText, Brain, Bot, Cpu, Undo2, Redo2,
  Globe, Copy, Download, Eye, Check, Settings, RotateCcw,
  Plug, Archive, GripVertical, Play, FolderOpen, Save, Pencil, Trash2,
  Bell,
} from "lucide-react";
import logoLotus from "@/imports/logo_lotus.png";
import { DraggableGeneratedPreview, PreviewBrief } from "./components/GeneratedPreview";
import {
  DEFAULT_PROMPT,
  DEVICE_PREVIEW_META,
  STYLE_PACK_COUNT,
  createStylePack,
  generateAppSpec,
  generateCodeFiles,
  hashText,
  type BuildStatus,
  type DeviceMode,
  type GeneratedCodeFile,
} from "./lib/generator";
import { deleteStoredProject, loadProjects, projectStoreMode, upsertProject } from "./lib/projectStore";

// ─── Types ───────────────────────────────────────────────────────────────────
type BuildView  = "preview" | "code" | "deployed";

interface ChatMessage { id: string; role: "user" | "assistant"; content: string; ts: Date; }
interface UploadedFile { id: string; name: string; type: "file" | "image"; mime: string; }
interface ToggleItem   { id: string; name: string; desc: string; on: boolean; }
interface Connector    { id: string; name: string; desc: string; connected: boolean; }
interface Capability   { id: string; name: string; desc: string; category: string; active: boolean; }
interface ProjectFolder { id: string; name: string; color: string; }
interface BuilderProject {
  id: string;
  name: string;
  folderId: string;
  prompt: string;
  styleSeed: number;
  updatedAt: Date;
  savedAt: Date;
  pinned?: boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const MODELS = ["Enigma Auto", "GPT-4.1", "Claude Sonnet", "Claude Opus", "Gemini Pro", "DeepSeek Coder", "Local Model"];

const INIT_CONNECTORS: Connector[] = [
  { id:"sup", name:"Supabase",        desc:"Postgres database & auth",       connected:false },
  { id:"fir", name:"Firebase",        desc:"Realtime DB & hosting",          connected:false },
  { id:"git", name:"GitHub",          desc:"Source control & CI",            connected:false },
  { id:"ver", name:"Vercel",          desc:"Deploy & edge functions",        connected:false },
  { id:"str", name:"Stripe",          desc:"Payments & subscriptions",       connected:false },
  { id:"oar", name:"OpenRouter",      desc:"Multi-model API gateway",        connected:false },
  { id:"oai", name:"OpenAI",          desc:"GPT models & DALL-E",            connected:false },
  { id:"ant", name:"Anthropic",       desc:"Claude models",                  connected:false },
  { id:"gdr", name:"Google Drive",    desc:"File storage & docs",            connected:false },
  { id:"gml", name:"Gmail",           desc:"Email send & receive",           connected:false },
  { id:"gcl", name:"Google Calendar", desc:"Events & scheduling",            connected:false },
  { id:"apl", name:"Apple Developer", desc:"App Store & push certs",         connected:false },
  { id:"gpc", name:"Play Console",    desc:"Google Play distribution",       connected:false },
  { id:"ble", name:"Bluetooth",       desc:"BLE device connectivity",        connected:false },
  { id:"cam", name:"Camera",          desc:"Device camera access",           connected:false },
  { id:"mic", name:"Microphone",      desc:"Audio capture",                  connected:false },
  { id:"psh", name:"Push Notifications", desc:"Cross-platform push",         connected:false },
  { id:"map", name:"Maps / Location", desc:"GPS & map rendering",            connected:false },
];

const INIT_SKILLS: ToggleItem[] = [
  { id:"uip", name:"UI Polish",           desc:"Refine spacing, type, color", on:false },
  { id:"lpb", name:"Landing Page Builder",desc:"Generate marketing pages",    on:false },
  { id:"aus", name:"Auth Setup",          desc:"Adds auth flows",             on:true  },
  { id:"ssc", name:"Supabase Schema",     desc:"Design DB tables",            on:false },
  { id:"asp", name:"App Store Prep",      desc:"Checklist & assets",          on:false },
  { id:"psp", name:"Play Store Prep",     desc:"Checklist & assets",          on:false },
  { id:"seo", name:"SEO Setup",           desc:"Meta tags & sitemaps",        on:false },
  { id:"cpw", name:"Copywriter",          desc:"AI-written UI copy",          on:true  },
  { id:"bug", name:"Bug Fixer",           desc:"Detect & fix issues",         on:false },
  { id:"pay", name:"Payment Flow",        desc:"Stripe checkout setup",       on:false },
  { id:"img", name:"Image Generator",     desc:"AI images inline",            on:false },
  { id:"dim", name:"Data Importer",       desc:"CSV/JSON ingestion",          on:false },
];

const INIT_AGENTS: ToggleItem[] = [
  { id:"pa",  name:"Product Architect",    desc:"Shapes features & flows",    on:true  },
  { id:"uid", name:"UI Designer",          desc:"Visual polish & layout",     on:true  },
  { id:"be",  name:"Backend Engineer",     desc:"API & server logic",         on:false },
  { id:"mob", name:"Mobile App Engineer",  desc:"React Native & Expo",        on:false },
  { id:"db",  name:"Database Planner",     desc:"Schema & indexing",          on:false },
  { id:"qa",  name:"QA Tester",            desc:"Test cases & coverage",      on:false },
  { id:"as",  name:"App Store Strategist", desc:"ASO & store copy",           on:false },
  { id:"gs",  name:"Growth Strategist",    desc:"Retention & funnels",        on:false },
  { id:"sec", name:"Security Reviewer",    desc:"Audits & vulnerabilities",   on:false },
  { id:"dep", name:"Deployment Manager",   desc:"CI/CD & infra",              on:false },
];

const INIT_CAPS: Capability[] = [
  // Device
  { id:"d1", name:"Bluetooth",         category:"Device",  desc:"BLE scanning & pairing",       active:false },
  { id:"d2", name:"Camera",            category:"Device",  desc:"Photo & video capture",         active:false },
  { id:"d3", name:"Microphone",        category:"Device",  desc:"Audio input",                   active:false },
  { id:"d4", name:"Push Notifications",category:"Device",  desc:"OS-level alerts",               active:false },
  { id:"d5", name:"Location Services", category:"Device",  desc:"GPS & geofencing",              active:false },
  { id:"d6", name:"Contacts",          category:"Device",  desc:"Address book access",           active:false },
  { id:"d7", name:"Calendar Access",   category:"Device",  desc:"Read/write calendar events",    active:false },
  { id:"d8", name:"File System Access",category:"Device",  desc:"Local file read/write",         active:false },
  { id:"d9", name:"Offline Mode",      category:"Device",  desc:"Service worker & cache",        active:false },
  // App
  { id:"a1", name:"User Authentication",category:"App",    desc:"Login, signup, OAuth",          active:true  },
  { id:"a2", name:"Payments",          category:"App",     desc:"One-time charges",              active:false },
  { id:"a3", name:"Subscriptions",     category:"App",     desc:"Recurring billing",             active:false },
  { id:"a4", name:"Chat",              category:"App",     desc:"Real-time messaging",           active:false },
  { id:"a5", name:"Image Upload",      category:"App",     desc:"S3/Supabase storage",           active:false },
  { id:"a6", name:"Video Upload",      category:"App",     desc:"Video storage & streaming",     active:false },
  { id:"a7", name:"Admin Dashboard",   category:"App",     desc:"Internal management UI",        active:false },
  { id:"a8", name:"Analytics",         category:"App",     desc:"Event tracking & funnels",      active:false },
  { id:"a9", name:"Search",            category:"App",     desc:"Full-text search",              active:false },
  { id:"a10",name:"Notifications",     category:"App",     desc:"In-app alert system",           active:false },
  { id:"a11",name:"Export Data",       category:"App",     desc:"CSV/JSON data export",          active:false },
  // AI
  { id:"ai1",name:"Text Generation",   category:"AI",      desc:"LLM-powered content",           active:true  },
  { id:"ai2",name:"Image Generation",  category:"AI",      desc:"DALL-E / Stable Diffusion",     active:false },
  { id:"ai3",name:"Audio Transcription",category:"AI",     desc:"Whisper-style STT",             active:false },
  { id:"ai4",name:"Voice Generation",  category:"AI",      desc:"TTS synthesis",                 active:false },
  { id:"ai5",name:"Code Generation",   category:"AI",      desc:"AI-assisted coding",            active:true  },
  { id:"ai6",name:"Document Analysis", category:"AI",      desc:"PDF / doc parsing",             active:false },
  { id:"ai7",name:"Workflow Automation",category:"AI",     desc:"Multi-step agent pipelines",    active:false },
];

const PLUS_ITEMS = [
  { icon:<Upload size={12}/>,   label:"Upload File"         },
  { icon:<ImageIcon size={12}/>,label:"Upload Image"        },
  { icon:<Plug size={12}/>,     label:"Add Connector"       },
  { icon:<Sparkles size={12}/>, label:"Add Skill"           },
  { icon:<Bot size={12}/>,      label:"Add Agent"           },
  { icon:<Cpu size={12}/>,      label:"Add Function"        },
  { icon:<FileText size={12}/>, label:"Import Design"       },
  { icon:<Code2 size={12}/>,    label:"Import GitHub Repo"  },
  { icon:<Settings size={12}/>, label:"Add API Key"         },
  { icon:<Smartphone size={12}/>,label:"Add Device Capability"},
];

const INIT_MESSAGES: ChatMessage[] = [
  { id:"1", role:"assistant", content:"Welcome to Lotus. Describe the app you want to build — I'll bring it to life.", ts: new Date(Date.now()-120000) },
  { id:"2", role:"user",      content:"Build me a wellness tracking app — mood check-ins, sleep logs, gratitude journal. Calm, minimal.", ts: new Date(Date.now()-90000) },
  { id:"3", role:"assistant", content:"Crafting a three-tab layout — Mood, Sleep, Journal — with sage-and-ivory palette. Generating preview…", ts: new Date(Date.now()-60000) },
];

const PROJECT_FOLDERS: ProjectFolder[] = [
  { id:"client", name:"Client Builds", color:"#D4A030" },
  { id:"experiments", name:"Experiments", color:"#4E8D7C" },
  { id:"store", name:"Store Ready", color:"#6A5ACD" },
];

const INIT_PROJECTS: BuilderProject[] = [
  {
    id:"proj-wellness",
    name:"Wellness Tracker",
    folderId:"client",
    prompt:DEFAULT_PROMPT,
    styleSeed:hashText(DEFAULT_PROMPT),
    updatedAt:new Date(Date.now()-1000*60*3),
    savedAt:new Date(Date.now()-1000*60*3),
    pinned:true,
  },
  {
    id:"proj-commerce",
    name:"Commerce Kit",
    folderId:"store",
    prompt:"Build a commerce app with product browsing, cart, checkout, orders, account, and admin inventory screens.",
    styleSeed:hashText("commerce kit"),
    updatedAt:new Date(Date.now()-1000*60*48),
    savedAt:new Date(Date.now()-1000*60*50),
  },
  {
    id:"proj-social",
    name:"Creator Social",
    folderId:"experiments",
    prompt:"Build a creator social app with feed, profile, messaging, notifications, monetization, and moderation tools.",
    styleSeed:hashText("creator social"),
    updatedAt:new Date(Date.now()-1000*60*160),
    savedAt:new Date(Date.now()-1000*60*170),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(d: Date) { return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }); }

function compactTime(d: Date) {
  const mins = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon size={10}/>;
  if (mime.includes("json") || mime.includes("javascript") || mime.includes("typescript")) return <Code2 size={10}/>;
  return <FileText size={10}/>;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k=0; k<8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipHeader(signature: number, size: number) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, signature, true);
  return { bytes, view };
}

function createZipBlob(files: GeneratedCodeFile[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.code);
    const crc = crc32(data);

    const local = zipHeader(0x04034b50, 30 + name.length);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0, true);
    local.view.setUint16(8, 0, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, name.length, true);
    local.bytes.set(name, 30);
    localParts.push(local.bytes, data);

    const central = zipHeader(0x02014b50, 46 + name.length);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0, true);
    central.view.setUint16(10, 0, true);
    central.view.setUint32(16, crc, true);
    central.view.setUint32(20, data.length, true);
    central.view.setUint32(24, data.length, true);
    central.view.setUint16(28, name.length, true);
    central.view.setUint32(42, offset, true);
    central.bytes.set(name, 46);
    centralParts.push(central.bytes);

    offset += local.bytes.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part)=>sum+part.length, 0);
  const end = zipHeader(0x06054b50, 22);
  end.view.setUint16(8, files.length, true);
  end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, centralOffset, true);

  return new Blob([...localParts, ...centralParts, end.bytes], { type:"application/zip" });
}

// ─── Code panel ───────────────────────────────────────────────────────────────
function CodePanel({ files, appTitle }: { files: GeneratedCodeFile[]; appTitle: string }) {
  const [activeFile, setActiveFile] = useState(0);
  const [copied, setCopied] = useState(false);
  const file = files[Math.min(activeFile, files.length-1)];
  const downloadName = `${appTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lotus-app"}.zip`;

  function handleCopy() {
    navigator.clipboard.writeText(file.code).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false), 1800);
  }

  function handleDownloadFile() {
    downloadBlob(file.name.split("/").pop() || "generated-code.txt", new Blob([file.code], { type:"text/plain;charset=utf-8" }));
  }

  function handleExportZip() {
    downloadBlob(downloadName, createZipBlob(files));
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* File tree */}
      <div className="flex-shrink-0 flex flex-col overflow-y-auto" style={{ width:188, borderRight:"1px solid var(--border)", background:"var(--card)" }}>
        <div className="px-3 py-2.5 text-xs font-semibold" style={{ color:"var(--muted-foreground)", letterSpacing:"0.06em", borderBottom:"1px solid var(--border)" }}>FILES</div>
        {files.map((f,i)=>(
          <button key={i} onClick={()=>setActiveFile(i)}
            className="flex items-center gap-2 px-3 py-2 text-left transition-colors"
            style={{ background:i===activeFile?"var(--muted)":"transparent", color:i===activeFile?"var(--foreground)":"var(--muted-foreground)", fontSize:11, fontFamily:"DM Mono,monospace", borderLeft: i===activeFile?"2px solid var(--accent)":"2px solid transparent" }}>
            <FileText size={11}/> {f.name.split("/").pop()}
          </button>
        ))}
      </div>

      {/* Code area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2" style={{ borderBottom:"1px solid var(--border)", background:"var(--card)" }}>
          <span style={{ fontSize:11, fontFamily:"DM Mono,monospace", color:"var(--muted-foreground)" }}>{file.name}</span>
          <div className="flex gap-1">
            {[
              { icon:copied?<Check size={11}/>:<Copy size={11}/>, label:copied?"Copied":"Copy Code", fn:handleCopy },
              { icon:<Download size={11}/>,  label:"Download Code", fn:handleDownloadFile },
              { icon:<Archive size={11}/>,   label:"Export ZIP", fn:handleExportZip },
            ].map(a=>(
              <button key={a.label} onClick={a.fn}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                style={{ background:"var(--muted)", color:"var(--muted-foreground)" }}>
                {a.icon}{a.label}
              </button>
            ))}
          </div>
        </div>
        {/* Code */}
        <div className="flex-1 overflow-auto p-5" style={{ background:"var(--background)", scrollbarWidth:"none" }}>
          <pre style={{ margin:0, fontFamily:"DM Mono,monospace", fontSize:12, lineHeight:1.7, color:"var(--foreground)", whiteSpace:"pre-wrap" }}>
            {file.code}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── Deployed panel ───────────────────────────────────────────────────────────
function DeployedPanel({ onViewApp, onCode }: { onViewApp:()=>void; onCode:()=>void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background:"rgba(200,146,42,0.12)", border:"1px solid rgba(200,146,42,0.2)" }}>
        <Zap size={20} className="text-accent"/>
      </div>
      <div className="text-center">
        <h3 style={{ fontFamily:"Fraunces,serif", fontSize:18, fontWeight:500, color:"var(--foreground)", marginBottom:6 }}>Ready to deploy</h3>
        <p style={{ fontSize:12, color:"var(--muted-foreground)", maxWidth:280, lineHeight:1.6 }}>Your app will be live at a custom subdomain. Connect a domain or deploy to a store.</p>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={onViewApp} className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
          style={{ background:"var(--primary)", color:"var(--primary-foreground)" }}>Web App</button>
        <button onClick={onViewApp} className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
          style={{ background:"var(--muted)", color:"var(--muted-foreground)" }}>Store Settings</button>
        <button onClick={onCode} className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
          style={{ background:"var(--muted)", color:"var(--muted-foreground)" }}>Export Build</button>
      </div>
    </div>
  );
}

// ─── Overlay modal shell ──────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title:string; onClose:()=>void; children:React.ReactNode }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
      <div className="absolute inset-0" style={{ background:"rgba(30,18,6,0.5)", backdropFilter:"blur(4px)" }} onClick={onClose}/>
      <motion.div className="relative w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background:"var(--card)", border:"1px solid var(--border)", maxHeight:"80vh", boxShadow:"0 32px 80px rgba(0,0,0,0.25)" }}
        initial={{ y:24, scale:0.97 }} animate={{ y:0, scale:1 }} exit={{ y:24, scale:0.97 }}
        transition={{ duration:0.25, ease:[0.22,1,0.36,1] }}>
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4" style={{ borderBottom:"1px solid var(--border)" }}>
          <span style={{ fontFamily:"Fraunces,serif", fontSize:16, fontWeight:500, color:"var(--foreground)" }}>{title}</span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-70" style={{ background:"var(--muted)", color:"var(--muted-foreground)" }}><X size={13}/></button>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth:"none" }}>{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ─── Projects panel ──────────────────────────────────────────────────────────
function ProjectsPanel({
  projects,
  folders,
  activeProjectId,
  onOpen,
  onNew,
  onDuplicate,
  onDelete,
  onRename,
  onMove,
  onSave,
  onClose,
}:{
  projects:BuilderProject[];
  folders:ProjectFolder[];
  activeProjectId:string;
  onOpen:(id:string)=>void;
  onNew:()=>void;
  onDuplicate:(id:string)=>void;
  onDelete:(id:string)=>void;
  onRename:(id:string, name:string)=>void;
  onMove:(id:string, folderId:string)=>void;
  onSave:()=>void;
  onClose:()=>void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const activeProject = projects.find(p=>p.id===activeProjectId);
  const sortedProjects = [...projects].sort((a,b)=>b.updatedAt.getTime()-a.updatedAt.getTime());

  function beginRename(project: BuilderProject) {
    setEditingId(project.id);
    setDraftName(project.name);
  }

  function commitRename(projectId: string) {
    const name = draftName.trim();
    if (name) onRename(projectId, name);
    setEditingId(null);
    setDraftName("");
  }

  return (
    <Modal title="Projects" onClose={onClose}>
      <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {folders.map(folder=> {
            const count = projects.filter(p=>p.folderId===folder.id).length;
            return (
              <button key={folder.id} onClick={()=>activeProject && onMove(activeProject.id, folder.id)}
                className="text-left rounded-xl p-3 transition-all hover:opacity-80"
                style={{ background:"var(--background)", border:`1px solid ${activeProject?.folderId===folder.id ? folder.color : "var(--border)"}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background:folder.color }}/>
                  <FolderOpen size={12} style={{ color:"var(--muted-foreground)" }}/>
                </div>
                <p style={{ fontSize:12, fontWeight:700, color:"var(--foreground)" }}>{folder.name}</p>
                <p style={{ fontSize:10, color:"var(--muted-foreground)", marginTop:2 }}>{count} project{count===1?"":"s"}</p>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onNew} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background:"var(--primary)", color:"var(--primary-foreground)" }}>
            <Plus size={12}/> New Project
          </button>
          <button onClick={onSave} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background:"var(--secondary)", color:"var(--secondary-foreground)", border:"1px solid var(--border)" }}>
            <Save size={12}/> Save Current
          </button>
        </div>

        <div>
          <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.06em", color:"var(--muted-foreground)", textTransform:"uppercase", marginBottom:8 }}>Recent Projects</p>
          <div className="flex flex-col gap-2">
            {sortedProjects.map(project=>{
              const folder = folders.find(f=>f.id===project.folderId) || folders[0];
              const active = project.id===activeProjectId;
              return (
                <div key={project.id} className="rounded-xl p-3" style={{ background:active?"rgba(200,146,42,0.10)":"var(--background)", border:`1px solid ${active?"rgba(200,146,42,0.35)":"var(--border)"}` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:"var(--card)", border:"1px solid var(--border)" }}>
                      <FolderOpen size={14} style={{ color:folder.color }}/>
                    </div>
                    <div className="min-w-0 flex-1">
                      {editingId===project.id ? (
                        <div className="flex gap-2">
                          <input value={draftName} onChange={e=>setDraftName(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") commitRename(project.id); }}
                            autoFocus
                            className="flex-1 rounded-lg px-2 py-1.5 outline-none text-xs"
                            style={{ background:"var(--card)", color:"var(--foreground)", border:"1px solid var(--border)", fontFamily:"Outfit,sans-serif" }}/>
                          <button onClick={()=>commitRename(project.id)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ background:"var(--accent)", color:"var(--accent-foreground)" }}>Save</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="truncate" style={{ fontSize:13, fontWeight:700, color:"var(--foreground)" }}>{project.name}</p>
                          {project.pinned && <span style={{ fontSize:9, color:"var(--accent)", fontWeight:700 }}>PINNED</span>}
                        </div>
                      )}
                      <p className="truncate" style={{ fontSize:10.5, color:"var(--muted-foreground)", marginTop:3 }}>{project.prompt}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span style={{ fontSize:9, color:folder.color, fontWeight:700 }}>{folder.name}</span>
                        <span style={{ fontSize:9, color:"var(--muted-foreground)" }}>Updated {compactTime(project.updatedAt)}</span>
                        <span style={{ fontSize:9, color:"var(--muted-foreground)" }}>Saved {compactTime(project.savedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={()=>onOpen(project.id)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                        style={{ background:active?"var(--accent)":"var(--muted)", color:active?"var(--accent-foreground)":"var(--muted-foreground)" }}>
                        {active?"Open":"Open"}
                      </button>
                      <button onClick={()=>beginRename(project)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80" style={{ background:"var(--muted)", color:"var(--muted-foreground)" }} aria-label={`Rename ${project.name}`}>
                        <Pencil size={11}/>
                      </button>
                      <button onClick={()=>onDuplicate(project.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80" style={{ background:"var(--muted)", color:"var(--muted-foreground)" }} aria-label={`Duplicate ${project.name}`}>
                        <Copy size={11}/>
                      </button>
                      <button onClick={()=>onDelete(project.id)} disabled={projects.length===1} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80" style={{ background:"var(--muted)", color:"var(--muted-foreground)", opacity:projects.length===1?0.35:1 }} aria-label={`Delete ${project.name}`}>
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Connector panel ──────────────────────────────────────────────────────────
function ConnectorPanel({ connectors, onToggle, onClose }:{ connectors:Connector[]; onToggle:(id:string)=>void; onClose:()=>void }) {
  return (
    <Modal title="Connectors" onClose={onClose}>
      <div className="p-4 flex flex-col gap-2">
        {connectors.map(c=>(
          <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background:"var(--background)" }}>
            <div>
              <p style={{ fontSize:13, fontWeight:500, color:"var(--foreground)" }}>{c.name}</p>
              <p style={{ fontSize:11, color:"var(--muted-foreground)", marginTop:1 }}>{c.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize:9, fontWeight:600, letterSpacing:"0.05em", padding:"2px 8px", borderRadius:999, background:c.connected?"rgba(107,203,119,0.15)":"var(--muted)", color:c.connected?"#3A8A44":"var(--muted-foreground)" }}>
                {c.connected?"Connected":"Not Connected"}
              </span>
              <button onClick={()=>onToggle(c.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                style={{ background:c.connected?"var(--muted)":"var(--accent)", color:c.connected?"var(--muted-foreground)":"var(--accent-foreground)" }}>
                {c.connected?"Disconnect":"Connect"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ─── Skills panel ─────────────────────────────────────────────────────────────
function SkillsPanel({ skills, onToggle, onClose }:{ skills:ToggleItem[]; onToggle:(id:string)=>void; onClose:()=>void }) {
  return (
    <Modal title="Skills" onClose={onClose}>
      <div className="p-4 flex flex-col gap-2">
        {skills.map(s=>(
          <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background:"var(--background)" }}>
            <div>
              <p style={{ fontSize:13, fontWeight:500, color:"var(--foreground)" }}>{s.name}</p>
              <p style={{ fontSize:11, color:"var(--muted-foreground)", marginTop:1 }}>{s.desc}</p>
            </div>
            <button onClick={()=>onToggle(s.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
              style={{ background:s.on?"var(--accent)":"var(--muted)", color:s.on?"var(--accent-foreground)":"var(--muted-foreground)" }}>
              {s.on?"On":"Off"}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ─── Agents panel ─────────────────────────────────────────────────────────────
function AgentsPanel({ agents, onToggle, onClose }:{ agents:ToggleItem[]; onToggle:(id:string)=>void; onClose:()=>void }) {
  return (
    <Modal title="Agents" onClose={onClose}>
      <div className="p-4 flex flex-col gap-2">
        {agents.map(a=>(
          <div key={a.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background:"var(--background)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:"rgba(200,146,42,0.1)" }}>
                <Bot size={14} className="text-accent"/>
              </div>
              <div>
                <p style={{ fontSize:13, fontWeight:500, color:"var(--foreground)" }}>{a.name}</p>
                <p style={{ fontSize:11, color:"var(--muted-foreground)", marginTop:1 }}>{a.desc}</p>
              </div>
            </div>
            <button onClick={()=>onToggle(a.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
              style={{ background:a.on?"var(--accent)":"var(--muted)", color:a.on?"var(--accent-foreground)":"var(--muted-foreground)" }}>
              {a.on?"Active":"Off"}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ─── Functions panel ──────────────────────────────────────────────────────────
function FunctionsPanel({ caps, onToggle, onClose }:{ caps:Capability[]; onToggle:(id:string)=>void; onClose:()=>void }) {
  const active = caps.filter(c=>c.active);
  const cats = Array.from(new Set(caps.map(c=>c.category)));

  return (
    <Modal title="Functions & Capabilities" onClose={onClose}>
      <div className="p-4 flex flex-col gap-4">
        {active.length>0 && (
          <div>
            <p style={{ fontSize:10, fontWeight:600, letterSpacing:"0.06em", color:"var(--accent)", textTransform:"uppercase", marginBottom:8 }}>Active · {active.length}</p>
            <div className="flex flex-wrap gap-1.5">
              {active.map(c=>(
                <div key={c.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background:"rgba(200,146,42,0.12)", border:"1px solid rgba(200,146,42,0.2)" }}>
                  <span style={{ fontSize:11, color:"var(--accent)", fontWeight:500 }}>{c.name}</span>
                  <button onClick={()=>onToggle(c.id)}><X size={9} className="text-accent"/></button>
                </div>
              ))}
            </div>
          </div>
        )}
        {cats.map(cat=>(
          <div key={cat}>
            <p style={{ fontSize:10, fontWeight:600, letterSpacing:"0.06em", color:"var(--muted-foreground)", textTransform:"uppercase", marginBottom:6 }}>{cat}</p>
            <div className="flex flex-col gap-1.5">
              {caps.filter(c=>c.category===cat).map(c=>(
                <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background:"var(--background)" }}>
                  <div>
                    <p style={{ fontSize:12, fontWeight:500, color:"var(--foreground)" }}>{c.name}</p>
                    <p style={{ fontSize:10, color:"var(--muted-foreground)" }}>{c.desc}</p>
                  </div>
                  <button onClick={()=>onToggle(c.id)} className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                    style={{ background:c.active?"var(--accent)":"var(--muted)", color:c.active?"var(--accent-foreground)":"var(--muted-foreground)" }}>
                    {c.active?"Added":"Add"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ─── View App modal ───────────────────────────────────────────────────────────
function ViewAppMenu({ appUrl, onClose }:{ appUrl:string; onClose:()=>void }) {
  const [tab, setTab] = useState<"web"|"apple"|"google">("web");
  const [copied, setCopied] = useState(false);
  const tabs:[typeof tab, React.ReactNode, string][] = [
    ["web",    <Globe size={12}/>,    "Web App"],
    ["apple",  <Play size={12}/>,     "App Store"],
    ["google", <Smartphone size={12}/>,"Play Store"],
  ];

  const field = (label:string, placeholder:string) => (
    <div key={label}>
      <label style={{ fontSize:10, fontWeight:600, color:"var(--muted-foreground)", letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:4 }}>{label}</label>
      <input placeholder={placeholder} className="w-full rounded-lg px-3 py-2 outline-none text-xs" style={{ background:"var(--background)", border:"1px solid var(--border)", color:"var(--foreground)", fontFamily:"Outfit,sans-serif" }}/>
    </div>
  );

  function copyAppUrl() {
    navigator.clipboard.writeText(appUrl).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false), 1600);
  }

  return (
    <Modal title="View App" onClose={onClose}>
      <div className="p-4">
        <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background:"var(--muted)" }}>
          {tabs.map(([key,icon,label])=>(
            <button key={key} onClick={()=>setTab(key)}
              className="flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background:tab===key?"var(--card)":"transparent", color:tab===key?"var(--foreground)":"var(--muted-foreground)", boxShadow:tab===key?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
              {icon}{label}
            </button>
          ))}
        </div>

        {tab==="web" && <div className="flex flex-col gap-3">
          <div>
            <label style={{ fontSize:10, fontWeight:600, color:"var(--muted-foreground)", letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:4 }}>App URL</label>
            <div className="w-full rounded-lg px-3 py-2 text-xs" style={{ background:"var(--background)", border:"1px solid var(--border)", color:"var(--foreground)", fontFamily:"DM Mono,monospace" }}>{appUrl}</div>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={()=>window.open(appUrl, "_blank", "noopener,noreferrer")} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background:"var(--primary)", color:"var(--primary-foreground)" }}>Open Web App</button>
            <button onClick={copyAppUrl} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background:"var(--muted)", color:"var(--muted-foreground)" }}>{copied?"Copied":"Copy Link"}</button>
          </div>
        </div>}

        {tab==="apple" && <div className="flex flex-col gap-3">
          {field("Apple Bundle ID","com.yourcompany.app")}
          {field("Apple Team ID","XXXXXXXXXX")}
          {field("App Store Category","Health & Fitness")}
          {field("Version","1.0.0")}
          {field("Build Number","1")}
          <div className="rounded-xl p-3 mt-1" style={{ background:"var(--background)", border:"1px solid var(--border)" }}>
            <p style={{ fontSize:11, fontWeight:600, color:"var(--foreground)", marginBottom:6 }}>App Store Prep Checklist</p>
            {["App icon (1024×1024)","Screenshots (all sizes)","Privacy policy URL","Support URL","App description"].map(item=>(
              <div key={item} className="flex items-center gap-2 py-1">
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background:"var(--muted)", border:"1px solid var(--border)" }}/>
                <span style={{ fontSize:11, color:"var(--muted-foreground)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>}

        {tab==="google" && <div className="flex flex-col gap-3">
          {field("Package Name","com.yourcompany.app")}
          {field("Version Name","1.0.0")}
          {field("Version Code","1")}
          {field("Play Store Category","Health & Fitness")}
          <div className="rounded-xl p-3 mt-1" style={{ background:"var(--background)", border:"1px solid var(--border)" }}>
            <p style={{ fontSize:11, fontWeight:600, color:"var(--foreground)", marginBottom:6 }}>Play Store Prep Checklist</p>
            {["Feature graphic (1024×500)","Screenshots (phone & tablet)","Content rating questionnaire","Privacy policy URL","Short description (80 chars)"].map(item=>(
              <div key={item} className="flex items-center gap-2 py-1">
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background:"var(--muted)", border:"1px solid var(--border)" }}/>
                <span style={{ fontSize:11, color:"var(--muted-foreground)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>}
      </div>
    </Modal>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mb-3" style={{ background:"rgba(200,146,42,0.15)" }}>
        <Sparkles size={9} className="text-accent"/>
      </div>
      <div className="px-3 py-2.5 rounded-2xl rounded-bl-sm" style={{ background:"var(--card)" }}>
        <div className="flex gap-1 items-center h-3">
          {[0,1,2].map(i=>(
            <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background:"var(--muted-foreground)" }}
              animate={{ opacity:[0.3,1,0.3], y:[0,-3,0] }}
              transition={{ duration:1, repeat:Infinity, delay:i*0.18, ease:"easeInOut" }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // Core
  const [messages,  setMessages]  = useState<ChatMessage[]>(INIT_MESSAGES);
  const [input,     setInput]     = useState("");
  const [isTyping,  setIsTyping]  = useState(false);
  const [device,    setDevice]    = useState<DeviceMode>("phone");
  const [view,      setView]      = useState<BuildView>("preview");
  const [liveFlash, setLiveFlash] = useState(false);
  const [lastPrompt, setLastPrompt] = useState(DEFAULT_PROMPT);
  const [styleSeed, setStyleSeed] = useState(()=>hashText(DEFAULT_PROMPT));

  // Data
  const [selectedModel,  setSelectedModel]  = useState("Enigma Auto");
  const [uploadedFiles,  setUploadedFiles]  = useState<UploadedFile[]>([]);
  const [connectors,     setConnectors]     = useState<Connector[]>(INIT_CONNECTORS);
  const [skills,         setSkills]         = useState<ToggleItem[]>(INIT_SKILLS);
  const [agents,         setAgents]         = useState<ToggleItem[]>(INIT_AGENTS);
  const [capabilities,   setCapabilities]   = useState<Capability[]>(INIT_CAPS);

  // UI open/close
  const [showPlus,      setShowPlus]      = useState(false);
  const [showModel,     setShowModel]     = useState(false);
  const [showConnector, setShowConnector] = useState(false);
  const [showSkills,    setShowSkills]    = useState(false);
  const [showAgents,    setShowAgents]    = useState(false);
  const [showFunctions, setShowFunctions] = useState(false);
  const [showViewApp,   setShowViewApp]   = useState(false);
  const [showProjects,  setShowProjects]  = useState(false);

  // Build state
  const [autosaved,    setAutosaved]    = useState(true);
  const [buildStatus,  setBuildStatus]  = useState<BuildStatus>("Ready");
  const [dragKey,      setDragKey]      = useState(0); // reset phone position
  const [history,      setHistory]      = useState<string[]>([DEFAULT_PROMPT]);
  const [historyIdx,   setHistoryIdx]   = useState(0);
  const [folders] = useState<ProjectFolder[]>(PROJECT_FOLDERS);
  const [projects, setProjects] = useState<BuilderProject[]>(INIT_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState(INIT_PROJECTS[0].id);
  const [storageStatus, setStorageStatus] = useState(`${projectStoreMode()} storage`);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const imageInputRef   = useRef<HTMLInputElement>(null);
  const canvasRef       = useRef<HTMLDivElement>(null);
  const stylePack = useMemo(()=>createStylePack(styleSeed), [styleSeed]);
  const generatedSpec = useMemo(()=>generateAppSpec(lastPrompt, stylePack), [lastPrompt, stylePack]);
  const codeFiles = useMemo(()=>generateCodeFiles(generatedSpec, stylePack, lastPrompt), [generatedSpec, stylePack, lastPrompt]);
  const appUrl = useMemo(()=>`https://preview.lotus.app/${generatedSpec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "generated-app"}`, [generatedSpec.title]);
  const activeProject = projects.find(p=>p.id===activeProjectId) || projects[0];
  const activeFolder = folders.find(f=>f.id===activeProject?.folderId) || folders[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    let mounted = true;
    loadProjects(INIT_PROJECTS)
      .then(savedProjects => {
        if (!mounted || savedProjects.length===0) return;
        const [first] = savedProjects;
        setProjects(savedProjects);
        setActiveProjectId(first.id);
        setLastPrompt(first.prompt);
        setStyleSeed(first.styleSeed);
        setHistory([first.prompt]);
        setHistoryIdx(0);
        setStorageStatus(`${projectStoreMode()} connected`);
      })
      .catch(error => {
        console.warn("Project storage load failed.", error);
        setStorageStatus("Local fallback");
      });
    return () => { mounted = false; };
  }, []);

  // Instant live preview - generate a style pack from typed input
  useEffect(() => {
    if (!input.trim()) return;
    const timer = setTimeout(() => {
      setStyleSeed(hashText(input));
      setLiveFlash(true);
      setTimeout(() => setLiveFlash(false), 800);
    }, 320);
    return () => clearTimeout(timer);
  }, [input]);

  // Counts for context bar
  const activeConnectors  = connectors.filter(c=>c.connected).length;
  const activeSkills      = skills.filter(s=>s.on).length;
  const activeAgents      = agents.filter(a=>a.on).length;
  const activeCaps        = capabilities.filter(c=>c.active).length;

  function writeProject(update: Partial<BuilderProject>, projectId = activeProjectId) {
    const existing = projects.find(project=>project.id===projectId);
    if (!existing) return;
    const changed = { ...existing, ...update, updatedAt:new Date() };
    setProjects(p=>p.map(project=>project.id===projectId ? changed : project));
    upsertProject(changed)
      .then(()=>setStorageStatus(`${projectStoreMode()} saved`))
      .catch(()=>setStorageStatus("Local saved"));
  }

  function markDirty(status: BuildStatus = "Preview updated") {
    setAutosaved(false);
    setBuildStatus(status);
  }

  function saveProject() {
    const now = new Date();
    const savedProject = {
      ...activeProject,
      prompt:lastPrompt,
      styleSeed,
      updatedAt:now,
      savedAt:now,
    };
    setProjects(p=>p.map(project=>project.id===activeProjectId ? {
      ...project,
      prompt:lastPrompt,
      styleSeed,
      updatedAt:now,
      savedAt:now,
    } : project));
    upsertProject(savedProject)
      .then(()=>setStorageStatus(`${projectStoreMode()} saved`))
      .catch(()=>setStorageStatus("Local saved"));
    setAutosaved(true);
    setBuildStatus("Saved");
    setTimeout(()=>setBuildStatus("Ready"), 1000);
  }

  function openProject(id: string) {
    const project = projects.find(p=>p.id===id);
    if (!project) return;
    setActiveProjectId(id);
    setLastPrompt(project.prompt);
    setStyleSeed(project.styleSeed);
    setHistory([project.prompt]);
    setHistoryIdx(0);
    setView("preview");
    setAutosaved(true);
    setBuildStatus("Ready");
    setShowProjects(false);
  }

  function createProject() {
    const id = `proj-${Date.now()}`;
    const prompt = "Build a new app with onboarding, dashboard, profile, settings, notifications, and export-ready code.";
    const now = new Date();
    const project: BuilderProject = {
      id,
      name:`Untitled App ${projects.length + 1}`,
      folderId:"experiments",
      prompt,
      styleSeed:hashText(`${prompt}-${id}`),
      updatedAt:now,
      savedAt:now,
    };
    setProjects(p=>[project, ...p]);
    upsertProject(project)
      .then(()=>setStorageStatus(`${projectStoreMode()} saved`))
      .catch(()=>setStorageStatus("Local saved"));
    setActiveProjectId(id);
    setLastPrompt(project.prompt);
    setStyleSeed(project.styleSeed);
    setHistory([project.prompt]);
    setHistoryIdx(0);
    setView("preview");
    setAutosaved(true);
    setBuildStatus("Ready");
  }

  function duplicateProject(id: string) {
    const source = projects.find(p=>p.id===id);
    if (!source) return;
    const now = new Date();
    const copy: BuilderProject = {
      ...source,
      id:`proj-${Date.now()}`,
      name:`${source.name} Copy`,
      updatedAt:now,
      savedAt:now,
      pinned:false,
    };
    setProjects(p=>[copy, ...p]);
    upsertProject(copy)
      .then(()=>setStorageStatus(`${projectStoreMode()} saved`))
      .catch(()=>setStorageStatus("Local saved"));
    setActiveProjectId(copy.id);
    setLastPrompt(copy.prompt);
    setStyleSeed(copy.styleSeed);
    setHistory([copy.prompt]);
    setHistoryIdx(0);
    setView("preview");
    setAutosaved(true);
    setBuildStatus("Ready");
  }

  function deleteProject(id: string) {
    if (projects.length===1) return;
    const remaining = projects.filter(p=>p.id!==id);
    setProjects(remaining);
    deleteStoredProject(id)
      .then(()=>setStorageStatus(`${projectStoreMode()} deleted`))
      .catch(()=>setStorageStatus("Local saved"));
    if (id===activeProjectId) {
      const next = remaining[0];
      setActiveProjectId(next.id);
      setLastPrompt(next.prompt);
      setStyleSeed(next.styleSeed);
      setHistory([next.prompt]);
      setHistoryIdx(0);
      setAutosaved(true);
    }
  }

  function renameProject(id: string, name: string) {
    writeProject({ name }, id);
    setBuildStatus("Project renamed");
    setTimeout(()=>setBuildStatus("Ready"), 1000);
  }

  function moveProject(id: string, folderId: string) {
    writeProject({ folderId }, id);
    setBuildStatus("Project moved");
    setTimeout(()=>setBuildStatus("Ready"), 1000);
  }

  useEffect(() => {
    if (!activeProject) return;
    if (activeProject.prompt===lastPrompt && activeProject.styleSeed===styleSeed) return;
    setAutosaved(false);
    const timer = setTimeout(() => {
      const now = new Date();
      setProjects(p=>p.map(project=>project.id===activeProjectId ? {
        ...project,
        prompt:lastPrompt,
        styleSeed,
        updatedAt:now,
        savedAt:now,
      } : project));
      const nextProject = { ...activeProject, prompt:lastPrompt, styleSeed, updatedAt:now, savedAt:now };
      upsertProject(nextProject)
        .then(()=>setStorageStatus(`${projectStoreMode()} autosaved`))
        .catch(()=>setStorageStatus("Local autosaved"));
      setAutosaved(true);
      setBuildStatus(current=>current==="Generating" ? current : "Autosaved");
      setTimeout(()=>setBuildStatus(current=>current==="Autosaved" ? "Ready" : current), 900);
    }, 700);
    return () => clearTimeout(timer);
  }, [lastPrompt, styleSeed, activeProjectId]);

  function restoreHistory(nextIdx: number) {
    const prompt = history[nextIdx];
    if (!prompt) return;
    setHistoryIdx(nextIdx);
    setLastPrompt(prompt);
    setInput("");
    setStyleSeed(hashText(prompt));
    setView("preview");
    markDirty("Preview updated");
    setLiveFlash(true);
    setTimeout(()=>setLiveFlash(false), 800);
  }

  function regeneratePreview() {
    const nextSeed = hashText(`${lastPrompt}-${Date.now()}`);
    setStyleSeed(nextSeed);
    markDirty("Preview updated");
    setLiveFlash(true);
    setTimeout(()=>setLiveFlash(false), 800);
  }

  function handleSend(text = input.trim()) {
    if (!text) return;
    const id = Date.now().toString();
    setMessages(p=>[...p,{ id, role:"user", content:text, ts:new Date() }]);
    setInput("");
    setIsTyping(true);
    markDirty("Generating");
    setLastPrompt(text);
    setView("preview");
    setTimeout(()=>{
      setIsTyping(false);
      setMessages(p=>[...p,{ id:(Date.now()+1).toString(), role:"assistant", content:`Generated ${generateAppSpec(text, createStylePack(hashText(text))).title} with a new UI asset pack.`, ts:new Date() }]);
      setHistory(h=>[...h.slice(0,historyIdx+1), text]);
      setStyleSeed(hashText(text));
      setLiveFlash(true);
      setTimeout(()=>setLiveFlash(false), 800);
      setHistoryIdx(i=>i+1);
      setBuildStatus("Preview updated");
    }, 2000);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type:"file"|"image") {
    const files = Array.from(e.target.files||[]);
    const items: UploadedFile[] = files.map(f=>({ id:Math.random().toString(36).slice(2), name:f.name, type, mime:f.type }));
    setUploadedFiles(p=>[...p,...items]);
    e.target.value = "";
  }

  function removeFile(id: string) { setUploadedFiles(p=>p.filter(f=>f.id!==id)); }

  function toggleConnector(id:string) { setConnectors(p=>p.map(c=>c.id===id?{...c,connected:!c.connected}:c)); }
  function toggleSkill(id:string)     { setSkills(p=>p.map(s=>s.id===id?{...s,on:!s.on}:s)); }
  function toggleAgent(id:string)     { setAgents(p=>p.map(a=>a.id===id?{...a,on:!a.on}:a)); }
  function toggleCap(id:string)       { setCapabilities(p=>p.map(c=>c.id===id?{...c,active:!c.active}:c)); }

  function handlePlusAction(label: string) {
    setShowPlus(false);
    if (label==="Upload File") fileInputRef.current?.click();
    else if (label==="Upload Image") imageInputRef.current?.click();
    else if (label==="Add Connector") setShowConnector(true);
    else if (label==="Add Skill") setShowSkills(true);
    else if (label==="Add Agent") setShowAgents(true);
    else if (label==="Add Function" || label==="Add Device Capability") setShowFunctions(true);
    else if (label==="Import Design") handleSend("Import a design reference and generate matching screens, components, and styling.");
    else if (label==="Import GitHub Repo") handleSend("Import a GitHub repo and generate an app preview, route map, and code export plan.");
    else if (label==="Add API Key") setShowConnector(true);
  }

  const quickActions = [
    { label:"Generate Plan",       text:"Generate a full product plan for this app." },
    { label:"Fix Bugs",            text:"Review the current code and fix any bugs." },
    { label:"Improve UI",          text:"Improve the visual design and polish the UI." },
    { label:"Prepare Store Build", text:"Prepare everything needed for an App Store submission." },
    { label:"Add Auth Flow",       text:"Add login, signup, onboarding, profile, and protected app screens." },
    { label:"Add Commerce Kit",    text:"Add product, cart, checkout, order history, and payment screens." },
    { label:"Add Admin Screens",   text:"Add dashboard, users, reports, settings, and activity screens." },
  ];

  const toolbarBtns: { icon:React.ReactNode; label:string; onClick:()=>void; active?:boolean }[] = [
    { icon:<Plus size={12}/>,      label:"Plus",      onClick:()=>{ setShowPlus(p=>!p); setShowModel(false); } },
    { icon:<Upload size={12}/>,    label:"File",      onClick:()=>fileInputRef.current?.click() },
    { icon:<ImageIcon size={12}/>, label:"Image",     onClick:()=>imageInputRef.current?.click() },
    { icon:<Plug size={12}/>,      label:"Connect",   onClick:()=>setShowConnector(true), active:activeConnectors>0 },
    { icon:<Sparkles size={12}/>,  label:"Skills",    onClick:()=>setShowSkills(true),    active:activeSkills>0 },
    { icon:<Bot size={12}/>,       label:"Agents",    onClick:()=>setShowAgents(true),    active:activeAgents>0 },
    { icon:<Cpu size={12}/>,       label:"Functions", onClick:()=>setShowFunctions(true), active:activeCaps>0 },
  ];

  return (
    <div className="size-full flex flex-col overflow-hidden" style={{ fontFamily:"Outfit,sans-serif", background:"var(--background)" }}>

      {/* ── Top bar ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-5" style={{ height:60, borderBottom:"1px solid var(--border)", background:"var(--card)" }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <img src={logoLotus} alt="Lotus" style={{ width:50, height:50, objectFit:"contain" }}/>
          <span style={{ fontFamily:"Fraunces,serif", fontWeight:500, fontSize:21, color:"var(--foreground)", letterSpacing:"-0.02em" }}>Lotus</span>
          <button onClick={()=>setShowProjects(true)}
            className="hidden md:flex items-center gap-2 min-w-0 px-3 py-2 rounded-xl text-left transition-all hover:opacity-80"
            style={{ background:"var(--background)", border:"1px solid var(--border)", maxWidth:260 }}>
            <FolderOpen size={13} style={{ color:activeFolder.color }}/>
            <span className="min-w-0">
              <span className="block truncate" style={{ fontSize:12, fontWeight:700, color:"var(--foreground)" }}>{activeProject?.name}</span>
              <span className="block truncate" style={{ fontSize:9, color:"var(--muted-foreground)" }}>{activeFolder.name} · Recent Project</span>
            </span>
          </button>
        </div>

        {/* Device switcher */}
        <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-xl" style={{ background:"var(--muted)", border:"1px solid var(--border)" }}>
          {(["phone","tablet","desktop"] as DeviceMode[]).map(d=>{
            const icons = { phone:<Smartphone size={12}/>, tablet:<Tablet size={12}/>, desktop:<Monitor size={12}/> };
            const labels = { phone:"Mobile", tablet:"Tablet", desktop:"Desktop" };
            const active = device===d;
            return (
              <motion.button key={d} onClick={()=>setDevice(d)} whileTap={{ scale:0.96 }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background:active?"var(--card)":"transparent", color:active?"var(--foreground)":"var(--muted-foreground)", boxShadow:active?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
                {icons[d]}<span className="hidden sm:inline">{labels[d]}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5">
            <button onClick={()=>restoreHistory(Math.max(0,historyIdx-1))} disabled={historyIdx===0}
              className="p-1.5 rounded-lg transition-all hover:opacity-80" style={{ color:historyIdx===0?"var(--muted-foreground)":"var(--foreground)", opacity:historyIdx===0?0.4:1 }}>
              <Undo2 size={13}/>
            </button>
            <button onClick={()=>restoreHistory(Math.min(history.length-1,historyIdx+1))} disabled={historyIdx===history.length-1}
              className="p-1.5 rounded-lg transition-all hover:opacity-80" style={{ color:historyIdx===history.length-1?"var(--muted-foreground)":"var(--foreground)", opacity:historyIdx===history.length-1?0.4:1 }}>
              <Redo2 size={13}/>
            </button>
          </div>
          <div className="h-4 w-px mx-1" style={{ background:"var(--border)" }}/>
          <button onClick={()=>setShowProjects(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background:"var(--secondary)", color:"var(--secondary-foreground)", border:"1px solid var(--border)" }}>
            <FolderOpen size={11}/> Projects
          </button>
          <button onClick={saveProject}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background:autosaved?"var(--secondary)":"var(--primary)", color:autosaved?"var(--secondary-foreground)":"var(--primary-foreground)", border:"1px solid var(--border)" }}>
            <Save size={11}/> Save
          </button>
          <button onClick={()=>setShowViewApp(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background:"var(--secondary)", color:"var(--secondary-foreground)", border:"1px solid var(--border)" }}>
            <Eye size={11}/> View App
          </button>
          <button onClick={()=>setView("code")}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background:"var(--secondary)", color:"var(--secondary-foreground)", border:"1px solid var(--border)" }}>
            <Code2 size={11}/> Code
          </button>
          <motion.button whileTap={{ scale:0.97 }} onClick={()=>{ setBuildStatus("Deploy queued"); setView("deployed"); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold"
            style={{ background:"linear-gradient(135deg,#D4A030,#B87820)", color:"#FFF8E8", boxShadow:"0 2px 12px rgba(200,146,42,0.35)" }}>
            <Zap size={11}/> Deploy
          </motion.button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Chat panel ── */}
        <aside className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width:256, borderRight:"1px solid var(--border)", background:"var(--card)" }}>

          {/* Tab: Chat only */}
          <div className="flex-shrink-0 flex items-center px-3 pt-3 pb-0" style={{ borderBottom:"1px solid var(--border)" }}>
            <div className="flex items-center gap-1.5 px-3 py-2 relative" style={{ color:"var(--foreground)" }}>
              <Sparkles size={11}/><span style={{ fontSize:12, fontWeight:500 }}>Chat</span>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background:"var(--accent)" }}/>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col" style={{ scrollbarWidth:"none" }}>
            <AnimatePresence initial={false}>
              {messages.map(msg=>(
                <motion.div key={msg.id}
                  initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.2 }}
                  className={`flex mb-2.5 ${msg.role==="user"?"justify-end":"items-end gap-1.5"}`}>
                  {msg.role==="assistant" && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mb-4" style={{ background:"rgba(200,146,42,0.15)" }}>
                      <Sparkles size={8} className="text-accent"/>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5 max-w-[88%]">
                    <div className="px-3 py-2 leading-relaxed" style={{
                      fontSize:11.5,
                      borderRadius:msg.role==="user"?"14px 14px 3px 14px":"14px 14px 14px 3px",
                      background:msg.role==="user"?"var(--primary)":"var(--background)",
                      color:msg.role==="user"?"var(--primary-foreground)":"var(--foreground)",
                      boxShadow:"0 1px 4px rgba(0,0,0,0.05)",
                    }}>{msg.content}</div>
                    <span className={`px-1 ${msg.role==="user"?"text-right":""}`} style={{ fontSize:9, color:"var(--muted-foreground)" }}>{fmt(msg.ts)}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && <TypingIndicator/>}
            <div ref={messagesEndRef}/>
          </div>

          {/* Quick actions */}
          <div className="flex-shrink-0 px-3 pb-2 flex flex-wrap gap-1" style={{ borderTop:"1px solid var(--border)", paddingTop:8 }}>
            {quickActions.map(a=>(
              <button key={a.label} onClick={()=>handleSend(a.text)}
                className="px-2 py-1 rounded-lg text-left transition-all hover:opacity-80"
                style={{ background:"var(--muted)", color:"var(--muted-foreground)", fontSize:10, fontWeight:500 }}>
                {a.label}
              </button>
            ))}
          </div>

          {/* Attachment chips */}
          {uploadedFiles.length>0 && (
            <div className="flex-shrink-0 flex flex-wrap gap-1.5 px-3 pb-2">
              {uploadedFiles.map(f=>(
                <div key={f.id} className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background:"rgba(200,146,42,0.1)", border:"1px solid rgba(200,146,42,0.2)" }}>
                  <span className="text-accent">{fileIcon(f.mime)}</span>
                  <span style={{ fontSize:10, color:"var(--accent)", fontWeight:500, maxWidth:80, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                  <button onClick={()=>removeFile(f.id)}><X size={9} className="text-accent"/></button>
                </div>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="flex-shrink-0 px-3 pb-3">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 mb-1.5 relative">
              {/* Plus with popover */}
              <div className="relative">
                <button onClick={()=>{ setShowPlus(p=>!p); setShowModel(false); }}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:opacity-80"
                  style={{ background:showPlus?"var(--accent)":"var(--muted)", color:showPlus?"var(--accent-foreground)":"var(--muted-foreground)" }}>
                  <Plus size={12}/>
                </button>
                <AnimatePresence>
                  {showPlus && (
                    <motion.div className="absolute bottom-9 left-0 z-40 rounded-2xl overflow-hidden py-1.5"
                      style={{ background:"var(--card)", border:"1px solid var(--border)", boxShadow:"0 16px 48px rgba(0,0,0,0.18)", width:188, minWidth:"max-content" }}
                      initial={{ opacity:0, y:6, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:4, scale:0.97 }}
                      transition={{ duration:0.18 }}>
                      {PLUS_ITEMS.map(item=>(
                        <button key={item.label} onClick={()=>handlePlusAction(item.label)}
                          className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left transition-colors hover:opacity-80"
                          style={{ fontSize:12, color:"var(--foreground)", fontWeight:400 }}>
                          <span style={{ color:"var(--accent)" }}>{item.icon}</span>{item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Other tool buttons */}
              {toolbarBtns.slice(1).map(btn=>(
                <button key={btn.label} onClick={btn.onClick}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:opacity-80 relative"
                  style={{ background:btn.active?"rgba(200,146,42,0.12)":"var(--muted)", color:btn.active?"var(--accent)":"var(--muted-foreground)" }}>
                  {btn.icon}
                  {btn.active && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background:"var(--accent)" }}/>}
                </button>
              ))}

              {/* Spacer */}
              <div className="flex-1"/>

              {/* Model selector */}
              <div className="relative">
                <button onClick={()=>{ setShowModel(p=>!p); setShowPlus(false); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:opacity-80"
                  style={{ background:"var(--muted)", color:"var(--muted-foreground)", fontSize:9, fontWeight:600, maxWidth:78, overflow:"hidden" }}>
                  <Brain size={9}/>
                  <span className="truncate">{selectedModel}</span>
                  <ChevronDown size={8}/>
                </button>
                <AnimatePresence>
                  {showModel && (
                    <motion.div className="absolute bottom-9 right-0 z-40 rounded-xl overflow-hidden py-1"
                      style={{ background:"var(--card)", border:"1px solid var(--border)", boxShadow:"0 16px 48px rgba(0,0,0,0.18)", minWidth:148 }}
                      initial={{ opacity:0, y:4, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:4, scale:0.97 }}
                      transition={{ duration:0.15 }}>
                      {MODELS.map(m=>(
                        <button key={m} onClick={()=>{ setSelectedModel(m); setShowModel(false); }}
                          className="flex items-center justify-between w-full px-3.5 py-2 transition-colors hover:opacity-80"
                          style={{ fontSize:11, color:"var(--foreground)", background:m===selectedModel?"var(--muted)":"transparent" }}>
                          {m}{m===selectedModel && <Check size={10} className="text-accent"/>}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Input */}
            <div className="flex items-end gap-2 rounded-2xl px-3 py-2.5" style={{ background:"var(--background)", border:"1.5px solid var(--border)", boxShadow:"0 2px 16px rgba(0,0,0,0.06)" }}>
              <textarea value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleSend(); } }}
                placeholder="Describe a change, feature, screen, or function…"
                rows={2}
                className="flex-1 resize-none bg-transparent outline-none leading-relaxed"
                style={{ fontSize:11.5, color:"var(--foreground)", fontFamily:"Outfit,sans-serif", scrollbarWidth:"none" }}/>
              <motion.button whileTap={{ scale:0.88 }} onClick={()=>handleSend()}
                className="flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center transition-all"
                style={{ background:input.trim()?"linear-gradient(135deg,#D4A030,#B87820)":"var(--muted)", color:input.trim()?"#FFF8E8":"var(--muted-foreground)", boxShadow:input.trim()?"0 2px 8px rgba(200,146,42,0.3)":"none" }}>
                <Send size={11}/>
              </motion.button>
            </div>

            {/* Keyboard hint */}
            <p style={{ fontSize:9, color:"var(--muted-foreground)", textAlign:"center", marginTop:4 }}>⏎ Send · ⇧⏎ New line</p>
          </div>

          {/* Hidden file inputs */}
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.csv,.json,.zip,.js,.ts,.tsx,.css,.html" multiple onChange={e=>handleFileUpload(e,"file")}/>
          <input ref={imageInputRef} type="file" className="hidden" accept=".png,.jpg,.jpeg,.webp,.svg" multiple onChange={e=>handleFileUpload(e,"image")}/>
        </aside>

        {/* ── Preview / Code / Deployed ── */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background:"var(--background)" }}>

          {/* Preview toolbar */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2" style={{ borderBottom:"1px solid var(--border)", background:"var(--card)" }}>
            {/* View tabs */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background:"var(--muted)" }}>
                {([["preview","Preview",<Eye size={11}/>],["code","Code",<Code2 size={11}/>],["deployed","Deployed",<Zap size={11}/>]] as const).map(([k,l,icon])=>(
                  <button key={k} onClick={()=>setView(k as BuildView)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background:view===k?"var(--card)":"transparent", color:view===k?"var(--foreground)":"var(--muted-foreground)", boxShadow:view===k?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
                    {icon}{l}
                  </button>
                ))}
              </div>
              <div className="hidden md:flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:buildStatus==="Generating"?"var(--accent)":"#6BCB77" }}/>
                <span className="truncate" style={{ fontSize:11, color:"var(--muted-foreground)" }}>
                  {activeProject?.name} - {generatedSpec.title} - Pack {stylePack.id + 1}/{STYLE_PACK_COUNT} - {DEVICE_PREVIEW_META[device].note}
                </span>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {view==="preview" && <>
                <button onClick={()=>setDragKey(k=>k+1)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                  style={{ background:"var(--muted)", color:"var(--muted-foreground)" }}>
                  <RotateCcw size={10}/> Reset Position
                </button>
                <button onClick={regeneratePreview} className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color:"var(--muted-foreground)" }}><RefreshCw size={12}/></button>
              </>}
              <button onClick={()=>setShowViewApp(true)}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                style={{ background:"var(--secondary)", color:"var(--secondary-foreground)", border:"1px solid var(--border)" }}>
                <Globe size={10}/> View App
              </button>
              <button onClick={()=>setShowFunctions(true)} className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color:"var(--muted-foreground)" }}><MoreHorizontal size={12}/></button>
            </div>
          </div>

          {/* Generator controls */}
          {view==="preview" && (
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 overflow-x-auto" style={{ borderBottom:"1px solid var(--border)", scrollbarWidth:"none" }}>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Live flash indicator */}
                <AnimatePresence>
                  {liveFlash && (
                    <motion.div initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background:"rgba(200,146,42,0.15)", border:"1px solid rgba(200,146,42,0.3)" }}>
                      <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background:"var(--accent)" }} animate={{ scale:[1,1.4,1] }} transition={{ duration:0.4, repeat:2 }}/>
                      <span style={{ fontSize:9, color:"var(--accent)", fontWeight:700, letterSpacing:"0.05em" }}>LIVE</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full flex-shrink-0" style={{ background:"var(--primary)", color:"var(--primary-foreground)" }}>
                <Sparkles size={11}/>
                <span style={{ fontSize:11, fontWeight:800 }}>Real Generator</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0" style={{ background:"var(--muted)", color:"var(--muted-foreground)" }}>
                <span style={{ width:10, height:10, borderRadius:3, background:stylePack.palette.accent }}/>
                <span style={{ fontSize:11, fontWeight:700 }}>Pack {stylePack.id + 1}/{STYLE_PACK_COUNT}</span>
              </div>
              {[stylePack.archetype, stylePack.layout, stylePack.texture, stylePack.density].map(item=>(
                <span key={item} className="px-3 py-1.5 rounded-full flex-shrink-0" style={{ background:"var(--muted)", color:"var(--muted-foreground)", fontSize:11, fontWeight:650 }}>
                  {item}
                </span>
              ))}
              <motion.button whileTap={{ scale:0.95 }}
                onClick={()=>{ setStyleSeed(s=>s+1); markDirty("Preview updated"); setLiveFlash(true); setTimeout(()=>setLiveFlash(false),900); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 transition-all text-xs font-semibold"
                style={{ background:"var(--secondary)", color:"var(--secondary-foreground)", border:"1px solid var(--border)" }}>
                <RefreshCw size={11}/> Next Pack
              </motion.button>
              <motion.button whileTap={{ scale:0.95 }}
                onClick={()=>{ setStyleSeed(Math.floor(Math.random()*STYLE_PACK_COUNT)); markDirty("Preview updated"); setLiveFlash(true); setTimeout(()=>setLiveFlash(false),900); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 transition-all text-xs font-semibold"
                style={{ background:"linear-gradient(135deg,#D4A030,#B87820)", color:"#FFF8E8", boxShadow:"0 2px 10px rgba(200,146,42,0.3)" }}>
                <Zap size={11}/> Shuffle Style
              </motion.button>
              <motion.button whileTap={{ scale:0.95 }}
                onClick={()=>handleSend("Add login, onboarding, settings, billing, notifications, and admin screens to this generated app.")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 transition-all text-xs font-semibold"
                style={{ background:"var(--secondary)", color:"var(--secondary-foreground)", border:"1px solid var(--border)" }}>
                <Plus size={11}/> Add Screen Pack
              </motion.button>
              <motion.button whileTap={{ scale:0.95 }}
                onClick={()=>setView("code")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 transition-all text-xs font-semibold"
                style={{ background:"var(--muted)", color:"var(--muted-foreground)" }}>
                <Archive size={11}/> Export Code
              </motion.button>
            </div>
          )}

          {/* View content */}
          {view==="preview" && (
            <div ref={canvasRef} className="flex-1 overflow-hidden relative" style={{
              backgroundImage:`radial-gradient(circle, rgba(44,34,20,0.07) 1px, transparent 1px)`,
              backgroundSize:"22px 22px",
            }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background:"radial-gradient(ellipse at center, transparent 55%, rgba(245,237,216,0.65) 100%)" }}/>
              <PreviewBrief spec={generatedSpec} stylePack={stylePack} device={device} selectedModel={selectedModel} buildStatus={buildStatus} lastPrompt={lastPrompt}/>
              <AnimatePresence mode="wait">
                <motion.div key={`${device}-${stylePack.id}-${lastPrompt}-${dragKey}`}
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  transition={{ duration:0.2 }}>
                  <motion.div drag dragMomentum={false} dragElastic={0} dragConstraints={canvasRef}
                    className="cursor-grab active:cursor-grabbing relative"
                    initial={{ scale:0.95, y:12 }} animate={{ scale:1, y:0 }}
                    transition={{ duration:0.3, ease:[0.22,1,0.36,1] }}>
                    <DraggableGeneratedPreview device={device} spec={generatedSpec} stylePack={stylePack}/>
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {view==="code" && <CodePanel files={codeFiles} appTitle={generatedSpec.title}/>}
          {view==="deployed" && <DeployedPanel onViewApp={()=>setShowViewApp(true)} onCode={()=>setView("code")}/>}

          {/* Active build context bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5" style={{ borderTop:"1px solid var(--border)", background:"var(--card)" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontFamily:"DM Mono,monospace", fontSize:9, color:activeFolder.color, fontWeight:700 }}>{activeFolder.name}</span>
              <span style={{ fontFamily:"DM Mono,monospace", fontSize:9, color:"var(--muted-foreground)" }}>· {activeProject?.name}</span>
              <span style={{ fontFamily:"DM Mono,monospace", fontSize:9, color:"var(--accent)", fontWeight:600 }}>{selectedModel}</span>
              <span style={{ fontSize:9, color:"var(--muted-foreground)", fontFamily:"DM Mono,monospace" }}>· {storageStatus}</span>
              <span style={{ fontSize:9, color:"var(--muted-foreground)", fontFamily:"DM Mono,monospace" }}>· {buildStatus}</span>
              {[
                { count:activeConnectors, label:"Connector" },
                { count:activeSkills,     label:"Skill" },
                { count:activeAgents,     label:"Agent" },
                { count:activeCaps,       label:"Capability", plural:"Capabilities" },
                { count:uploadedFiles.length, label:"File" },
              ].map(item=>(
                item.count>0 && <span key={item.label} style={{ fontSize:9, color:"var(--muted-foreground)", fontFamily:"DM Mono,monospace" }}>
                  · {item.count} {item.count!==1 && "plural" in item ? item.plural : `${item.label}${item.count!==1?"s":""}`}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {autosaved
                ? <><div className="w-1.5 h-1.5 rounded-full" style={{ background:"#6BCB77" }}/><span style={{ fontSize:9, color:"var(--muted-foreground)" }}>Autosaved {activeProject ? compactTime(activeProject.savedAt) : ""}</span></>
                : <><motion.div className="w-1.5 h-1.5 rounded-full" style={{ background:"var(--accent)" }} animate={{ opacity:[1,0.3,1] }} transition={{ duration:1, repeat:Infinity }}/><span style={{ fontSize:9, color:"var(--muted-foreground)" }}>Saving…</span></>
              }
              <span style={{ fontSize:9, color:"var(--muted-foreground)", marginLeft:6, fontFamily:"DM Mono,monospace" }}>
                {DEVICE_CONFIGS_STATUS[device]}
              </span>
            </div>
          </div>
        </main>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showConnector && <ConnectorPanel connectors={connectors} onToggle={toggleConnector} onClose={()=>setShowConnector(false)}/>}
        {showSkills    && <SkillsPanel    skills={skills}         onToggle={toggleSkill}     onClose={()=>setShowSkills(false)}/>}
        {showAgents    && <AgentsPanel    agents={agents}          onToggle={toggleAgent}     onClose={()=>setShowAgents(false)}/>}
        {showFunctions && <FunctionsPanel caps={capabilities}     onToggle={toggleCap}       onClose={()=>setShowFunctions(false)}/>}
        {showViewApp   && <ViewAppMenu    appUrl={appUrl} onClose={()=>setShowViewApp(false)}/>}
        {showProjects  && <ProjectsPanel
          projects={projects}
          folders={folders}
          activeProjectId={activeProjectId}
          onOpen={openProject}
          onNew={createProject}
          onDuplicate={duplicateProject}
          onDelete={deleteProject}
          onRename={renameProject}
          onMove={moveProject}
          onSave={saveProject}
          onClose={()=>setShowProjects(false)}
        />}
      </AnimatePresence>

      {/* Click-away to close popovers */}
      {(showPlus||showModel) && <div className="fixed inset-0 z-30" onClick={()=>{ setShowPlus(false); setShowModel(false); }}/>}
    </div>
  );
}

// Status line dimensions per device
const DEVICE_CONFIGS_STATUS: Record<DeviceMode,string> = {
  phone:   "375 × 720",
  tablet:  "768 × 600",
  desktop: "1100 × 620",
};
