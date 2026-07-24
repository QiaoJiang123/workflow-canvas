import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flow Canvas",
  description: "A visual flow design tool for AI workflows and approval chains",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var initial = "light";
                document.documentElement.dataset.theme = initial;
                function closestFromEvent(event, selector) {
                  var target = event.target;
                  if (!target) return null;
                  var element = target.nodeType === 1 ? target : target.parentElement;
                  return element && element.closest ? element.closest(selector) : null;
                }
                document.addEventListener("click", function (event) {
                  var target = closestFromEvent(event, 'button[aria-label="Toggle theme"]');
                  if (!target) return;
                  var next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
                  document.documentElement.dataset.theme = next;
                  if (window.localStorage) window.localStorage.setItem("workflow-canvas-theme", next);
                }, true);
                function appendMessage(chat, role, text, loading) {
                  var list = chat.querySelector(".chat-messages");
                  if (!list) return null;
                  var article = document.createElement("article");
                  article.className = "chat-message " + role + (loading ? " is-loading" : "");
                  var icon = document.createElement("span");
                  icon.className = "chat-role";
                  icon.setAttribute("aria-hidden", "true");
                  icon.textContent = role === "user" ? "U" : "AI";
                  var paragraph = document.createElement("p");
                  paragraph.dataset.role = role;
                  paragraph.textContent = text;
                  article.appendChild(icon);
                  article.appendChild(paragraph);
                  list.appendChild(article);
                  list.scrollTop = list.scrollHeight;
                  return article;
                }
                function readMessages(chat) {
                  return Array.prototype.slice.call(chat.querySelectorAll(".chat-message p[data-role]")).map(function (item) {
                    return { role: item.dataset.role, content: item.textContent || "" };
                  }).filter(function (message) {
                    return (message.role === "user" || message.role === "assistant") && message.content !== "Thinking...";
                  });
                }
                function parseJson(value) {
                  try {
                    return value ? JSON.parse(value) : null;
                  } catch {
                    return null;
                  }
                }
                function saveWorkflow(workflow) {
                  if (!workflow || !window.localStorage) return;
                  var indexKey = "workflow-canvas:index";
                  var recordPrefix = "workflow-canvas:workflow:";
                  var ids = [];
                  try {
                    ids = JSON.parse(window.localStorage.getItem(indexKey) || "[]");
                    if (!Array.isArray(ids)) ids = [];
                  } catch {
                    ids = [];
                  }
                  if (ids.indexOf(workflow.id) === -1) ids.push(workflow.id);
                  window.localStorage.setItem(recordPrefix + workflow.id, JSON.stringify(workflow));
                  window.localStorage.setItem(indexKey, JSON.stringify(ids));
                }
                async function sendChat(chat, text) {
                  var trimmed = (text || "").trim();
                  if (!trimmed || chat.dataset.sending === "true") return;
                  chat.dataset.sending = "true";
                  appendMessage(chat, "user", trimmed, false);
                  var textarea = chat.querySelector(".chat-composer textarea");
                  if (textarea) textarea.value = "";
                  var loading = appendMessage(chat, "assistant", "Thinking...", true);
                  try {
                    var response = await fetch("/api/chat", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        messages: readMessages(chat),
                        context: chat.dataset.workflowContext || "",
                        workflow: parseJson(chat.dataset.workflowJson),
                        selected: parseJson(chat.dataset.selectedJson)
                      })
                    });
                    var data = await response.json();
                    if (loading) loading.remove();
                    appendMessage(chat, "assistant", data.message || data.error || "I could not generate a response.", false);
                    if (data.workflow) {
                      saveWorkflow(data.workflow);
                      window.setTimeout(function () {
                        window.location.reload();
                      }, 700);
                    }
                  } catch (error) {
                    if (loading) loading.remove();
                    appendMessage(chat, "assistant", error && error.message ? error.message : "The chat request failed.", false);
                  } finally {
                    chat.dataset.sending = "false";
                    if (textarea) textarea.focus();
                  }
                }
                document.addEventListener("click", function (event) {
                  var prompt = closestFromEvent(event, ".workflow-chat .chat-suggestions button");
                  if (!prompt) return;
                  event.preventDefault();
                  event.stopImmediatePropagation();
                  sendChat(prompt.closest(".workflow-chat"), prompt.dataset.agentPrompt || prompt.textContent || "");
                }, true);
                document.addEventListener("submit", function (event) {
                  var form = closestFromEvent(event, ".workflow-chat .chat-composer");
                  if (!form) return;
                  event.preventDefault();
                  event.stopImmediatePropagation();
                  var textarea = form.querySelector("textarea");
                  sendChat(form.closest(".workflow-chat"), textarea ? textarea.value : "");
                }, true);
                document.addEventListener("keydown", function (event) {
                  var textarea = closestFromEvent(event, ".workflow-chat .chat-composer textarea");
                  if (!textarea || event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  event.stopImmediatePropagation();
                  sendChat(textarea.closest(".workflow-chat"), textarea.value || "");
                }, true);
              })();
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
