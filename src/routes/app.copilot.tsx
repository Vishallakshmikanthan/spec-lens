import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { PageHeader, DemoNotice } from "@/components/speclens/primitives";
import { Button } from "@/components/ui/button";
import { api, copilotService } from "@/lib/speclens/api";
import type { CopilotMessage, SourceReference } from "@/types/speclens";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/copilot")({
  head: () => ({
    meta: [
      { title: "SpecLens Copilot — SpecLens" },
      {
        name: "description",
        content:
          "Ask questions grounded in retrieved technical evidence, with citations and confidence.",
      },
      { property: "og:title", content: "SpecLens Copilot — SpecLens" },
      {
        property: "og:description",
        content:
          "Ask questions grounded in retrieved technical evidence, with citations and confidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CopilotPage,
});

function CopilotPage() {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const q = input.trim();
    setInput("");
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", content: q }]);
    setThinking(true);
    setError(null);
    try {
      const reply = await copilotService.ask(q);
      setMessages((m) => [...m, { id: reply.id, role: "assistant", content: reply.content }]);
    } catch (err) {
      setError("Failed to get answer. Please try again.");
      setMessages((m) => [
        ...m,
        {
          id: `e${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    }
    setThinking(false);
  };

  const suggestedQuestions = [
    "What is the supply voltage range?",
    "Which pin is VCC?",
    "Show the typical application circuit.",
    "What package is this component available in?",
  ];

  const renderSourceReferences = (sources: SourceReference[]) => {
    if (!sources.length) return null;
    return (
      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Sources
        </p>
        <ul className="space-y-1.5">
          {sources.map((s) => (
            <li key={s.evidenceId} className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-primary">{s.evidenceId}</span>
              <span className="truncate">{s.label}</span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                p{s.page} · {(s.confidence * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  if (messages.length === 0 && !input && !thinking && !error) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
        <PageHeader
          title="SpecLens Copilot"
          subtitle="Ask questions grounded in retrieved technical evidence."
        />
        <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6 sm:px-6">
          <div className="panel p-4 text-center">
            <Bot className="size-6 mb-3 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-[15px] font-medium">Ask a question</h3>
            <p className="text-[13px] text-muted-foreground">
              Enter a question about a component or specification, and SpecLens Copilot will find
              grounded evidence from the retrieved technical documentation.
            </p>
            <Button onClick={() => setInput(suggestedQuestions[0] ?? "")} className="mt-3">
              Try first question
            </Button>
          </div>
        </div>
        <div className="sticky bottom-0 border-t border-border bg-background/90 p-4 backdrop-blur">
          <form onSubmit={send} className="mx-auto flex max-w-3xl gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Ask SpecLens Copilot"
              placeholder="Ask about a specification, e.g. What is the supply voltage range?"
              className="h-11 flex-1 rounded-md border border-border bg-surface px-3.5 text-[13.5px] outline-none focus-visible:border-primary/60"
            />
            <Button type="submit" aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
          <DemoNotice className="mx-auto mt-2 max-w-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <PageHeader
        title="SpecLens Copilot"
        subtitle="Ask questions grounded in retrieved technical evidence."
      />
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6 sm:px-6">
        {messages.map((m) => (
          <div key={m.id} className="animate-rise">
            {m.role === "user" ? (
              <p className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm border border-bg-secondary px-3.5 py-2.5 text-[13.5px]">
                {m.content}
              </p>
            ) : (
              <AssistantMessage message={m} renderSourceReferences={renderSourceReferences} />
            )}
          </div>
        ))}

        {thinking && (
          <p
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
            aria-live="polite"
          >
            Retrieving evidence
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1 animate-bounce rounded-full bg-primary"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
          </p>
        )}

        {error && (
          <div className="mt-4 p-4 rounded-md border-border bg-destructive/10 text-destructive">
            <p className="text-[13px]">{error}</p>
          </div>
        )}
      </div>
      <div className="sticky bottom-0 border-t border-border bg-background/90 p-4 backdrop-blur">
        <form onSubmit={send} className="mx-auto flex max-w-3xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Ask SpecLens Copilot"
            placeholder="Ask about a specification, e.g. What is the supply voltage range?"
            className="h-11 flex-1 rounded-md border border-border bg-surface px-3.5 text-[13.5px] outline-none focus-visible:border-primary/60"
          />
          <Button type="submit" aria-label="Send">
            <Send className="size-4" />
          </Button>
        </form>
        <DemoNotice className="mx-auto mt-2 max-w-3xl" />
      </div>
    </div>
  );
}

interface AssistantMessageProps {
  message: CopilotMessage & { sources?: SourceReference[]; confidence?: number };
  renderSourceReferences: (sources: SourceReference[]) => React.ReactNode | null;
}

function AssistantMessage({ message, renderSourceReferences }: AssistantMessageProps) {
  const confidencePct = message.confidence ? (message.confidence * 100).toFixed(1) : "—";

  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-center gap-2">
        <Bot className="size-4 text-primary" aria-hidden="true" />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Grounded answer
        </span>
        {message.confidence && (
          <span className="ml-auto font-mono text-[11px] text-success">{confidencePct}%</span>
        )}
      </div>
      <p className="text-[13.5px] leading-relaxed">{message.content}</p>
      {renderSourceReferences(message.sources ?? [])}
    </div>
  );
}
