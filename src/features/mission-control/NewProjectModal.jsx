import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLumonSelector } from "@/lumon/context";
import { selectDashboardProjects, selectFleetMetrics } from "@/lumon/selectors";
import { Plus } from "lucide-react";

const ENGINE_OPTIONS = [
  { id: "claude", label: "Claude Code", subtitle: "Operator-friendly planning and implementation loops" },
  { id: "codex", label: "Codex CLI", subtitle: "Terminal-first execution engine for canonical project ownership" },
];

const INITIAL_FORM = {
  name: "",
  description: "",
  engineChoice: "claude",
  agentCount: 2,
};

export default function NewProjectModal({ open, onClose, onSubmit }) {
  const metrics = useLumonSelector(selectFleetMetrics);
  const projects = useLumonSelector(selectDashboardProjects);
  const [form, setForm] = useState(INITIAL_FORM);
  const selectedEngine = useMemo(
    () => ENGINE_OPTIONS.find((option) => option.id === form.engineChoice) ?? ENGINE_OPTIONS[0],
    [form.engineChoice],
  );

  const closeModal = () => {
    setForm(INITIAL_FORM);
    onClose?.();
  };

  const handleSubmit = (event) => {
    event?.preventDefault?.();

    if (!form.name.trim()) {
      return;
    }

    const didSubmit =
      onSubmit?.({
        name: form.name.trim(),
        description: form.description.trim(),
        engineChoice: form.engineChoice,
        agentCount: form.agentCount,
      }) ?? true;

    if (didSubmit !== false) {
      closeModal();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeModal()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-md font-mono shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-bold text-emerald-400 tracking-[0.12em] uppercase flex items-center gap-2">
            <Plus size={14} />
            Spawn new project
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="new-project-name" className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
              Project name
            </Label>
            <Input
              id="new-project-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. registry-orbit"
              className="mt-1.5 bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-[12px] placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <Label htmlFor="new-project-description" className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
              Description
            </Label>
            <Input
              id="new-project-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="What mission should this registry entry own?"
              className="mt-1.5 bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-[12px] placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
              Execution engine
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ENGINE_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant={form.engineChoice === option.id ? "default" : "outline"}
                  onClick={() => setForm((current) => ({ ...current, engineChoice: option.id }))}
                  className={`h-auto flex-col items-start gap-1 rounded-lg px-3 py-3 text-left font-mono ${
                    form.engineChoice === option.id
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20"
                      : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide">{option.label}</span>
                  <span className="text-[10px] normal-case leading-relaxed opacity-80">{option.subtitle}</span>
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="new-project-agents" className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
              Agents to seed
            </Label>
            <Input
              id="new-project-agents"
              type="number"
              min={1}
              max={8}
              value={form.agentCount}
              onChange={(event) => {
                const nextValue = Number.parseInt(event.target.value, 10);
                setForm((current) => ({
                  ...current,
                  agentCount: Number.isFinite(nextValue) ? Math.max(1, Math.min(8, nextValue)) : 1,
                }));
              }}
              className="mt-1.5 bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-[12px] text-center focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>

          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-3 space-y-2">
              <div className="font-mono text-[10px] text-emerald-400 font-semibold uppercase tracking-[0.12em]">
                Canonical registry preview
              </div>
              <div className="font-mono text-[11px] text-zinc-300 leading-relaxed">
                This creates one canonical project in the shared registry, appends it to the existing floor layout, and selects it immediately after creation.
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                {[
                  { label: "Registry", value: projects.length },
                  { label: "Engine", value: selectedEngine.label },
                  { label: "Agents", value: form.agentCount },
                ].map((item) => (
                  <div key={item.label} className="rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                    <div className="text-zinc-600 uppercase tracking-[0.08em]">{item.label}</div>
                    <div className="mt-1 text-zinc-200 font-semibold">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2 text-[10px] text-zinc-400 leading-relaxed">
                Fleet baseline: {metrics.running} running · {metrics.queued} queued · {metrics.total} total agents.
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeModal}
              className="font-mono text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!form.name.trim()}
              className="font-mono text-[11px] font-bold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
            >
              Create canonical project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
