import React from "react";
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import ReactNavbar from 'react-bootstrap/Navbar';


// Here, we display our Navbar
export default function Navbar() {
  return (
    <ReactNavbar style={styles.navbar} variant="dark">
      <Container style={styles.container}>
        <ReactNavbar.Brand href="/" style={styles.brand}>
          WaterScent
        </ReactNavbar.Brand>

        <Nav style={styles.links}>
          <Nav.Link href="/" style={styles.link}>
            Home
          </Nav.Link>
          <Nav.Link href="/login" style={styles.link}>
            Log In
          </Nav.Link>
          <Nav.Link href="/signup" style={styles.signUpLink}>
            Sign Up
          </Nav.Link>
        </Nav>
      </Container>
    </ReactNavbar>
  );
}

const styles = {
  navbar: {
    background:
      "linear-gradient(135deg, #140c08 0%, #2b1b13 52%, #7b5136 100%)",
    borderBottom: "1px solid rgba(244, 220, 193, 0.18)",
    boxShadow: "0 12px 30px rgba(20, 12, 8, 0.24)",
    padding: "12px 0",
  },

  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  brand: {
    color: "#fff8ef",
    fontWeight: "800",
    letterSpacing: "0.4px",
  },

  links: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  link: {
    color: "rgba(255,255,255,0.82)",
    fontWeight: "700",
  },

  signUpLink: {
    backgroundColor: "#fff8ef",
    borderRadius: "999px",
    color: "#2b1b13",
    fontWeight: "800",
    padding: "8px 16px",
  },
};
