import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import API_URL from "../../utilities/api";
import waterscentLogo from "../../assets/waterscent.png";

const url = `${API_URL}/user/signup`;

const Register = () => {
  const [data, setData] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = ({ currentTarget: input }) => {
    setData({ ...data, [input.name]: input.value });
  };

  let labelStyling = {
    color: "var(--ws-accent)",
    fontWeight: "bold",
    textDecoration: "none",
  };
  let backgroundStyling = { background: "var(--ws-hero-bg)" };
  let formCardStyling = {
    background: "var(--ws-card-solid)",
    border: "1px solid var(--ws-border)",
    borderRadius: "26px",
    boxShadow: "var(--ws-card-shadow)",
    padding: "32px",
  };
  let inputStyling = {
    backgroundColor: "var(--ws-input-bg)",
    border: "1px solid var(--ws-accent-2)",
    borderRadius: "14px",
    color: "var(--ws-brown)",
    padding: "11px 14px",
  };
  let buttonStyling = {
    background: "var(--ws-button-bg)",
    borderStyle: "none",
    borderRadius: "999px",
    color: "var(--ws-button-text)",
    fontWeight: "800",
    padding: "10px 22px",
  };
  let authHeaderStyling = {
    display: "grid",
    justifyItems: "center",
    gap: "10px",
    marginBottom: "24px",
    textAlign: "center",
  };
  let authLogoStyling = {
    height: "92px",
    width: "auto",
    display: "block",
  };
  let authTitleStyling = {
    color: "var(--ws-text-strong)",
    fontSize: "30px",
    fontWeight: "850",
    margin: 0,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(url, data);
      
      // Navigate to the login page
      navigate("/login");
    } catch (error) {
      if (
        error.response &&
        error.response.status >= 400 &&
        error.response.status <= 500
      ) {
        setError(error.response.data.message);
      }
    }
  };

  return (
    <>
      <section className="vh-100">
        <div className="container-fluid h-custom vh-100">
          <div
            className="row d-flex justify-content-center align-items-center h-100 "
            style={backgroundStyling}
          >
            <div className="col-md-8 col-lg-6 col-xl-4">
              <Form onSubmit={handleSubmit} style={formCardStyling}>
                <div style={authHeaderStyling}>
                  <img src={waterscentLogo} alt="WaterScent logo" style={authLogoStyling} />
                  <h1 style={authTitleStyling}>WaterScent</h1>
                </div>
                <Form.Group className="mb-3" controlId="formBasicEmail">
                  <Form.Label style={labelStyling}>Username</Form.Label>
                  <Form.Control
                    type="username"
                    name="username"
                    onChange={handleChange}
                    placeholder="Enter username"
                    style={inputStyling}
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="formBasicEmail">
                  <Form.Label style={labelStyling}>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    onChange={handleChange}
                    placeholder="Enter Email Please"
                    style={inputStyling}
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="formBasicPassword">
                  <Form.Label style={labelStyling}>Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    placeholder="Password"
                    onChange={handleChange}
                    style={inputStyling}
                  />
                </Form.Group>
                {error && (
                  <div style={labelStyling} className="pt-3">
                    {error}
                  </div>
                )}
                <Button
                  variant="primary"
                  type="submit"
                  style={buttonStyling}
                  className="mt-2"
                >
                  Register
                </Button>
              </Form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Register;
