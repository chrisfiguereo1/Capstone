const isLocalFrontend =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const API_URL = isLocalFrontend
  ? "http://localhost:8081"
  : process.env.REACT_APP_API_URL || "https://waterscent.onrender.com";

export default API_URL;
