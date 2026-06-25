import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await axios.post(
        "https://ai-chat-1-uqy6.onrender.com/login",
        {
          email,
          password,
        }
      );

      if (response.data.success) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
        navigate("/chat");
      } else {
        setError("Login failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="login-container">
      <div className="butterfly butterfly1">🦋</div>
      <div className="butterfly butterfly2">🦋</div>
      <div className="butterfly butterfly3">🦋</div>

      <div className="login-card">
        <h1>Welcome Back</h1>
        <p>Login to continue your AI Chat</p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <input
              type="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit">Login</button>
        </form>

        <span>
          Don't have an account? <Link to="/signup">Signup</Link>
        </span>
      </div>
    </div>
  );
}

export default Login;