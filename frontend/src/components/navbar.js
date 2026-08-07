import React, { useContext } from "react";
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import ReactNavbar from 'react-bootstrap/Navbar';
import { useNavigate } from "react-router-dom";
import { ThemeContext, UserContext } from "../App";
import waterscentLogo from "../assets/waterscent.png";


// Here, we display our Navbar
export default function Navbar() {
  const { user, setUser } = useContext(UserContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const isLoggedIn = Boolean(user);
  const nextTheme = theme === "dark" ? "light" : "dark";

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    setUser(undefined);
    navigate("/");
  };

  const handleAiFinderClick = (event) => {
    if (isLoggedIn) {
      return;
    }

    event.preventDefault();
    navigate("/login", {
      state: { from: "/ai-finder", aiFinderRedirect: true },
    });
  };

  return (
    <ReactNavbar
      style={styles.navbar}
      variant={theme === "dark" ? "dark" : "light"}
      expand="md"
    >
      <Container fluid style={styles.container}>
        <ReactNavbar.Brand href="/" style={styles.brand}>
          WaterScent
          <img src={waterscentLogo} alt="WaterScent logo" style={styles.brandLogo} />
        </ReactNavbar.Brand>

        <ReactNavbar.Toggle aria-controls="waterscent-navbar" />
        <ReactNavbar.Collapse
          id="waterscent-navbar"
          className="ws-navbar-collapse"
          style={styles.collapse}
        >
        <Nav style={styles.links}>
          <Nav.Link href="/" style={styles.link}>
            Home
          </Nav.Link>
          <Nav.Link href="/ai-finder" onClick={handleAiFinderClick} style={styles.link}>
            AI Finder
          </Nav.Link>
          {isLoggedIn ? (
            <>
              <Nav.Link href="/privateUserProfile" style={styles.link}>
                Profile
              </Nav.Link>
              <Nav.Link href="/saved" style={styles.link}>
                Saved
              </Nav.Link>
              <button type="button" onClick={handleLogout} style={styles.navButton}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <Nav.Link href="/login" style={styles.link}>
                Log In
              </Nav.Link>
              <Nav.Link href="/signup" style={styles.signUpLink}>
                Sign Up
              </Nav.Link>
            </>
          )}
          <button
            type="button"
            className="ws-theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${nextTheme} mode`}
            title={`Switch to ${nextTheme} mode`}
          >
            <span aria-hidden="true">{theme === "dark" ? "Sun" : "Moon"}</span>
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </Nav>
        </ReactNavbar.Collapse>
      </Container>
    </ReactNavbar>
  );
}

const styles = {
  navbar: {
    background: "var(--ws-navbar-bg)",
    borderBottom: "1px solid var(--ws-border)",
    boxShadow: "var(--ws-card-shadow)",
    padding: "12px 0",
  },

  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: "24px",
    paddingRight: "24px",
  },

  collapse: {
    justifyContent: "flex-end",
  },

  brand: {
    color: "var(--ws-text)",
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    fontWeight: "800",
    letterSpacing: "0.4px",
  },

  brandLogo: {
    height: "40px",
    width: "auto",
    display: "block",
  },

  links: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  link: {
    color: "var(--ws-nav-link)",
    fontWeight: "700",
  },

  signUpLink: {
    backgroundColor: "var(--ws-pill-bg)",
    borderRadius: "999px",
    color: "var(--ws-pill-text)",
    fontWeight: "800",
    padding: "8px 16px",
  },

  navButton: {
    background: "transparent",
    border: "none",
    color: "var(--ws-nav-link)",
    fontWeight: "700",
    padding: "8px",
  },
};
