"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckSquare, Plus } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  priority: string;
  entityType: string | null;
  entityId: string | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function addTask() {
    if (!newTask.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTask.trim(), priority: "medium" }),
      });
      if (res.ok) {
        setNewTask("");
        fetchTasks();
      }
    } catch { /* */ }
    finally { setSaving(false); }
  }

  async function toggleTask(id: string, currentStatus: string) {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch { /* */ }
  }

  const pending = tasks.filter((t) => t.status !== "completed");
  const completed = tasks.filter((t) => t.status === "completed");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6" style={{ height: "var(--header-height)", borderBottom: "0.5px solid var(--color-border-default)" }}>
        <CheckSquare size={16} style={{ color: "var(--color-text-tertiary)" }} />
        <h1 className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>Tasks</h1>
        <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>{tasks.length}</span>
      </div>

      {/* Add task bar */}
      <div className="flex items-center gap-2 px-6 py-2" style={{ borderBottom: "0.5px solid var(--color-border-default)" }}>
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add a task..."
          className="h-8 flex-1 rounded-md px-3 text-[13px] outline-none"
          style={{ background: "var(--color-bg-surface)", border: "0.5px solid var(--color-border-default)", color: "var(--color-text-primary)" }}
        />
        <button onClick={addTask} disabled={!newTask.trim() || saving}
          className="flex h-8 items-center gap-1 rounded-md px-3 text-[12px] font-medium text-white disabled:opacity-40"
          style={{ background: "var(--color-accent)" }}>
          <Plus size={13} /> {saving ? "..." : "Add"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="space-y-1">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-10 rounded-md" />)}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <CheckSquare size={32} style={{ color: "var(--color-text-muted)" }} />
            <p className="mt-3 text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>No tasks yet</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>Add tasks or ask the chat to create follow-ups.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pending.length > 0 && (
              <div>
                <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
                  Pending ({pending.length})
                </h2>
                <div className="space-y-0.5">
                  {pending.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 rounded-md px-3 transition-colors"
                      style={{ height: "var(--table-row-height)", borderBottom: "0.5px solid var(--color-border-default)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-muted)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <button onClick={() => toggleTask(task.id, task.status)}
                        className="h-4 w-4 shrink-0 rounded"
                        style={{ border: "0.5px solid var(--color-border-strong)" }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>{task.title}</span>
                      </div>
                      {task.priority === "high" && (
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                          style={{ background: "var(--color-error-soft)", color: "var(--color-error)" }}>
                          High
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {completed.length > 0 && (
              <div>
                <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  Completed ({completed.length})
                </h2>
                <div className="space-y-0.5 opacity-60">
                  {completed.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 rounded-md px-3"
                      style={{ height: "var(--table-row-height)" }}>
                      <button onClick={() => toggleTask(task.id, task.status)}
                        className="flex h-4 w-4 items-center justify-center rounded text-[9px]"
                        style={{ background: "var(--color-accent-soft)", border: "0.5px solid var(--color-accent)", color: "var(--color-accent)" }}>
                        ✓
                      </button>
                      <span className="text-[13px] line-through" style={{ color: "var(--color-text-secondary)" }}>{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
