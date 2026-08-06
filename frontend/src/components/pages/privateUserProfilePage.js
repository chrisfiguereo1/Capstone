import React, { useContext, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useNavigate } from "react-router-dom";
import API_URL from "../../utilities/api";
import { UserContext } from "../../App";

const emptyProfile = {
  username: "",
  email: "",
};

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const PrivateUserProfile = () => {
  const [show, setShow] = useState(false);
  const [profile, setProfile] = useState(emptyProfile);
  const [form, setForm] = useState(emptyProfile);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const { setUser: setGlobalUser } = useContext(UserContext);
  const navigate = useNavigate();

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    setGlobalUser(undefined);
    navigate("/");
  };

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      setLoading(false);
      navigate("/login");
      return;
    }

    fetch(`${API_URL}/user/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((response) => {
        if (response.status === 401) {
          localStorage.removeItem("accessToken");
          setGlobalUser(undefined);
          navigate("/login");
          return null;
        }

        if (!response.ok) {
          throw new Error("Unable to load profile.");
        }

        return response.json();
      })
      .then((user) => {
        if (user) {
          const loadedProfile = {
            username: user.username || "",
            email: user.email || "",
          };
          setProfile(loadedProfile);
          setForm(loadedProfile);
        }
      })
      .catch((error) => {
        setError(error.message || "Unable to load profile.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate, setGlobalUser]);

  const validateProfile = () => {
    if (!form.username.trim()) {
      return "Username is required.";
    }

    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) {
      return "Please input a valid email.";
    }

    return "";
  };

  const validatePassword = () => {
    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      return "All password fields are required.";
    }

    if (passwordForm.newPassword.length < 8) {
      return "Password must be 8 or more characters.";
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return "New passwords do not match.";
    }

    return "";
  };

  const handleChange = ({ currentTarget: input }) => {
    setForm((current) => ({ ...current, [input.name]: input.value }));
  };

  const handlePasswordChange = ({ currentTarget: input }) => {
    setPasswordForm((current) => ({ ...current, [input.name]: input.value }));
  };

  const startEditing = () => {
    setForm(profile);
    setEditing(true);
    setError("");
    setMessage("");
  };

  const cancelEditing = () => {
    setForm(profile);
    setEditing(false);
    setError("");
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const validationMessage = validateProfile();

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      navigate("/login");
      return;
    }

    try {
      setError("");
      setMessage("");

      const response = await fetch(`${API_URL}/user/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update profile.");
      }

      const updatedProfile = {
        username: data.username || "",
        email: data.email || "",
      };
      setProfile(updatedProfile);
      setForm(updatedProfile);
      setEditing(false);
      setMessage("Profile updated.");
    } catch (error) {
      setError(error.message || "Unable to update profile.");
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    const validationMessage = validatePassword();

    if (validationMessage) {
      setPasswordError(validationMessage);
      return;
    }

    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      navigate("/login");
      return;
    }

    try {
      setPasswordError("");
      setPasswordMessage("");

      const response = await fetch(`${API_URL}/user/profile/password`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update password.");
      }

      setPasswordForm(emptyPasswordForm);
      setPasswordMessage("Password updated.");
    } catch (error) {
      setPasswordError(error.message || "Unable to update password.");
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.header}>
          <div>
            <p style={styles.kicker}>Account</p>
            <h1 style={styles.title}>Profile</h1>
          </div>
          {!editing && (
            <Button type="button" style={styles.primaryButton} onClick={startEditing}>
              Edit Profile
            </Button>
          )}
        </div>

        {loading && <p style={styles.status}>Loading profile...</p>}
        {error && <p style={styles.error}>{error}</p>}
        {message && <p style={styles.success}>{message}</p>}

        {!loading && !editing && (
          <div style={styles.detailsList}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Username</span>
              <strong style={styles.detailValue}>{profile.username || "N/A"}</strong>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Email</span>
              <strong style={styles.detailValue}>{profile.email || "N/A"}</strong>
            </div>
          </div>
        )}

        {!loading && editing && (
          <form onSubmit={saveProfile} style={styles.form}>
            <label style={styles.formLabel}>
              Username
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                style={styles.input}
              />
            </label>
            <label style={styles.formLabel}>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                style={styles.input}
              />
            </label>
            <div style={styles.actions}>
              <Button type="submit" style={styles.primaryButton}>
                Save Changes
              </Button>
              <Button type="button" style={styles.secondaryButton} onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div style={styles.logoutRow}>
          <Button type="button" style={styles.secondaryButton} onClick={handleShow}>
            Log Out
          </Button>
        </div>

        <Modal show={show} onHide={handleClose} backdrop="static" keyboard={false}>
          <Modal.Header closeButton>
            <Modal.Title>Log Out</Modal.Title>
          </Modal.Header>
          <Modal.Body>Are you sure you want to Log Out?</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
            <Button variant="primary" onClick={handleLogout}>
              Yes
            </Button>
          </Modal.Footer>
        </Modal>
      </section>

      <section style={{ ...styles.card, ...styles.passwordCard }}>
        <div style={styles.header}>
          <div>
            <p style={styles.kicker}>Security</p>
            <h2 style={styles.sectionTitle}>Change Password</h2>
          </div>
        </div>

        {passwordError && <p style={styles.error}>{passwordError}</p>}
        {passwordMessage && <p style={styles.success}>{passwordMessage}</p>}

        <form onSubmit={savePassword} style={styles.form}>
          <label style={styles.formLabel}>
            Current Password
            <input
              type="password"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              style={styles.input}
            />
          </label>
          <label style={styles.formLabel}>
            New Password
            <input
              type="password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              style={styles.input}
            />
          </label>
          <label style={styles.formLabel}>
            Confirm New Password
            <input
              type="password"
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              style={styles.input}
            />
          </label>
          <div style={styles.actions}>
            <Button type="submit" style={styles.primaryButton}>
              Update Password
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--ws-page-bg)",
    color: "var(--ws-text)",
    padding: "48px 8% 70px",
  },

  card: {
    maxWidth: "760px",
    margin: "0 auto",
    border: "1px solid var(--ws-border)",
    borderRadius: "28px",
    padding: "30px",
    background: "var(--ws-card-bg)",
    boxShadow: "var(--ws-soft-shadow)",
  },

  passwordCard: {
    marginTop: "24px",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "24px",
  },

  kicker: {
    margin: 0,
    color: "var(--ws-muted-strong)",
    fontSize: "12px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },

  title: {
    color: "var(--ws-text-strong)",
    fontSize: "42px",
    fontWeight: "850",
    margin: "6px 0 0",
  },

  sectionTitle: {
    color: "var(--ws-text-strong)",
    fontSize: "28px",
    fontWeight: "820",
    margin: "6px 0 0",
  },

  status: {
    color: "var(--ws-muted)",
    fontSize: "18px",
  },

  error: {
    color: "#d85c98",
    fontWeight: "800",
  },

  success: {
    color: "var(--ws-muted-strong)",
    fontWeight: "800",
  },

  detailsList: {
    display: "grid",
    gap: "12px",
  },

  detailRow: {
    display: "grid",
    gridTemplateColumns: "150px minmax(0, 1fr)",
    gap: "14px",
    alignItems: "center",
    padding: "14px",
    borderRadius: "17px",
    background: "var(--ws-card-elevated)",
    border: "1px solid var(--ws-accent-2)",
  },

  detailLabel: {
    color: "var(--ws-brown-soft)",
    fontSize: "13px",
    fontWeight: "800",
    textTransform: "uppercase",
  },

  detailValue: {
    color: "var(--ws-brown)",
    overflowWrap: "anywhere",
  },

  form: {
    display: "grid",
    gap: "16px",
  },

  formLabel: {
    display: "grid",
    gap: "8px",
    color: "var(--ws-muted-strong)",
    fontSize: "13px",
    fontWeight: "800",
    textTransform: "uppercase",
  },

  input: {
    border: "1px solid var(--ws-border)",
    borderRadius: "16px",
    background: "var(--ws-input-bg)",
    color: "var(--ws-brown)",
    padding: "12px 14px",
    width: "100%",
    textTransform: "none",
  },

  actions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },

  logoutRow: {
    marginTop: "24px",
  },

  primaryButton: {
    background: "var(--ws-button-bg)",
    border: "none",
    borderRadius: "999px",
    color: "var(--ws-button-text)",
    fontWeight: "800",
    padding: "9px 16px",
  },

  secondaryButton: {
    background: "transparent",
    border: "1px solid var(--ws-border)",
    borderRadius: "999px",
    color: "var(--ws-text)",
    fontWeight: "800",
    padding: "9px 16px",
  },
};

export default PrivateUserProfile;
