"use client";

import { useState, useRef, useEffect } from "react";
import { AGENTS, AGENT_ORDER, parseRoute, cleanOrchestrator } from "./agents";

function AgentBadge({ agent, active, done }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "6px",
      padding: "6px 12px", borderRadius: "2px",
      border: `1px solid ${active || done ? agent.color : "#4a6ab0"}`,
      background: active ? `${agent.color}22` : "transparent",
      transition: "all 0.3s",
      opacity: done ? 0.6 : 1
    }}>
      <span style={{ color: agent.color, fontSize: "15px" }}>{agent.icon}</span>
      <span style={{ color: active || done ? agent.color : "#a0b4d0", fontSize: "13px", letterSpacing: "1.5px", fontFamily: "monospace" }}>
        {agent.name}
      </span>
      {active && <span style={{ color: agent.color, fontSize: "13px", animation: "pulse 1s infinite" }}>●</span>}
      {done && <span style={{ color: agent.color, fontSize: "13px" }}>✓</span>}
    </div>
  );
}

function MessageBlock({ msg }) {
  const agent = AGENTS[msg.agentId];
  const isUser = msg.role === "user";
  return (
    <div style={{
      marginBottom: "24px",
      borderLeft: isUser ? "none" : `2px solid ${agent?.color || "#E8C44A"}`,
      paddingLeft: isUser ? "0" : "16px",
    }}>
      {!isUser && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ color: agent?.color, fontSize: "22px" }}>{agent?.icon}</span>
          <span style={{ color: agent?.color, fontSize: "16px", letterSpacing: "2px", fontFamily: "monospace" }}>{agent?.name}</span>
          <span style={{ color: "#a0b4d0", fontSize: "14px", fontFamily: "monospace" }}>— {agent?.role}</span>
        </div>
      )}
      {isUser && (
        <div style={{ marginBottom: "6px" }}>
          <span style={{ color: "#a0b4d0", fontSize: "13px", letterSpacing: "2px", fontFamily: "monospace" }}>YOU</span>
        </div>
      )}
      <div style={{
        color: isUser ? "#c8d8f0" : "#dde8f8",
        fontSize: "18px",
        lineHeight: "1.8",
        fontFamily: "'Georgia', serif",
        whiteSpace: "pre-wrap"
      }}>
        {msg.content}
      </div>
    </div>
  );
}

async function callAgent(agentId, userMessage) {
  const agent = AGENTS[agentId];
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: agent.systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    })
  });
  const data = await response.json();
  return data.content?.[0]?.text || "No response.";
}

