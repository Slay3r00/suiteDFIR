"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
    role: "user" | "agent";
    content: string;
}

interface ChatSession {
    session_id: string;
    message_count: number;
    title?: string;
}

function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function AgentChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>("");
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchSessions = async () => {
        try {
            const response = await fetch("http://localhost:8000/agent/sessions");
            if (response.ok) {
                const data = await response.json();
                setSessions(data);
            }
        } catch (error) {
            console.error("Failed to fetch sessions:", error);
        }
    };

    useEffect(() => {
        fetchSessions();
        const storedSessionId = localStorage.getItem("agent_session_id");
        if (storedSessionId) {
            setSessionId(storedSessionId);
            loadSessionMessages(storedSessionId);
        } else {
            const newSessionId = generateSessionId();
            localStorage.setItem("agent_session_id", newSessionId);
            setSessionId(newSessionId);
        }
    }, []);

    const loadSessionMessages = async (sid: string) => {
        try {
            const response = await fetch(`http://localhost:8000/agent/sessions/${sid}/messages`);
            if (response.ok) {
                const data = await response.json();
                const loadedMessages: Message[] = data.map((m: { role: string; content: string }) => ({
                    role: m.role === "human" ? "user" : "agent",
                    content: m.content
                }));
                setMessages(loadedMessages);
            }
        } catch (error) {
            console.error("Failed to load session messages:", error);
        }
    };

    const switchSession = (sid: string) => {
        localStorage.setItem("agent_session_id", sid);
        setSessionId(sid);
        loadSessionMessages(sid);
    };

    const deleteSession = async (sid: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(`http://localhost:8000/agent/sessions/${sid}`, {
                method: "DELETE"
            });
            if (response.ok) {
                fetchSessions();
                if (sid === sessionId) {
                    handleNewSession();
                }
            }
        } catch (error) {
            console.error("Failed to delete session:", error);
        }
    };

    const userScrolledUp = useRef(false);
    const lastScrollTop = useRef(0);

    const isNearBottom = () => {
        if (!scrollRef.current) return false;
        const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
        const threshold = 100;
        return scrollHeight - scrollTop - clientHeight <= threshold;
    };

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "instant" // Use instant for chat-like feel
            });
        }
    };

    const handleScroll = () => {
        if (!scrollRef.current) return;

        const currentScrollTop = scrollRef.current.scrollTop;

        if (currentScrollTop < lastScrollTop.current) {
            // User scrolled up
            userScrolledUp.current = true;
        } else if (isNearBottom()) {
            // User scrolled back to bottom
            userScrolledUp.current = false;
        }

        lastScrollTop.current = currentScrollTop;
    };

    useEffect(() => {
        if (scrollRef.current) {
            // Only auto-scroll if user hasn't scrolled up
            if (!userScrolledUp.current) {
                scrollToBottom();
            }
        }
    }, [messages]);

    // Initial scroll
    useEffect(() => {
        scrollToBottom();
    }, []);

    const abortControllerRef = useRef<AbortController | null>(null);

    const handleSend = async () => {
        if (loading) {
            // If already loading, this button acts as a "Stop" button
            abortControllerRef.current?.abort();
            setLoading(false);
            return;
        }

        if (!input.trim() || !sessionId) return;

        const userMessage: Message = { role: "user", content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        // Add a placeholder message for the agent
        setMessages((prev) => [...prev, { role: "agent", content: "" }]);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const response = await fetch("http://localhost:8000/agent/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage.content,
                    session_id: sessionId
                }),
                signal: abortController.signal
            });

            if (!response.ok) {
                throw new Error("Failed to send message");
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedResponse = "";
            let buffer = "";

            if (!reader) throw new Error("No readable stream");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const decoded = decoder.decode(value, { stream: true });
                buffer += decoded;

                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Keep the partial line in the buffer

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

                    const jsonStr = trimmedLine.substring(6).trim();
                    if (jsonStr === "[DONE]") break;

                    try {
                        const data = JSON.parse(jsonStr);
                        if (data.content) {
                            accumulatedResponse += data.content;
                            // Adding a very small delay to help React render intermediate states
                            // especially on high-speed localhost
                            setMessages((prev) => {
                                const newMessages = [...prev];
                                const lastMsg = newMessages[newMessages.length - 1];
                                if (lastMsg && lastMsg.role === "agent") {
                                    newMessages[newMessages.length - 1] = {
                                        ...lastMsg,
                                        content: accumulatedResponse
                                    };
                                }
                                return newMessages;
                            });
                            // Force a small delay to ensure visual "streaming" feel
                            // even if tokens arrive in a burst from the network/backend
                            await new Promise(resolve => setTimeout(resolve, 20));
                        } else if (data.done) {
                            break;
                        } else if (data.error) {
                            throw new Error(data.error);
                        }
                    } catch (e) {
                        console.warn("Error parsing stream chunk:", e);
                    }
                }
            }
            fetchSessions();
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log("Stream aborted");
            } else {
                console.error("Chat error:", error);
                setMessages((prev) => {
                    const newMessages = [...prev];
                    if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === "agent") {
                        newMessages[newMessages.length - 1].content = "Sorry, something went wrong.";
                    }
                    return newMessages;
                });
            }
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    };

    const API_BASE_URL = "http://localhost:8000";

    const handleNewSession = async () => {
        // Check if there's already an empty "New Chat" session
        const existingEmptySession = sessions.find(s =>
            s.title === "New Chat" && s.message_count === 0
        );

        if (existingEmptySession) {
            // Switch to existing empty session
            if (sessionId !== existingEmptySession.session_id) {
                setSessionId(existingEmptySession.session_id);
                setMessages([]);
            }
            return;
        }

        // Create new persistent session via API
        const newSessionId = generateSessionId();
        try {
            await fetch(`${API_BASE_URL}/agent/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: newSessionId,
                    message: ""
                })
            });

            // Refresh sessions list
            await fetchSessions();

            // Switch to new session
            setSessionId(newSessionId);
            setMessages([]);
        } catch (error) {
            console.error("Failed to create new session:", error);
            // Fallback to local state
            setSessionId(newSessionId);
            setMessages([]);
        }
    };

    return (
        <div className="flex h-full bg-[#151515] overflow-hidden">
            {/* Main Chat Area */}
            <div className="flex-1 relative flex flex-col overflow-hidden">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto pb-40" ref={scrollRef} onScroll={handleScroll}>
                    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground opacity-30">
                                <Bot className="w-16 h-16 mb-4" />
                                <p className="text-lg">How can I help you today?</p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={msg.role === "user"
                                        ? "flex max-w-[85%] rounded-[24px] px-5 py-3.5 text-sm bg-[#2f2f2f] text-foreground rounded-tr-sm shadow-sm border border-border/20"
                                        : "flex w-full text-foreground text-[15px] leading-relaxed"
                                    }
                                >
                                    {msg.role === "agent" ? (
                                        <div className="prose prose-sm dark:prose-invert max-w-none w-full">
                                            {msg.content ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {msg.content}
                                                </ReactMarkdown>
                                            ) : (
                                                <span className="text-muted-foreground animate-pulse">Thinking...</span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Floating Input Area */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-100px)] max-w-4xl">
                    <div className="flex flex-col gap-2.5 bg-muted/80 backdrop-blur-sm rounded-3xl px-4 pt-3 pb-2.5 border border-border/50 shadow-lg">
                        <textarea
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Type a message..."
                            className="w-full bg-transparent border-none resize-none outline-none text-sm min-h-[40px] max-h-[150px] leading-6 placeholder:text-muted-foreground px-2 py-2"
                            style={{ height: 'auto' }}
                            disabled={loading}
                            rows={1}
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleSend}
                                disabled={!loading && !input.trim()}
                                className="rounded-full w-10 h-10 shrink-0 bg-[#ececec] hover:opacity-70 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="6" y="6" width="12" height="12" rx="1" fill="#000000" />
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
                                        <path d="m935 490-335-335-335 335 70 70 215-215v705h100v-705l215 215z" fill="#000000" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sessions Sidebar - Right Side */}
            <div className="w-64 border-l border-border/30 flex flex-col bg-[#111111]">
                <div className="p-3 border-b border-border/30">
                    <button
                        onClick={handleNewSession}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-foreground bg-muted/50 hover:bg-muted rounded-lg transition-all"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                        New Chat
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sessions.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">
                            No sessions yet
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session.session_id}
                                onClick={() => switchSession(session.session_id)}
                                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${session.session_id === sessionId
                                    ? "bg-muted text-foreground"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm truncate font-medium">
                                        {session.title || `Chat ${session.session_id.split("_")[1]?.slice(0, 8) || "..."}`}
                                    </div>
                                    <div className="text-xs opacity-60">
                                        {session.message_count} messages
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => deleteSession(session.session_id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all"
                                >
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
