import { Link } from "react-router-dom";
import "./Home.css";

function Home() {
  return (
    <div className="home-container">
      <div className="home-content">
        <span className="home-badge">AI Assistant</span>
        <h1>Pocket Ai</h1>
        <p>Your intelligent AI assistant for coding, learning and ideas.</p>

        <Link to="/login">
          <button className="start-btn">Start Chat</button>
        </Link>
      </div>
    </div>
  );
}

export default Home;