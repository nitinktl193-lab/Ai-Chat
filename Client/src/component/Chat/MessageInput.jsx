import { useRef, useState } from "react";
import { Send, Paperclip, Mic, X, Crown } from "lucide-react";
import axios from "axios";
import "./MessageInput.css";

function MessageInput({ sendMessage, paymentRequired }) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [listening, setListening] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const fileRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("user"));

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!message.trim() && files.length === 0) return;

    sendMessage(message, files);
    setMessage("");
    setFiles([]);
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).map((file) => ({
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
    }));

    setFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      setMessage((prev) => `${prev} ${event.results[0][0].transcript}`.trim());
    };

    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    try {
      if (!user?.id) {
        alert("Please login first");
        return;
      }

      setPayLoading(true);

      const loaded = await loadRazorpayScript();

      if (!loaded) {
        alert("Razorpay load nahi hua");
        return;
      }

      const orderRes = await axios.post(
        "http://localhost:5000/payment/create-order",
        {
          userId: user.id,
        }
      );

      const { order, key } = orderRes.data;

      const options = {
        key,
        amount: order.amount,
        currency: order.currency,
        name: "AI Chat Premium",
        description: "₹100 for 1 month premium chat",
        order_id: order.id,

        handler: async function (response) {
          try {
            const verifyRes = await axios.post(
              "http://localhost:5000/payment/verify",
              {
                userId: user.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }
            );

            if (verifyRes.data.success) {
              localStorage.setItem("user", JSON.stringify(verifyRes.data.user));
              alert("Premium activated for 1 month ✅");
              window.location.reload();
            } else {
              alert("Payment verification failed");
            }
          } catch (err) {
            alert(err.response?.data?.message || "Payment verify failed");
          }
        },

        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },

        theme: {
          color: "#2563eb",
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      alert(err.response?.data?.error || "Payment failed");
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <form className="message-input-box" onSubmit={handleSubmit}>
      {files.length > 0 && (
        <div className="file-preview-box">
          {files.map((file, index) => (
            <div className="file-preview" key={index}>
              {file.type.startsWith("image/") ? (
                <img src={file.url} alt={file.name} />
              ) : (
                <span>{file.name}</span>
              )}

              <button type="button" onClick={() => removeFile(index)}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {paymentRequired && (
        <div className="premium-row">
          <button
            type="button"
            className="premium-btn"
            onClick={handlePayment}
            disabled={payLoading}
          >
            <Crown size={17} />
            {payLoading ? "Processing..." : "Buy Premium ₹100 / Month"}
          </button>
        </div>
      )}

      <div className="input-row">
        <button
          type="button"
          className="icon-btn"
          onClick={() => fileRef.current.click()}
        >
          <Paperclip size={21} />
        </button>

        <input
          type="file"
          ref={fileRef}
          hidden
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileChange}
        />

        <textarea
          placeholder="Message AI..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows="1"
        />

        <button type="button" className="icon-btn" onClick={startVoice}>
          <Mic size={21} color={listening ? "red" : "white"} />
        </button>

        <button type="submit" className="send-btn">
          <Send size={20} />
        </button>
      </div>
    </form>
  );
}

export default MessageInput;