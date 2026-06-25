import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
} from "lucide-react";
import "./Message.css";

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);

  const codeText = String(children || "").replace(/\n$/, "");

  const copyCode = async () => {
    await navigator.clipboard.writeText(codeText);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <div className="code-box">
      <div className="code-header">
        <span>Code</span>
        <button onClick={copyCode}>{copied ? "Copied" : "Copy"}</button>
      </div>

      <pre>
        <code>{codeText}</code>
      </pre>
    </div>
  );
}

function Message({ sender, text, files, isLastAI, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState("");

  const copyMessage = async () => {
    await navigator.clipboard.writeText(text || "");
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  const readAloud = () => {
    if (!window.speechSynthesis) {
      alert("Text to speech supported nahi hai");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text || "");
    utterance.lang = "hi-IN";
    utterance.rate = 1;

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`message ${sender}`}>
      <div className="message-bubble">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ inline, children }) {
              return inline ? (
                <code className="inline-code">{children}</code>
              ) : (
                <CodeBlock>{children}</CodeBlock>
              );
            },
          }}
        >
          {text}
        </ReactMarkdown>

        {files?.length > 0 && (
          <div className="message-files">
            {files.map((file, index) =>
              file.type.startsWith("image/") ? (
                <img key={index} src={file.url} alt={file.name} />
              ) : (
                <a
                  key={index}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {file.name}
                </a>
              )
            )}
          </div>
        )}

        {sender === "ai" && (
          <div className="message-actions">
            <button type="button" onClick={copyMessage} title="Copy">
              <Copy size={15} />
              {copied ? "Copied" : "Copy"}
            </button>

            <button type="button" onClick={readAloud} title="Read aloud">
              <Volume2 size={15} />
              Read
            </button>

            {isLastAI && (
              <button type="button" onClick={onRegenerate} title="Regenerate">
                <RotateCcw size={15} />
                Regenerate
              </button>
            )}

            <button
              type="button"
              className={feedback === "like" ? "active-feedback" : ""}
              onClick={() => setFeedback("like")}
              title="Like"
            >
              <ThumbsUp size={15} />
            </button>

            <button
              type="button"
              className={feedback === "dislike" ? "active-feedback" : ""}
              onClick={() => setFeedback("dislike")}
              title="Dislike"
            >
              <ThumbsDown size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Message;