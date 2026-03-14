import { useState } from "react";
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
import { selectFleetMetrics } from "@/lumon/selectors";
import { Plus } from "lucide-react";

const INITIAL_FORM = {
  name: "",
  description: "",
  agentType: "claude",
  agentCount: 2,
};

export default function NewProjectModal({ open, onClose, onSubmit }) {
  const metrics = useLumonSelector(selectFleetMetrics);
  const [form, setForm] = useState(INITIAL_FORM);

  const closeModal = () => {
    setForm(INITIAL_FORM);
    onClose?.();
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      return;
    }

    onSubmit?.({
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
    });
    closeModal();
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

        <div className="space-y-4">
          <div>
            <Label className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
              Project name
            </Label>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. saas-dashboard"
              className="mt-1.5 bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-[12px] placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <Label className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
              Description
            </Label>
            <Input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="What are we building?"
              className="mt-1.5 bg-zinc-800 border-zinc-700 text-zinc-200 font-mono text-[12px] placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
                Default agent
              </Label>
              <div className="flex gap-1.5 mt-1.5">
                {[
                  { id: "claude", label: "Claude Code" },
                  { id: "codex", label: "Codex CLI" },
                ].map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant={form.agentType === option.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForm((current) => ({ ...current, agentType: option.id }))}
                    className={`flex-1 font-mono text-[11px] font-semibold uppercase tracking-wide ${
                      form.agentType === option.id
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20"
                        : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="w-24">
              <Label className="font-mono text-[10px] text-zinc-500 tracking-[0.08em] uppercase">
                Agents
              </Label>
              <Input
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
          </div>

          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-3 space-y-2">
              <div className="font-mono text-[10px] text-emerald-400 font-semibold uppercase tracking-[0.12em]">
                Intake preview
              </div>
              <div className="font-mono text-[11px] text-zinc-300">
                This queues a local intake draft while the canonical project store remains read-only in S01.
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                  <div className="text-zinc-600 uppercase tracking-[0.08em]">Running</div>
                  <div className="mt-1 text-zinc-200 font-semibold">{metrics.running}</div>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                  <div className="text-zinc-600 uppercase tracking-[0.08em]">Queued</div>
                  <div className="mt-1 text-zinc-200 font-semibold">{metrics.queued}</div>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                  <div className="text-zinc-600 uppercase tracking-[0.08em]">Total</div>
                  <div className="mt-1 text-zinc-200 font-semibold">{metrics.total}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
            type="button"
            size="sm"
            disabled={!form.name.trim()}
            onClick={handleSubmit}
            className="font-mono text-[11px] font-bold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            Queue intake draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
