import { useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import {
  streamChat,
  describeAiError,
  type ChatMessage,
  type StreamHandle,
} from '../ai/anthropicClient';
import { buildSystemPrompt, buildUserMessage } from '../ai/promptBuilder';
import { extractCodeBlocks, mergeBasicLines } from '../ai/codeExtractor';
import { getApiKey } from '../storage/settings';

interface DisplayMessage extends ChatMessage {
  streaming?: boolean;
}

export function AiPanel() {
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore((s) => s.source);
  const replaceDocument = useIdeStore((s) => s.replaceDocument);
  const requestRun = useIdeStore((s) => s.requestRun);
  const setSettingsOpen = useIdeStore((s) => s.setSettingsOpen);

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const streamRef = useRef<StreamHandle | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const request = input.trim();
    if (request === '' || busy) return;
    const apiKey = getApiKey();
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }
    setError('');
    setInput('');
    setBusy(true);

    const errors = dialect.lint(source);
    const userContent = buildUserMessage(request, source, errors);
    const history: ChatMessage[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: userContent },
    ];
    // Show the bare request in the thread; the full context goes to the API.
    setMessages((m) => [
      ...m,
      { role: 'user', content: request },
      { role: 'assistant', content: '', streaming: true },
    ]);

    const scrollDown = () => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };

    try {
      const handle = streamChat(
        apiKey,
        dialect.aiProfile,
        buildSystemPrompt(dialect),
        history,
        (delta) => {
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1]!;
            copy[copy.length - 1] = { ...last, content: last.content + delta };
            return copy;
          });
          scrollDown();
        },
      );
      streamRef.current = handle;
      const finalText = await handle.done;
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'assistant', content: finalText };
        return copy;
      });
    } catch (e) {
      setError(describeAiError(e));
      setMessages((m) =>
        m.filter((msg) => !(msg.streaming && msg.content === '')),
      );
      setMessages((m) =>
        m.map((msg) =>
          msg.streaming ? { role: msg.role, content: msg.content } : msg,
        ),
      );
    } finally {
      streamRef.current = null;
      setBusy(false);
    }
  };

  const stop = () => streamRef.current?.abort();

  const applyReplace = (code: string) => {
    replaceDocument(code.endsWith('\n') ? code : code + '\n');
  };

  const applyMerge = (code: string) => {
    replaceDocument(mergeBasicLines(source, code));
  };

  const renderMessage = (msg: DisplayMessage, idx: number) => {
    if (msg.role === 'user') {
      return (
        <div key={idx} className="ai-msg ai-user">
          {msg.content}
        </div>
      );
    }
    const blocks = extractCodeBlocks(msg.content);
    // Render text with code blocks replaced by panels
    const parts: React.ReactNode[] = [];
    let rest = msg.content;
    blocks.forEach((block, bi) => {
      const fenceStart = rest.indexOf('```');
      if (fenceStart >= 0) {
        const before = rest.slice(0, fenceStart).trim();
        if (before) parts.push(<p key={`t${bi}`}>{before}</p>);
        const fenceEnd = rest.indexOf('```', fenceStart + 3);
        rest = fenceEnd >= 0 ? rest.slice(fenceEnd + 3) : '';
      }
      parts.push(
        <div key={`c${bi}`} className="ai-code">
          <pre>{block.code}</pre>
          <div className="ai-code-actions">
            <button
              onClick={() => applyReplace(block.code)}
              title="Replace the whole program"
            >
              Replace program
            </button>
            <button
              onClick={() => applyMerge(block.code)}
              title="Merge by BASIC line number"
            >
              Merge lines
            </button>
            <button
              onClick={() => {
                applyReplace(block.code);
                requestRun();
              }}
            >
              Replace + Run ▶
            </button>
          </div>
        </div>,
      );
    });
    const tail = rest.trim();
    if (tail) parts.push(<p key="tail">{tail}</p>);
    if (parts.length === 0 && msg.streaming)
      parts.push(<p key="thinking">…</p>);
    return (
      <div key={idx} className="ai-msg ai-assistant">
        {parts}
      </div>
    );
  };

  return (
    <div className="ai-panel">
      <div className="ai-header">
        <strong>AI assistant</strong>
        <button className="linklike" onClick={() => setSettingsOpen(true)}>
          key…
        </button>
      </div>
      <div className="ai-thread" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="ai-hint">
            Ask for a game and it lands in your editor. Try:
            <em> “write a breakout game”</em>, <em>“make the paddle faster”</em>
            ,<em> “fix the errors”</em>.
          </div>
        )}
        {messages.map(renderMessage)}
        {error && <div className="ai-error">{error}</div>}
      </div>
      <div className="ai-input">
        <textarea
          value={input}
          rows={2}
          placeholder="Describe the game or change you want…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {busy ? (
          <button onClick={stop}>Stop</button>
        ) : (
          <button onClick={() => void send()} disabled={input.trim() === ''}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}
