import React from "react";
import {
  Bot,
  Clock,
  MessageCircle,
  Sparkles,
  Trash2,
  UserCircle
} from "lucide-react";
import { AppState, monthOptions, renderInlineMarkdown, parseMarkdownTable } from "./common";

export function ChatContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p-${blocks.length}`}>{renderInlineMarkdown(paragraph.join(" "))}</p>);
    paragraph = [];
  };

  for (let index = 0; index < lines.length;) {
    const table = parseMarkdownTable(lines, index);
    if (table) {
      flushParagraph();
      blocks.push(
        <div className="chat-table-wrap" key={`table-${blocks.length}`}>
          <table className="chat-table">
            <thead>
              <tr>{table.headers.map((header, cellIndex) => <th key={cellIndex}>{renderInlineMarkdown(header)}</th>)}</tr>
            </thead>
            <tbody>
              {table.body.map((row, rowIndex) => (
                <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{renderInlineMarkdown(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      index = table.nextIndex;
      continue;
    }
    const line = lines[index].trim();
    if (!line) {
      flushParagraph();
      index += 1;
      continue;
    }
    paragraph.push(line);
    index += 1;
  }
  flushParagraph();
  return <div className="chat-content">{blocks}</div>;
}

export function AiChat({ state, year, month, setNotice }: { state: AppState; year: number; month: number; setNotice: (value: string) => void }) {
  const groqConfigured = state.settings.groq_api_key_configured === "true";
  const [prompt, setPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const recentQuestions = messages.filter((message) => message.role === "user").slice(-3).reverse();
  const quickQuestions = [
    "¿Qué sedes están más lejos de sus metas y qué acciones priorizarías?",
    "¿Qué oportunidades de rentabilidad muestran los datos de este mes?",
    "¿Qué debería revisar hoy como director comercial?"
  ];

  function prepareQuestion(question: string) {
    setPrompt(question);
    inputRef.current?.focus();
  }

  async function ask(question = prompt) {
    const text = question.trim();
    if (!text || loading) return;
    if (!groqConfigured) {
      setNotice("Groq no esta configurado.");
      return;
    }
    const nextMessages: Array<{ role: "user" | "assistant"; content: string }> = [...messages, { role: "user", content: text }];
    setPrompt("");
    setLoading(true);
    setMessages(nextMessages);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, messages: nextMessages.slice(-10), year, month, mode: "chat" })
      });
      const json = await res.json();
      if (!res.ok) {
        const error = json.error || "Groq no pudo responder";
        setMessages((current) => [...current, { role: "assistant", content: error }]);
        return;
      }
      setMessages((current) => [...current, { role: "assistant", content: json.answer }]);
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "Groq tardó demasiado en responder. Intenta de nuevo en unos segundos."
        : error instanceof Error
          ? error.message
          : "Groq no pudo responder";
      setMessages((current) => [...current, { role: "assistant", content: message }]);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <div className="view ai-chat-view">
      <section className="panel ai-chat-panel">
        <div className="panel-title">
          <h2>Director comercial IA</h2>
          <span className={groqConfigured ? "status-pill ok" : "status-pill pending"}>{groqConfigured ? "Activo" : "Sin configurar"}</span>
        </div>
        <div className="chat-log">
          {messages.length ? (
            messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                <span className="chat-message-author">
                  {message.role === "user" ? <UserCircle size={15} /> : <Bot size={15} />}
                  {message.role === "user" ? "Tú" : "Director comercial IA"}
                </span>
                <ChatContent content={message.content} />
              </article>
            ))
          ) : (
            <div className="chat-empty-state">
              <MessageCircle size={24} />
              <strong>¿Qué decisión comercial quieres analizar?</strong>
            </div>
          )}
          {loading ? (
            <article className="chat-message assistant">
              <span className="chat-message-author"><Bot size={15} />Director comercial IA</span>
              <ChatContent content="Analizando..." />
            </article>
          ) : null}
        </div>
        <div className="chat-input">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask().catch((error) => setNotice(error.message));
              }
            }}
            placeholder="Escribe tu mensaje..."
          />
          <button onClick={() => ask()} disabled={loading || !prompt.trim() || !groqConfigured}>Enviar</button>
        </div>
      </section>
      <aside className="panel ai-chat-side" aria-label="Herramientas del chat">
        <div className="panel-title">
          <h2>Análisis comercial</h2>
          <Sparkles size={18} aria-hidden="true" />
        </div>
        <div className="chat-side-section">
          <h3>Consultas rápidas</h3>
          <div className="chat-prompt-list">
            {quickQuestions.map((question) => (
              <button key={question} type="button" onClick={() => prepareQuestion(question)} title="Preparar pregunta">
                <MessageCircle size={16} aria-hidden="true" />
                <span>{question}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="chat-side-section chat-context">
          <h3>Contexto activo</h3>
          <dl>
            <div><dt>Período</dt><dd>{monthOptions[month - 1]} {year}</dd></div>
            <div><dt>Ventas positivas</dt><dd>{state.filters?.dataCoverage?.lastPositiveDay ? `Hasta el día ${state.filters.dataCoverage.lastPositiveDay}` : "Sin corte disponible"}</dd></div>
            <div><dt>IA</dt><dd>{groqConfigured ? "Disponible" : "Sin configurar"}</dd></div>
          </dl>
        </div>
        {recentQuestions.length ? (
          <div className="chat-side-section chat-recent">
            <div className="chat-side-heading">
              <h3>Preguntas recientes</h3>
              <button type="button" onClick={() => { setMessages([]); setPrompt(""); }} disabled={loading} title="Borrar conversación" aria-label="Borrar conversación"><Trash2 size={16} /></button>
            </div>
            <div className="chat-prompt-list">
              {recentQuestions.map((message, index) => (
                <button key={`${message.content}-${index}`} type="button" onClick={() => prepareQuestion(message.content)} title="Preparar pregunta anterior">
                  <Clock size={16} aria-hidden="true" />
                  <span>{message.content}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