function RacingStripes() {
  const colors = ["#E8C44A", "#E8762A", "#CC3D2A", "#CC3A7A", "#A0286E"];
  return (
    <div style={{ width: "100%", lineHeight: 0 }}>
      {colors.map((color, i) => (
        <div key={i}>
          <div style={{
            height: "28px",
            width: "100%",
            backgroundColor: color,
            backgroundImage: `
              repeating-linear-gradient(
                92deg,
                transparent 0px, transparent 6px,
                rgba(0,0,0,0.12) 6px, rgba(0,0,0,0.12) 7px,
                transparent 7px, transparent 11px,
                rgba(0,0,0,0.07) 11px, rgba(0,0,0,0.07) 12px
              ),
              repeating-linear-gradient(
                180deg,
                rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px,
                transparent 1px, transparent 4px,
                rgba(0,0,0,0.06) 4px, rgba(0,0,0,0.06) 5px,
                transparent 5px, transparent 9px
              ),
              repeating-linear-gradient(
                137deg,
                transparent 0px, transparent 8px,
                rgba(0,0,0,0.05) 8px, rgba(0,0,0,0.05) 9px
              )
            `,
          }} />
          {i < colors.length - 1 && (
            <div style={{ height: "3px", background: "white", width: "100%", opacity: 0.95 }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAgents, setActiveAgents] = useState([]);
  const [doneAgents, setDoneAgents] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const bottomRef = useRef(null);

  function toggleAgent(id) {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function getSavedConversations() {
    try {
      return JSON.parse(localStorage.getItem("mack_conversations") || "[]");
    } catch { return []; }
  }

  function saveConversation() {
    if (messages.length === 0) return;
    const id = Date.now().toString();
    const firstUserMsg = messages.find(m => m.role === "user")?.content || "Conversation";
    const title = firstUserMsg.slice(0, 50);
    const entry = { id, title, date: new Date().toISOString(), messages };
    const existing = getSavedConversations();
    existing.unshift(entry);
    localStorage.setItem("mack_conversations", JSON.stringify(existing));
    alert("Conversation saved!");
  }

  function loadHistory() {
    setHistory(getSavedConversations());
    setShowHistory(true);
  }

  function loadConversation(id) {
    const conv = getSavedConversations().find(c => c.id === id);
    if (conv) {
      setMessages(conv.messages || []);
      setShowHistory(false);
    }
  }

  function deleteConversation(e, id) {
    e.stopPropagation();
    const updated = getSavedConversations().filter(c => c.id !== id);
    localStorage.setItem("mack_conversations", JSON.stringify(updated));
    setHistory(updated);
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setLoading(true);
    setActiveAgents([]);
    setDoneAgents([]);

    setMessages(prev => [...prev, { role: "user", agentId: "user", content: userMsg }]);

    setActiveAgents(["orchestrator"]);
    const orchResponse = await callAgent("orchestrator", userMsg);
    const route = parseRoute(orchResponse);
    const cleanedOrch = cleanOrchestrator(orchResponse);

    setMessages(prev => [...prev, { role: "assistant", agentId: "orchestrator", content: cleanedOrch }]);
    setDoneAgents(["orchestrator"]);
    setActiveAgents([]);

    const relevantAgents = selectedAgents.length > 0
      ? selectedAgents.filter(id => AGENT_ORDER.includes(id))
      : route.filter(id => AGENT_ORDER.includes(id));
    setActiveAgents(relevantAgents);

    const specialistResults = await Promise.all(
      relevantAgents.map(async (agentId) => {
        const response = await callAgent(agentId, userMsg);
        return { agentId, content: response };
      })
    );

    setActiveAgents([]);
    setDoneAgents(prev => [...prev, ...relevantAgents]);
    specialistResults.forEach(({ agentId, content }) => {
      setMessages(prev => [...prev, { role: "assistant", agentId, content }]);
    });

    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const allAgentIds = ["orchestrator", ...AGENT_ORDER];

  return (
    <div style={{
      minHeight: "100vh", background: "#2B4590", color: "#dde8f8",
      fontFamily: "monospace", display: "flex", flexDirection: "column"
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        textarea:focus { outline: none; }
        textarea { resize: none; }
        textarea::placeholder { color: #6a84b8; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1e3070; }
        ::-webkit-scrollbar-thumb { background: #4a6ab0; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #3a5aaa", padding: "20px 32px 20px 50px",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        background: "#243d82", position: "relative", zIndex: 10
      }}>
        <div>
          <div style={{ color: "#E8762A", fontSize: "28px", letterSpacing: "4px", marginBottom: "4px", fontWeight: "bold" }}>MACK ATTACK</div>
          <div style={{ color: "#E8C44A", fontSize: "15px", letterSpacing: "2px", marginBottom: "10px" }}>MULTI-AGENT INTELLIGENCE NETWORK</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={saveConversation} style={{
              background: "transparent", border: "1px solid #4a6ab0", color: "#a0b4d0",
              padding: "5px 14px", fontSize: "12px", letterSpacing: "1.5px",
              cursor: "pointer", borderRadius: "2px", fontFamily: "monospace", transition: "all 0.2s"
            }}
            onMouseEnter={e => { e.target.style.borderColor = "#E8C44A"; e.target.style.color = "#E8C44A"; }}
            onMouseLeave={e => { e.target.style.borderColor = "#4a6ab0"; e.target.style.color = "#a0b4d0"; }}
            >SAVE</button>
            <button onClick={loadHistory} style={{
              background: "transparent", border: "1px solid #4a6ab0", color: "#a0b4d0",
              padding: "5px 14px", fontSize: "12px", letterSpacing: "1.5px",
              cursor: "pointer", borderRadius: "2px", fontFamily: "monospace", transition: "all 0.2s"
            }}
            onMouseEnter={e => { e.target.style.borderColor = "#E8C44A"; e.target.style.color = "#E8C44A"; }}
            onMouseLeave={e => { e.target.style.borderColor = "#4a6ab0"; e.target.style.color = "#a0b4d0"; }}
            >HISTORY</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {allAgentIds.map(id => (
            <AgentBadge key={id} agent={AGENTS[id]} active={activeAgents.includes(id)} done={doneAgents.includes(id)} />
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px", maxWidth: "900px", width: "100%", margin: "0 auto", position: "relative", zIndex: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: "80px", animation: "fadeIn 0.8s ease" }}>
            <RacingStripes />
            <div style={{ padding: "32px 0 24px" }}>
              <div style={{ color: "#E8762A", fontSize: "64px", marginBottom: "16px" }}>⬡</div>
              <div style={{ color: "#E8C44A", fontSize: "17px", letterSpacing: "3px", marginBottom: "32px" }}>NETWORK ONLINE</div>
              <div style={{ color: "#c8d8f0", fontSize: "17px", lineHeight: "2", maxWidth: "520px", margin: "0 auto" }}>
                Ask anything about apps, futures trading, or real estate. The Orchestrator routes your query to the right specialists.
              </div>
            </div>
            <RacingStripes />
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ animation: "fadeIn 0.4s ease" }}>
            <MessageBlock msg={msg} />
          </div>
        ))}

        {loading && activeAgents.length > 0 && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px" }}>
            <span style={{ color: "#a0b4d0", fontSize: "13px", letterSpacing: "1px" }}>ROUTING TO</span>
            {activeAgents.map(id => (
              <span key={id} style={{ color: AGENTS[id]?.color, fontSize: "13px", letterSpacing: "1px" }}>
                {AGENTS[id]?.name}
              </span>
            ))}
            <span style={{ color: "#E8C44A", animation: "pulse 1s infinite" }}>●●●</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* History Panel */}
      {showHistory && (
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "340px",
          background: "#1e3070", borderLeft: "1px solid #3a5aaa",
          padding: "24px", overflowY: "auto", zIndex: 100
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <span style={{ color: "#E8C44A", fontSize: "14px", letterSpacing: "2px" }}>HISTORY</span>
            <button onClick={() => setShowHistory(false)} style={{
              background: "transparent", border: "none", color: "#6a84b8",
              fontSize: "22px", cursor: "pointer"
            }}>×</button>
          </div>
          {history.length === 0 ? (
            <div style={{ color: "#6a84b8", fontSize: "14px" }}>No saved conversations.</div>
          ) : (
            history.map(c => (
              <div key={c.id} onClick={() => loadConversation(c.id)} style={{
                padding: "12px", marginBottom: "8px", border: "1px solid #3a5aaa",
                borderRadius: "2px", cursor: "pointer", transition: "all 0.2s",
                display: "flex", justifyContent: "space-between", alignItems: "flex-start"
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#E8C44A"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#3a5aaa"}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#c8d8f0", fontSize: "14px", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                  <div style={{ color: "#6a84b8", fontSize: "12px" }}>{new Date(c.date).toLocaleDateString()}</div>
                </div>
                <button onClick={(e) => deleteConversation(e, c.id)} style={{
                  background: "transparent", border: "none", color: "#6a84b8",
                  fontSize: "16px", cursor: "pointer", padding: "0 0 0 8px",
                  lineHeight: 1, flexShrink: 0, transition: "color 0.2s"
                }}
                onMouseEnter={e => e.target.style.color = "#CC3D2A"}
                onMouseLeave={e => e.target.style.color = "#6a84b8"}
                title="Delete">✕</button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Input */}
      <div style={{ borderTop: "1px solid #3a5aaa", padding: "20px 32px 20px 50px", maxWidth: "900px", width: "100%", margin: "0 auto", boxSizing: "border-box", position: "relative", zIndex: 10 }}>
        {/* Agent selector */}
        <div style={{ marginBottom: "12px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#c8d8f0", fontSize: "13px", letterSpacing: "1.5px", fontFamily: "monospace" }}>FORCE AGENTS:</span>
          {AGENT_ORDER.map(id => {
            const agent = AGENTS[id];
            const checked = selectedAgents.includes(id);
            return (
              <label key={id} onClick={() => toggleAgent(id)} style={{
                display: "flex", alignItems: "center", gap: "6px",
                cursor: "pointer", padding: "5px 12px", borderRadius: "2px",
                border: `1px solid ${checked ? agent.color : "#4a6ab0"}`,
                background: checked ? `${agent.color}22` : "transparent",
                transition: "all 0.2s"
              }}>
                <span style={{
                  width: "12px", height: "12px", borderRadius: "2px", display: "inline-block",
                  border: `1px solid ${checked ? agent.color : "#6a84b8"}`,
                  background: checked ? agent.color : "transparent",
                  flexShrink: 0, transition: "all 0.2s"
                }} />
                <span style={{ color: agent.color, fontSize: "15px" }}>{agent.icon}</span>
                <span style={{ color: checked ? agent.color : "#c8d8f0", fontSize: "13px", letterSpacing: "1px", fontFamily: "monospace" }}>
                  {agent.name}
                </span>
              </label>
            );
          })}
          {selectedAgents.length > 0 && (
            <button onClick={() => setSelectedAgents([])} style={{
              background: "transparent", border: "1px solid #4a6ab0", color: "#a0b4d0",
              padding: "5px 10px", fontSize: "12px", letterSpacing: "1px",
              cursor: "pointer", borderRadius: "2px", fontFamily: "monospace"
            }}>CLEAR</button>
          )}
          {selectedAgents.length === 0 && (
            <span style={{ color: "#a0b4d0", fontSize: "13px", fontFamily: "monospace", fontStyle: "italic" }}>No Selection = Orchestrator Decides</span>
          )}
        </div>

        <div style={{
          display: "flex", gap: "12px", alignItems: "flex-end",
          border: "1px solid #3a5aaa", borderRadius: "2px",
          padding: "12px 16px", background: "#1e3070"
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Deploy a query to the network..."
            rows={5}
            style={{
              flex: 1, background: "transparent", border: "none",
              color: "#dde8f8", fontSize: "17px", fontFamily: "'Georgia', serif",
              lineHeight: "1.6"
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? "transparent" : "#E8762A",
              border: `1px solid ${loading || !input.trim() ? "#4a6ab0" : "#E8762A"}`,
              color: loading || !input.trim() ? "#6a84b8" : "#fff",
              padding: "10px 20px", fontSize: "13px", letterSpacing: "2px",
              cursor: loading || !input.trim() ? "default" : "pointer",
              borderRadius: "2px", fontFamily: "monospace", transition: "all 0.2s"
            }}
          >
            {loading ? "ROUTING..." : "DEPLOY ↑"}
          </button>
        </div>
        <div style={{ marginTop: "8px", color: "#a0b4d0", fontSize: "12px", letterSpacing: "1px" }}>
          SHIFT+ENTER for new line · ENTER to send
        </div>
      </div>
    </div>
  );
}
