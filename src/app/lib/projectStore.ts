import { getSupabase, isSupabaseConfigured } from "./supabase";

export interface PersistableProject {
  id: string;
  name: string;
  folderId: string;
  prompt: string;
  styleSeed: number;
  updatedAt: Date;
  savedAt: Date;
  pinned?: boolean;
}

const STORAGE_KEY = "lotus.builder.projects.v1";
const WORKSPACE_KEY = "lotus.builder.workspaceId";

function workspaceId() {
  const existing = window.localStorage.getItem(WORKSPACE_KEY);
  if (existing) return existing;
  const next = `local-${crypto.randomUUID()}`;
  window.localStorage.setItem(WORKSPACE_KEY, next);
  return next;
}

function toRow(project: PersistableProject) {
  return {
    id: project.id,
    workspace_id: workspaceId(),
    name: project.name,
    folder_id: project.folderId,
    prompt: project.prompt,
    style_seed: project.styleSeed,
    updated_at: project.updatedAt.toISOString(),
    saved_at: project.savedAt.toISOString(),
    pinned: Boolean(project.pinned),
  };
}

function fromRow(row: Record<string, unknown>): PersistableProject {
  return {
    id: String(row.id),
    name: String(row.name),
    folderId: String(row.folder_id),
    prompt: String(row.prompt),
    styleSeed: Number(row.style_seed),
    updatedAt: new Date(String(row.updated_at)),
    savedAt: new Date(String(row.saved_at)),
    pinned: Boolean(row.pinned),
  };
}

function saveLocal(projects: PersistableProject[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.map(toRow)));
}

function loadLocal(fallback: PersistableProject[]) {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const rows = JSON.parse(raw) as Record<string, unknown>[];
    return rows.map(fromRow).sort((a,b)=>b.updatedAt.getTime()-a.updatedAt.getTime());
  } catch {
    return fallback;
  }
}

export function projectStoreMode() {
  return isSupabaseConfigured ? "Supabase" : "Local";
}

export async function loadProjects(fallback: PersistableProject[]) {
  const localProjects = loadLocal(fallback);
  const supabase = await getSupabase();
  if (!supabase) return localProjects;

  const { data, error } = await supabase
    .from("lotus_builder_projects")
    .select("id,name,folder_id,prompt,style_seed,updated_at,saved_at,pinned")
    .eq("workspace_id", workspaceId())
    .order("updated_at", { ascending:false });

  if (error) {
    console.warn("Supabase project load failed; using local projects.", error.message);
    return localProjects;
  }

  if (data.length===0) {
    await Promise.all(fallback.map(project=>upsertProject(project)));
    return fallback;
  }

  const projects = data.map(fromRow);
  saveLocal(projects);
  return projects;
}

export async function upsertProject(project: PersistableProject) {
  const current = loadLocal([]);
  const next = [project, ...current.filter(p=>p.id!==project.id)].sort((a,b)=>b.updatedAt.getTime()-a.updatedAt.getTime());
  saveLocal(next);

  const supabase = await getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("lotus_builder_projects").upsert(toRow(project), { onConflict:"id" });
  if (error) throw error;
}

export async function deleteStoredProject(id: string) {
  saveLocal(loadLocal([]).filter(project=>project.id!==id));
  const supabase = await getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("lotus_builder_projects")
    .delete()
    .eq("workspace_id", workspaceId())
    .eq("id", id);
  if (error) throw error;
}
