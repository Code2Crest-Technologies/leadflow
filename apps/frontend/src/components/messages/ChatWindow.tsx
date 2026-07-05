"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { MessageService } from "@/services/messageService";
import { getMessagePlatform } from "@/components/messages/messagePlatform";
import type { Conversation, Message } from "@/types";
import { useWebSocket } from "@/hooks/useWebSocket";

type ChatWindowProps = {
  conversation: Conversation;
  currentUserId: string;
};

type IncomingMessageEvent = {
  message?: Message;
};

type MessageStatusEvent = {
  messageId?: string;
  status?: string;
};

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ChatWindow({ conversation, currentUserId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { socket } = useWebSocket();
  const platform = getMessagePlatform(conversation.channel);

  useEffect(() => {
    let active = true;

    async function loadMessages() {
      setError("");
      setIsLoading(true);
      try {
        const data = (await MessageService.getMessages(conversation.id)) as Message[];
        if (active) setMessages(data);
      } catch {
        if (active) setError("Could not load messages.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadMessages();

    return () => {
      active = false;
    };
  }, [conversation.id]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (event: IncomingMessageEvent) => {
      const message = event.message;
      if (!message || message.conversationId !== conversation.id) return;
      setMessages((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      );
    };

    const handleStatusUpdate = (event: MessageStatusEvent) => {
      if (!event.messageId || !event.status) return;
      setMessages((current) =>
        current.map((message) =>
          message.id === event.messageId ? { ...message, status: event.status! } : message,
        ),
      );
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:status-update", handleStatusUpdate);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:status-update", handleStatusUpdate);
    };
  }, [conversation.id, socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setError("");
    setIsSending(true);
    try {
      const message = (await MessageService.sendMessage({
        conversationId: conversation.id,
        contactId: conversation.contactId,
        content: trimmed,
        messageType: "TEXT",
      })) as Message;
      setMessages((current) => [...current, message]);
      setContent("");
    } catch {
      setError("Could not send message.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-white">
      <header className="shrink-0 flex items-center justify-between gap-3 border-b border-[var(--color-border)] p-4">
        <div>
          <h2 className="font-bold text-slate-900">
            {conversation.contact.firstName} {conversation.contact.lastName || ""}
          </h2>
          <p className="text-sm text-slate-500">{conversation.contact.phoneNumber}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${platform.className}`}>
          {platform.label}
        </span>
      </header>

      {error && <p className="mx-4 mt-4 shrink-0 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--color-bg)] px-6 py-4">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading messages...</p>
        ) : messages.length ? (
          messages.map((message) => {
            const isMine = message.senderId === currentUserId;
            return (
              <article
                key={message.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[65%] rounded-2xl px-4 py-3 shadow-sm ${
                    isMine
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-100 bg-white text-slate-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                  <div
                    className={`mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px] ${
                      isMine ? "text-emerald-50" : "text-slate-400"
                    }`}
                  >
                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                    <span>{getMessagePlatform(message.channel || conversation.channel).label}</span>
                    <span>{message.status}</span>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No messages yet.
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="shrink-0 flex gap-3 border-t border-[var(--color-border)] bg-white p-4">
        <input
          className="input-field"
          placeholder="Type a message..."
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={isSending}
        />
        <button type="submit" className="btn-primary" disabled={isSending || !content.trim()}>
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}
